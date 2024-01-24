import { app } from "./app.js"
import { connectDB } from './db/index.js'

const port = process.env.PORT || 8000

connectDB()
.then(()=>{
    app.listen(port, () =>{
        console.log(`Server is running on port , ${port}`);
    })
})
.catch((err)=>{
    console.log("Mongo DB connection failed!!!", err);
})

/*MongoConnection*/
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