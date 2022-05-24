const express = require('express');
const cors= require('cors');
require ('dotenv').config( );
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { send } = require('express/lib/response');
const app = express(); 
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1fg6s.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{
        await client.connect();
        const partsCollection= client.db("robotics_parts_manufacturer").collection("parts");
        const orderCollection= client.db("robotics_parts_manufacturer").collection("orders");

        app.get('/parts', async (req, res) => {
            const query = {};
            const cursor = partsCollection.find(query);
            const parts = await cursor.toArray();
            res.send(parts);
        });
        // call one parts use id
        app.get('/parts/:partsId', async(req, res) =>{
            const id = req.params.partsId;
            const query ={_id: ObjectId(id)};
            const parts = await partsCollection.findOne(query);
            res.send(parts);
        })

        app.post('/order', async(req, res) =>{
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send({success: true, result});
        });

        //show order in my order page
        app.get('/order', verifyJWT, async (req, res) => {
            const customer = req.query.customer;
            const query = { customer: customer };
            const orders = await orderCollection.find(query).toArray();
            return res.send(orders);
            // const decodedEmail = req.decoded.email;
            // if (patient === decodedEmail) {
            //     const query = { patient: patient };
            //     const bookings = await bookingCollection.find(query).toArray();
            //     return res.send(bookings);
            // }
            // else {
            //     return res.status(403).send({ message: 'forbidden access' })
            // }
        }); 


        //update parts quantity
        app.patch('/parts/:id', async(req, res)=>{
            const id= req.params.id;
            const parts= req.body;
            console.log(parts);
            const filter = {_id: ObjectId(id)};
            const updatedDoc = {
                $set: {
                    quantity: parts.quantity
                }
            }
            const updatingParts = await partsCollection.updateOne(filter, updatedDoc);
            res.send(updatingParts);
        })


    }
    finally{

    }
}

run().catch(console.dir);

app.get('/', (req, res) =>{
    res.send('hello from robot')
})

app.listen(port,() =>{
    console.log(`robot app listening port ${port}`);
})