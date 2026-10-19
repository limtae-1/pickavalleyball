'use strict';
const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Tier bands and per-tier LP gain/loss. Higher tiers gain less and lose more on
// their own record, so climbing gets progressively harder near the top (mirrors
// how competitive ladders like League of Legends slow down gains at high rank).
// Keep these breakpoints in sync with the TIERS table in src/resources/js/ladder.js.
const TIER_LP_TABLE = [
  { max: 39, win: 30, loss: -10 }, // 아이언
  { max: 79, win: 26, loss: -12 }, // 브론즈
  { max: 119, win: 22, loss: -14 }, // 실버
  { max: 159, win: 18, loss: -16 }, // 골드
  { max: 199, win: 15, loss: -18 }, // 플래티넘
  { max: 239, win: 12, loss: -20 }, // 다이아
  { max: Infinity, win: 10, loss: -22 }, // 마스터
];

function getLpChange(lp, won) {
  const tier = TIER_LP_TABLE.find((t) => lp <= t.max) || TIER_LP_TABLE[TIER_LP_TABLE.length - 1];
  return won ? tier.win : tier.loss;
}

router.post('/result', authMiddleware, (req, res) => {
  const { player2Username, player1Won } = req.body;
  const player1Id = req.user.id;

  if (!player2Username) {
    return res.status(400).json({ error: 'player2Username이 필요합니다' });
  }

  const player1 = db.findUserById(player1Id);
  const player2 = db.findUserByUsername(player2Username);

  if (!player2) {
    return res.status(404).json({ error: `'${player2Username}' 계정을 찾을 수 없습니다` });
  }
  if (player1.id === player2.id) {
    return res.status(400).json({ error: '자기 자신과 대결할 수 없습니다' });
  }

  const winnerId = player1Won ? player1.id : player2.id;
  const p1LpChange = getLpChange(player1.lp, player1Won);
  const p2LpChange = getLpChange(player2.lp, !player1Won);
  const newP1Lp = Math.max(0, player1.lp + p1LpChange);
  const newP2Lp = Math.max(0, player2.lp + p2LpChange);

  db.updateUserStats(player1.id, newP1Lp, player1Won ? 1 : 0, player1Won ? 0 : 1);
  db.updateUserStats(player2.id, newP2Lp, player1Won ? 0 : 1, player1Won ? 1 : 0);
  db.createGame(player1.id, player2.id, winnerId, p1LpChange, p2LpChange);

  res.json({
    player1: { username: player1.username, lpChange: p1LpChange, newLp: newP1Lp, won: player1Won },
    player2: { username: player2.username, lpChange: p2LpChange, newLp: newP2Lp, won: !player1Won },
  });
});

module.exports = router;
