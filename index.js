const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { send } = require('express/lib/response');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1fg6s.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorize Access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const partsCollection = client.db("robotics_parts_manufacturer").collection("parts");
        const orderCollection = client.db("robotics_parts_manufacturer").collection("orders");
        const userCollection = client.db("robotics_parts_manufacturer").collection("users");
        const productCollection = client.db("robotics_parts_manufacturer").collection("products");
        const ratingCollection = client.db("robotics_parts_manufacturer").collection("ratings");
        const paymentCollection = client.db("robotics_parts_manufacturer").collection("payments");

        // admin verification
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }


// parts to product send and update start

        app.get('/product', async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query);
            const product = await cursor.toArray();
            res.send(product);
        });
        // call one parts use id
        app.get('/product/:productId', async (req, res) => {
            const id = req.params.productId;
            const query = { _id: ObjectId(id) };
            const product = await productCollection.findOne(query);
            res.send(product);
        })

         //update parts quantity
         app.patch('/product/:id', async (req, res) => {
            const id = req.params.id;
            const product = req.body;
            console.log(product);
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    quantity: product.quantity
                }
            }
            const updatingProduct = await productCollection.updateOne(filter, updatedDoc);
            res.send(updatingProduct);
        })
// parts to product send and update end


        //show order in my order page
        app.get('/order', verifyJWT, async (req, res) => {
            const customer = req.query.customer;
            const decodedEmail = req.decoded.email;
            if (customer === decodedEmail) {
                const query = { customer: customer };
                const orders = await orderCollection.find(query).toArray();
                return res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' })
            }
        });



        //show order in my Manage All order page
        app.get('/manageOrder',  async (req, res) => {
            const admin = req.query.admin;
            // const decodedEmail = req.decoded.email;
            // if (customer === decodedEmail) {
                const query = { admin: admin };
                const orders = await orderCollection.find(query).toArray();
                return res.send(orders);
            // }
            // else {
            //     return res.status(403).send({ message: 'forbidden access' })
            // }
        });





        // order payment option start

        // order id find for payment
        app.get('/order/:id', verifyJWT, async(req, res) =>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const order = await orderCollection.findOne(query);
            res.send(order);
        })
        // payment intent
        app.post('/create-payment-intent', verifyJWT, async(req, res) =>{
            const service = req.body;
            const price = service.price;
            const amount = price*100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types:['card']
            });
            res.send({clientSecret: paymentIntent.client_secret})
        });

        app.patch('/order/:id', verifyJWT, async(req, res)=>{
            const id= req.params.id;
            console.log(id);
            const payment= req.body;
            const filter = {_id: ObjectId(id)};
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            // const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedOrder);

        })
        // order payment option end

        // order parts
        app.post('/order', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send({ success: true, result });
        });


        //load all users
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        //user make admin
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        //user collection
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token })
        })


        // deleting order
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
        })

        //load product in manage option      
        app.get('/product', async (req, res) => {
            const product = await productCollection.find().toArray();
            res.send(product);
        })

        // post product data
        app.post('/product', verifyJWT, verifyAdmin, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })

        // post customer rating
        app.post('/rating', verifyJWT, async (req, res) => {
            const rating = req.body;
            const result = await ratingCollection.insertOne(rating);
            res.send(result);
        })
        //load rating in home page      
        app.get('/rating', async (req, res) => {
            const rating = await ratingCollection.find().toArray();
            res.send(rating);
        })

        // delete product
        app.delete('/product/:name', verifyJWT, verifyAdmin, async (req, res) => {
            const name = req.params.name;
            const filter = {name: name}
            const result = await productCollection.deleteOne(filter);
            res.send(result);
        })

    }
    finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('hello from robot')
})

app.listen(port, () => {
    console.log(`robot app listening port ${port}`);
})