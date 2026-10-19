'use strict';
const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json(db.getLeaderboard());
});

module.exports = router;
