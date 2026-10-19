'use strict';
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'pikavolley-data.json');

function load() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], games: [], nextUserId: 1, nextGameId: 1 };
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const db = {
  findUserById(id) {
    return load().users.find((u) => u.id === id) || null;
  },

  findUserByUsername(username) {
    return load().users.find((u) => u.username === username) || null;
  },

  createUser(username, passwordHash) {
    const data = load();
    if (data.users.find((u) => u.username === username)) {
      throw new Error('UNIQUE_VIOLATION');
    }
    const user = {
      id: data.nextUserId++,
      username,
      password_hash: passwordHash,
      lp: 0,
      wins: 0,
      losses: 0,
      created_at: new Date().toISOString(),
    };
    data.users.push(user);
    save(data);
    return user;
  },

  updateUserStats(id, newLp, wonDelta, lostDelta) {
    const data = load();
    const user = data.users.find((u) => u.id === id);
    if (user) {
      user.lp = newLp;
      user.wins += wonDelta;
      user.losses += lostDelta;
    }
    save(data);
  },

  createGame(player1Id, player2Id, winnerId, p1LpChange, p2LpChange) {
    const data = load();
    const game = {
      id: data.nextGameId++,
      player1_id: player1Id,
      player2_id: player2Id,
      winner_id: winnerId,
      player1_lp_change: p1LpChange,
      player2_lp_change: p2LpChange,
      played_at: new Date().toISOString(),
    };
    data.games.push(game);
    save(data);
    return game;
  },

  getLeaderboard(limit = 50) {
    const data = load();
    return [...data.users]
      .sort((a, b) => b.lp - a.lp || b.wins - a.wins)
      .slice(0, limit)
      .map(({ id, username, lp, wins, losses }) => ({ id, username, lp, wins, losses }));
  },
};

module.exports = db;
