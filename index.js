const connectDB = require('./src/database');
const bot = require('./src/bot');
const express = require('express');
require('dotenv').config();

const app = express();

app.get('/', (req, res) => {
  res.send('News Aggregator Bot is running');
});

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
