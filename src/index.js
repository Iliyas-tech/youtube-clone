import dotenv from "dotenv"
import express from 'express'
const app = express();
import { connectDB } from './db/index.js'

connectDB();
/*
;(async ()=> {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("Connection not established with app", (err)=>{
            console.log("errr: ", err);
            throw err
        })

        app.listen(process.env.PORT, () => {
            console.log("Server listen on port", process.env.PORT);
        })
    }
    catch(err) {
        console.log('err: ', err);
        throw err;
    }
}) ()
*/