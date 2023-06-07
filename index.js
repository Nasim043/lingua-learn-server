const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()

// middlewarea
app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send('Summer camp is running!')
})

app.listen(3000, () => {
    console.log('Example app listening on port 3000!')
})