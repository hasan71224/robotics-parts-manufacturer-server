const express = require('express');
const cors= require('cors');
require ('dotenv').config( );
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express(); 
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1fg6s.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{
        await client.connect();
        const partsCollection = client.db("robotics_parts_manufacturer").collection("parts");

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