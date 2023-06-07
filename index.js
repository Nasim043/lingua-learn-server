const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()

// middlewarea
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l8zs6j6.mongodb.net/?retryWrites=true&w=majority`;
// TODO: Connect to Online
// const uri = "mongodb://127.0.0.1:27017";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db("summercampDb").collection("users");

        app.get('/', (req, res) => {
            res.send('Summer camp is running!')
        })

        // users
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const users = req.body;
            // check if the user is existing
            const user = await usersCollection.findOne({ email: users.email });
            if (user) {
                res.send({ message: "User already exist" });
            }
            const result = await usersCollection.insertOne(users);
            res.send(result);
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(5000, () => {
    console.log('Example app listening on port 3000!')
})