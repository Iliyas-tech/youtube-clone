const express = require('express')
require('dotenv').config()

const app = express()
const port = 4000

app.get('/', (req, res) =>{
    res.send("Hello")
})

app.listen(process.env.PORT, ()=>{
    console.log(`Running on port ${port}`)
})