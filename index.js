import express, { json } from "express";
import joi from "joi";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

const app = express();
app.use(cors());
app.use(json());
dotenv.config();

let db = null;

const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();

promise.then(() => {
    db = mongoClient.db("uol");
    console.log("Database ON!");
})
promise.catch(e => {
    console.log("Erro ao conectar na Database", e);
})


app.post("/participants", async (req, res) => {
    console.log(req.body);
    try {
        await db.collection('participants').insertOne({ name: req.body.name, lastStatus: Date.now() })

        await db.collection('messages').insertOne({ from: req.body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: new Date().toLocaleTimeString() })

        return res.sendStatus(201);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
});

app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection('participants').find().toArray();
        const messages = await db.collection('messages').find().toArray();
        return res.status(200).send(participants);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
});


app.post("/messages", async (req, res) => {
    console.log(req.header.user)
    try {
        await db.collection('messages').insertOne({ from: req.headers.user, to: req.body.to, text: req.body.text, type: req.body.type, time: new Date().toLocaleTimeString() })

        return res.sendStatus(200);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {

    const limit = parseInt(req.query.limit);

    try {
        const messages = await db.collection('messages').find().toArray();
        return res.status(200).send(messages);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
});



app.listen(5000, () => console.log("Servervidor ON na porta 5000"));

