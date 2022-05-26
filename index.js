const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { send } = require('express/lib/response');
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

        app.get('/parts', async (req, res) => {
            const query = {};
            const cursor = partsCollection.find(query);
            const parts = await cursor.toArray();
            res.send(parts);
        });
        // call one parts use id
        app.get('/parts/:partsId', async (req, res) => {
            const id = req.params.partsId;
            const query = { _id: ObjectId(id) };
            const parts = await partsCollection.findOne(query);
            res.send(parts);
        })



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


        // order parts
        app.post('/order', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send({ success: true, result });
        });


        //update parts quantity
        app.patch('/parts/:id', async (req, res) => {
            const id = req.params.id;
            const parts = req.body;
            console.log(parts);
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    quantity: parts.quantity
                }
            }
            const updatingParts = await partsCollection.updateOne(filter, updatedDoc);
            res.send(updatingParts);
        })

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
        app.delete('/order/:customer', async (req, res) => {
            const customer = req.params.customer;
            const filter = { customer: customer }
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