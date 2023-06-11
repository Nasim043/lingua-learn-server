const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');

// middlewarea
app.use(cors());
app.use(express.json());

// verify jwt
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'No token provided.' });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const classesCollection = client.db("summercampDb").collection("classes");

        // Jwt
        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
            res.send({ token })
        })


        app.get('/', (req, res) => {
            res.send('Summer camp is running!')
        })

        // users
        app.get('/users', verifyJWT, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const users = req.body;
            users.role = 'student'
            // check if the user is existing
            const user = await usersCollection.findOne({ email: users.email });
            if (user) {
                return res.send({ message: "User already exist" });
            }
            const result = await usersCollection.insertOne(users);
            res.send(result);
        })

        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email;

            // if (req.decoded.email !== email) {
            //     res.send({ admin: false })
            // }

            const user = await usersCollection.findOne({ email: email });
            res.send({ role: user?.role, user: user });
        });

        // update role
        app.patch('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;

            const filter = { email: email };
            const options = { upsert: false };
            const updateDoc = {
                $set: {
                    role: user.role
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })

        // classes related api
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })
        app.get('/classes/approved', async (req, res) => {
            const query = { status: 'approved' };
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })
        app.get('/classes/:email', async (req, res) => {
            const email = req.params.email;
            const result = await classesCollection.find({ instructor_email: email }).toArray();
            res.send(result);
        })
        app.post('/classes', verifyJWT, async (req, res) => {
            const classes = req.body;
            classes.enrolled = 0;
            const result = await classesCollection.insertOne(classes);
            res.send(result);
        })
        // update status
        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const classes = req.body;

            const filter = { _id: new ObjectId(id) };
            const options = { upsert: false };
            const updateDoc = {
                $set: {
                    status: classes.status
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })

        // update feedback
        app.patch('/classes/feedback/:id', async (req, res) => {
            const id = req.params.id;
            const classes = req.body;

            const filter = { _id: new ObjectId(id) };
            const options = { upsert: false };
            const updateDoc = {
                $set: {
                    feedback: classes.feedback
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })

        // instructor related api
        app.get('/users/instructors', async (req, res) => {
            const filter = { role: 'instructor' };
            const result = await usersCollection.find(filter).toArray();
            res.send(result);
        })
        app.get('/instructors/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const result = await classesCollection.find({ email: email }).toArray();
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
    console.log('Example app listening on port 5000!')
})