const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRECT_KEY);
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

// verifyJWT middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lc40fqb.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("sportsAcademy").collection("users");
    const classCollection = client.db("sportsAcademy").collection("classes");
    const selectedClassCollection = client
      .db("sportsAcademy")
      .collection("selectedClass");
    const paymentsCollection = client.db("sportsAcademy").collection("payment");
    const enrolledClassesCollection = client
      .db("sportsAcademy")
      .collection("enrolled");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10h",
      });
      res.send(token);
    });

    // post users

    app.post("/users", async (req, res) => {
      const body = req.body;
      const query = { email: body.email };
      const existingUSer = await usersCollection.findOne(query);
      if (existingUSer) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(body);
      res.send(result);
    });

    // make admin
    app.patch("/users/admin/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.get("/classes",  async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // make Instructor
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Get all instructors
    app.get("/instructors", async (req, res) => {
      const instructors = await usersCollection
        .find({ role: "instructor" })
        .toArray();
      res.send(instructors);
    });

    // verify Instructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    // get 6 instructor data

    app.get("/instructor", async (req, res) => {
      const result = await usersCollection
        .find({ role: "instructor" })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // get all the users

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // delete user

    app.delete("/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // post classes
    app.post("/classes", async (req, res) => {
      const body = req.body;
      const result = await classCollection.insertOne(body);
      res.send(result);
    });

    // get the specific instructor classes.
    app.get("/class", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { instructorEmail: req.query.email };
      }
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // make class role approved
    app.patch("/classes/approve/:id", async (req, res) => {
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

    // make class role deny
    app.patch("/classes/deny/:id", async (req, res) => {
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

    // add feedback
    app.put("/classes/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const classInfo = req.body;
      const options = { upsert: true };
      console.log(classInfo);
      const updateFeedback = {
        $set: {
          feedback: classInfo.feedback,
        },
      };
      const result = await classCollection.updateOne(
        query,
        updateFeedback,
        options
      );
      res.send(result);
    });

    // to show feedback
    app.get("/classes/showFeedback/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    });

    // find all the approved classes
    app.get("/approvedClass", async (req, res) => {
      const classes = await classCollection
        .find({ status: "approved" })
        .toArray();
      res.send(classes);
    });

    // post a selected class

    app.post("/selectedClasses", async (req, res) => {
      const body = req.body;
      const result = await selectedClassCollection.insertOne(body);
      res.send(result);
    });

    app.get("/selectedClass", async (req, res) => {
      let query = {};
      if (req?.query.email) {
        query = { email: req.query.email };
      }
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    });

    // delete selected classes
    app.delete("/selectedClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    });

    // Payment

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      console.log(price);
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      console.log(payment);
      const insertedResult = await paymentsCollection.insertOne(payment); // ok

      const queryClass = {
        _id: new ObjectId(payment.selectedClassId),
      };

      const query = {
        classId: payment.selectedClassId,
      };

      const findEnrolledClasses = await selectedClassCollection.findOne(query);
      const insertOnEnrollment = await enrolledClassesCollection.insertOne(
        findEnrolledClasses
      );
      const deletedResult = await selectedClassCollection.deleteOne(query);

      const updateClass = {
        $inc: {
          AvailableSeats: -1,
          enrolled: 1,
        },
      };

      const updateClassCollection = await classCollection.updateOne(
        queryClass,
        updateClass
      );
      res.send({
        insertedResult,
        deletedResult,
        insertOnEnrollment,
        updateClassCollection,
      });
    });

    app.get("/paymentSuccessfully/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentsCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // enrolled class
    app.get("/enrolledStudent/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email : email };
      const result = await enrolledClassesCollection.find(query).toArray();
      res.send(result);
    });

    // top classes base on enroll by student
    app.get("/topClasses", async (req, res) => {
      const result = await classCollection
        .find()
        .sort({ enrolled: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Sports academy is running..");
});

app.listen(port, () => {
  console.log(`Sports academy is running on port ${port}`);
});
