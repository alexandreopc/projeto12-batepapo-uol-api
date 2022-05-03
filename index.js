import express, { json } from "express";
import joi from "joi";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from 'dayjs';

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


const participantsSchema = joi.object({
    name: joi.string().required(),
})
const messagesSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required()
})


app.post("/participants", async (req, res) => {
    const validation = participantsSchema.validate(req.body, { abortEarly: false })
    if (validation.error) {
        return res.sendStatus(422);
    }
    const nomePresente = await db.collection('participants').findOne({ name: req.body.name })
    if (nomePresente) {
        return res.sendStatus(409);
    }

    try {
        await db.collection('participants').insertOne({ name: req.body.name, lastStatus: Date.now() })

        await db.collection('messages').insertOne({ from: req.body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format("HH:mm:ss") })

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
    const validation = messagesSchema.validate(req.body, { abortEarly: false })
    if (validation.error) {
        return res.sendStatus(422);
    }
    const nomePresente = await db.collection('participants').findOne({ name: req.headers.user })
    if (!nomePresente) {
        return res.sendStatus(422);
    }

    try {
        await db.collection('messages').insertOne({ from: req.headers.user, to: req.body.to, text: req.body.text, type: req.body.type, time: dayjs().format("HH:mm:ss") })
        return res.sendStatus(200);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {
    let limit = parseInt(req.query.limit);

    try {
        const messages = await db.collection('messages').find().toArray();
        const mensagensFiltradas = messages.filter(message => message.type === "message" || message.to === req.headers.user || message.to === "Todos" || message.from === req.headers.user)
        if (limit && limit < mensagensFiltradas.length) {
            limit = limit * -1;
            const mensagensLimitadas = mensagensFiltradas.slice(limit)

            return res.status(200).send(mensagensLimitadas);
        }
        return res.status(200).send(mensagensFiltradas);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
});


app.post("/status", async (req, res) => {
    try {
        const nomePresente = await db.collection('participants').findOne({ name: req.headers.user })
        if (!nomePresente) {
            return res.sendStatus(404);
        }
        await db.collection('participants').updateOne({ name: req.headers.user }, { $set: { lastStatus: Date.now() } })
        return res.sendStatus(200);
    } catch (e) {
        console.error(e);
        return res.sendStatus(404);
    }
})


async function removeUsuariosInativos() {
    try {
        const participants = await db.collection("participants").find().toArray();

        const usuariosInativos = participants.filter(participant => {
            if (Math.abs(participant.lastStatus - Date.now()) > 10000) {
                return true;
            }
        });

        for (let i = 0; i < usuariosInativos.length; i++) {
            await db.collection('participants').deleteOne({ name: usuariosInativos[i].name });
            await db.collection('messages').insertOne({
                from: usuariosInativos[i].name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
            });
        }
    } catch (e) {
        console.log(e);
    }
}
setInterval(() => removeUsuariosInativos(), 15000);

app.listen(5000, () => console.log("Servervidor ON na porta 5000"));