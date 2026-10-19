'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'pikavolley-ladder-secret';

router.get('/check-username', (req, res) => {
  const username = typeof req.query.username === 'string' ? req.query.username.trim() : '';
  if (!username) {
    return res.status(400).json({ error: '아이디를 입력해주세요' });
  }
  res.json({ available: !db.findUserByUsername(username) });
});

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요' });
  }
  if (username.length < 2 || username.length > 12) {
    return res.status(400).json({ error: '아이디는 2~12자로 입력해주세요' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '비밀번호는 4자 이상 입력해주세요' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  try {
    const user = db.createUser(username, passwordHash);
    const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username, lp: 0, wins: 0, losses: 0 } });
  } catch (err) {
    if (err.message === 'UNIQUE_VIOLATION') {
      res.status(400).json({ error: '이미 사용 중인 아이디입니다' });
    } else {
      res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요' });
  }

  const user = db.findUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    user: { id: user.id, username: user.username, lp: user.lp, wins: user.wins, losses: user.losses },
  });
});

module.exports = router;
