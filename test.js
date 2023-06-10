const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// middleware for verify jwt
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}


// mongodb connection
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


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

        const usersCollection = client.db('SportsMastery').collection('users');
        const classCollection = client.db('SportsMastery').collection('allClasses');


        // jwt token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            });
            res.send({ token });
        })

        // Warning: use verifyJWT before using verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            // if (user?.role !== 'admin') {
            if (!user || user.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // Warning: use verifyJWT before using verifyInstructor
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            // if ( user.role !== 'instructor')
            if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // post the user in api
        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            user.role = 'student';
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                console.log('User already exists');
                return res.send({ message: 'User already exists' });
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // get : the users from server
        app.get('/users', verifyJWT, verifyAdmin, verifyInstructor, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        // delete : to delete specific user
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        // for patch : to make user an admin
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };

            const updateUser = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(query, updateUser);
            res.send(result);
        })

        // to get : verify admin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })


        // for patch : make user an instructor
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };

            const updateUser = {
                $set: {
                    role: 'instructor'
                },
            };

            const result = await usersCollection.updateOne(query, updateUser);
            res.send(result);
        })

        // to get : verify admin
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })

        // for post : add class from instructor
        app.post('/classes', async (req, res) => {
            const classItem = req.body;
            classItem.status = 'pending'; // Set the status as 'pending
            const result = await classCollection.insertOne(classItem);
            res.send(result);
        })

        // for get : the all classes
        app.get('/classes', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result);
        })

        // for put : update the feedback in a modal
        app.put('/classes/feedback/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };
            const classInfo = req.body;
            const options = { upsert: true }
            console.log(classInfo);
            const updateFeedback = {
                $set: {
                    feedback: classInfo.feedback
                }
            };
            const result = await classCollection.updateOne(query, updateFeedback, options);
            res.send(result);
        })

        // for show feedback
        app.get('/classes/showFeedback/:id', verifyJWT,  async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await classCollection.findOne(query);
            res.send(result);
            console.log(result)
        })

        // for put : the status update
        // make class status approved
        app.patch('/classes/approve/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }; // Update the filter to match the email field
            const updatedDoc = {
                $set: {
                    status: "approved",
                },
            };
            const result = await classCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        // make class status deny
        app.patch('/classes/deny/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }; // Update the filter to match the email field
            const updatedDoc = {
                $set: {
                    status: "denied",
                },
            };
            const result = await classCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        // for display all the instructor : by get operation
        app.get('/instructors', async (req, res) => {
            // const role = req.query.role;
            const role = 'instructor';
            const query = { role: role };
            const result = await usersCollection.find(query).toArray();
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


// test
app.get('/', (req, res) => {
    res.send('SportsMastery is running now successfully')
})

