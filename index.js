const express = require('express');
const app = express();
var cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)

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
        // await client.connect();

        const usersCollection = client.db("summercampDb").collection("users");
        const classesCollection = client.db("summercampDb").collection("classes");
        const paymentCollection = client.db("summercampDb").collection("payments");

        // Jwt
        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
            res.send({ token })
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await usersCollection.findOne({ email: email });
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            next();
        }
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await usersCollection.findOne({ email: email });
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            next();
        }
        const verifyStudent = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await usersCollection.findOne({ email: email });
            if (user?.role !== 'student') {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            next();
        }

        app.get('/', (req, res) => {
            res.send('Summer camp is running!')
        })

        // users
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
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


        // selected class related api
        app.get('/users/selected/:mail', async (req, res) => {
            const userEmail = req.params.mail;
            const user = await usersCollection.findOne({ email: userEmail }, { selected: 1 });
            // Extract the selected class IDs from the user document
            const selectedClassIds = user?.selected;
            // Retrieve the class information for the selected class IDs
            if (!selectedClassIds) {
                return res.send([]);
            }
            const selectedClasses = await classesCollection.aggregate([
                { $match: { _id: { $in: selectedClassIds?.map(id => new ObjectId(id)) } } }
            ]).toArray();
            res.send(selectedClasses);
        })

        app.patch('/users/selected/:classId', async (req, res) => {
            const userEmail = req.body.email;
            const selectedClassId = req.params.classId;

            // Check if the selectedClassId exists in the selected array for the user
            const userExists = await usersCollection.findOne({ email: userEmail, selected: { $in: [new ObjectId(selectedClassId)] } });

            if (userExists) {
                // The selectedClassId exists in the selected array
                return res.send({ error: true, message: "Class already selected" });
            } else {
                // The selectedClassId does not exist in the selected array
                const result = await usersCollection.updateOne(
                    { email: userEmail },
                    { $push: { selected: selectedClassId } }
                );

                res.send(result)
            }
        })

        app.patch('/users/selected/delete/:classId', async (req, res) => {
            const userEmail = req.body.email;
            const selectedClassId = req.params.classId;

            // Delete the selectedClassId from the selected array for the user
            const result = await usersCollection.updateOne({ email: userEmail }, { $pull: { selected: selectedClassId } });
            res.send(result);
        })
        // enrolled classes list
        app.get('/users/enrolled/:mail', async (req, res) => {
            const userEmail = req.params.mail;
            const user = await usersCollection.findOne({ email: userEmail }, { enrolled: 1 });

            // Extract the enrolled class IDs from the user document
            const enrolledClassIds = user?.enrolled;

            if (!enrolledClassIds) {
                // The selectedClassId exists in the selected array
                return res.send([]);
            } else {
                // Retrieve the class information for the enrolled class IDs
                const enrolledClasses = await classesCollection.aggregate([
                    { $match: { _id: { $in: enrolledClassIds?.map(id => new ObjectId(id)) } } }
                ]).toArray();
                res.send(enrolledClasses);
            }

            // Retrieve the class information for the enrolled class IDs
            // const enrolledClasses = await classesCollection.aggregate([
            //     { $match: { _id: { $in: enrolledClassIds?.map(id => new ObjectId(id)) } } }
            // ]).toArray();
            // res.send(enrolledClasses);
        })

        // classes related api
        app.get('/classes', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })
        // popular class and instructors
        app.get('/classes/popular', async (req, res) => {
            const query = { status: 'approved' };
            const result = await classesCollection.find(query).sort({ enrolled: -1 }).limit(6).toArray();
            res.send(result);
        })
        app.get('/instructors/popular', async (req, res) => {
            const filter = { role: 'instructor' };
            const result = await usersCollection.find(filter).limit(6).toArray();
            res.send(result);
        })

        app.get('/classes/approved', async (req, res) => {
            const query = { status: 'approved' };
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })
        app.get('/classes/:email', verifyJWT, verifyInstructor, async (req, res) => {
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
        // update class
        app.patch('/classes/edit/:id', async (req, res) => {
            const id = req.params.id;
            const classes = req.body;

            const filter = { _id: new ObjectId(id) };
            const options = { upsert: false };
            const updateDoc = {
                $set: {
                    ...classes
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc, options);
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

        // create payment intent
        app.post('/create-payment-intent', verifyJWT, verifyStudent, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })
        // payment related api
        app.post('/payments', verifyJWT, verifyStudent, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);


            const userEmail = req.body.email;
            const selectedClassId = req.body.course_id;

            // Delete the selectedClassId from the selected array for the user
            const deleteResult = await usersCollection.updateOne({ email: userEmail }, { $pull: { selected: selectedClassId } });

            // insert the selectedClassId in enrolled courses
            const insertResultEnrolled = await usersCollection.updateOne(
                { email: userEmail },
                { $push: { enrolled: selectedClassId } }
            );

            // inc and dec the seats
            classesCollection.updateOne({ _id: new ObjectId(selectedClassId) }, { $inc: { enrolled: 1 } });
            classesCollection.updateOne({ _id: new ObjectId(selectedClassId) }, { $inc: { available_seats: -1 } });

            res.send({ insertResult, deleteResult, insertResultEnrolled });
        })

        // get payment history
        app.get('/paymentHistory/:email', verifyJWT, verifyStudent, async (req, res) => {
            const email = req.params.email;
            const result = await paymentCollection.find({ email: email }).sort({ date: -1 }).toArray();
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