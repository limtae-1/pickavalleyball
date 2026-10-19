'use strict';
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/game', require('./routes/game'));
app.use('/leaderboard', require('./routes/leaderboard'));

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`피카츄배구 랭킹 서버: http://localhost:${PORT}`);
});
