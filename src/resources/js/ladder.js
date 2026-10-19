'use strict';

import { pauseResumeManager, PauseResumePrecedence } from './ui.js';

const API_BASE = `http://${window.location.hostname}:4001`;

// Keep these breakpoints in sync with TIER_LP_TABLE in server/routes/game.js.
const TIERS = [
  { name: '아이언', min: 0, max: 39, color: '#8d99ae' },
  { name: '브론즈', min: 40, max: 79, color: '#cd7c50' },
  { name: '실버', min: 80, max: 119, color: '#adb5bd' },
  { name: '골드', min: 120, max: 159, color: '#e9c46a' },
  { name: '플래티넘', min: 160, max: 199, color: '#2ec4b6' },
  { name: '다이아', min: 200, max: 239, color: '#64dfdf' },
  { name: '마스터', min: 240, max: Infinity, color: '#e040fb' },
];

function getTierInfo(lp) {
  for (const tier of TIERS) {
    if (lp <= tier.max) return tier;
  }
  return TIERS[TIERS.length - 1];
}

function getToken() {
  return localStorage.getItem('pv-ladder-token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('pv-ladder-user'));
  } catch {
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem('pv-ladder-token', token);
  localStorage.setItem('pv-ladder-user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('pv-ladder-token');
  localStorage.removeItem('pv-ladder-user');
}

async function apiRequest(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    return await res.json();
  } catch {
    return { error: '서버에 연결할 수 없습니다' };
  }
}

function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('ladder-hidden');
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('ladder-hidden');
}

function updateUserDisplay(user) {
  const userInfo = document.getElementById('user-info');
  if (!userInfo) return;

  if (user) {
    const tier = getTierInfo(user.lp);
    const badge = document.getElementById('user-tier-badge');
    const name = document.getElementById('user-name-display');
    const lp = document.getElementById('user-lp-display');
    badge.textContent = tier.name;
    badge.style.backgroundColor = tier.color;
    name.textContent = user.username;
    lp.textContent = `${user.lp} LP`;
    userInfo.classList.remove('ladder-hidden');
    document.getElementById('logout-btn').classList.remove('ladder-hidden');
  } else {
    userInfo.classList.add('ladder-hidden');
    document.getElementById('logout-btn').classList.add('ladder-hidden');
  }
}

export function setUpLadderUI(pikaVolley) {
  if (!document.getElementById('auth-modal')) return;

  const user = getUser();
  if (!user) {
    showModal('auth-modal');
  } else {
    hideModal('auth-modal');
    updateUserDisplay(user);
  }

  // ── Auth modal ──────────────────────────────────────────
  let isLoginMode = true;
  const loginTabBtn = document.getElementById('login-tab-btn');
  const registerTabBtn = document.getElementById('register-tab-btn');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authError = document.getElementById('auth-error');
  const authUsernameInput = document.getElementById('auth-username');
  const authPasswordInput = document.getElementById('auth-password');
  const authGuestBtn = document.getElementById('auth-guest-btn');
  const authUsernameStatus = document.getElementById('auth-username-status');

  function setAuthMode(login) {
    isLoginMode = login;
    authSubmitBtn.textContent = login ? '로그인' : '회원가입';
    loginTabBtn.classList.toggle('active', login);
    registerTabBtn.classList.toggle('active', !login);
    authError.classList.add('ladder-hidden');
    authPasswordInput.value = '';
    if (authUsernameStatus) authUsernameStatus.classList.add('ladder-hidden');
  }

  loginTabBtn.addEventListener('click', () => setAuthMode(true));
  registerTabBtn.addEventListener('click', () => setAuthMode(false));

  // ── Live username availability check (register mode only) ──
  let usernameCheckTimer = null;
  let usernameCheckSeq = 0;
  if (authUsernameStatus) {
    authUsernameInput.addEventListener('input', () => {
      const username = authUsernameInput.value.trim();
      clearTimeout(usernameCheckTimer);

      if (isLoginMode || !username) {
        authUsernameStatus.classList.add('ladder-hidden');
        return;
      }
      if (username.length < 2 || username.length > 12) {
        authUsernameStatus.textContent = '아이디는 2~12자로 입력해주세요';
        authUsernameStatus.classList.remove('ladder-hidden', 'available', 'taken');
        authUsernameStatus.classList.add('taken');
        return;
      }

      authUsernameStatus.textContent = '확인 중...';
      authUsernameStatus.classList.remove('ladder-hidden', 'available', 'taken');
      const seq = ++usernameCheckSeq;

      usernameCheckTimer = setTimeout(async () => {
        const result = await apiRequest(`/auth/check-username?username=${encodeURIComponent(username)}`);
        if (seq !== usernameCheckSeq) return; // a newer check superseded this one
        if (result.error) {
          authUsernameStatus.classList.add('ladder-hidden');
          return;
        }
        authUsernameStatus.textContent = result.available ? '사용 가능한 아이디입니다' : '이미 사용 중인 아이디입니다';
        authUsernameStatus.classList.toggle('available', result.available);
        authUsernameStatus.classList.toggle('taken', !result.available);
      }, 400);
    });
  }

  authSubmitBtn.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value;
    if (!username || !password) {
      authError.textContent = '아이디와 비밀번호를 입력해주세요';
      authError.classList.remove('ladder-hidden');
      return;
    }
    authSubmitBtn.disabled = true;
    const result = isLoginMode
      ? await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      : await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    authSubmitBtn.disabled = false;

    if (result.error) {
      authError.textContent = result.error;
      authError.classList.remove('ladder-hidden');
      return;
    }
    setSession(result.token, result.user);
    hideModal('auth-modal');
    updateUserDisplay(result.user);
  });

  [authUsernameInput, authPasswordInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') authSubmitBtn.click();
    });
  });

  authGuestBtn && authGuestBtn.addEventListener('click', () => hideModal('auth-modal'));

  const authCloseBtn = document.getElementById('auth-modal-close-btn');
  authCloseBtn && authCloseBtn.addEventListener('click', () => hideModal('auth-modal'));

  // ── Logout ──────────────────────────────────────────────
  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession();
    updateUserDisplay(null);
    authUsernameInput.value = '';
    authPasswordInput.value = '';
    authError.classList.add('ladder-hidden');
    setAuthMode(true);

    // End whatever game is in progress and force the game back to a clean,
    // unpaused intro state, regardless of what (if anything) currently holds the pause.
    pikaVolley._p2Username = null;
    p2PasswordInput.value = '';
    hideModal('p2-modal');
    hideModal('result-modal');
    pikaVolley.restart();
    pauseResumeManager.reset(pikaVolley);

    showModal('auth-modal');
  });

  // ── Leaderboard ─────────────────────────────────────────
  document.getElementById('leaderboard-btn').addEventListener('click', async () => {
    showModal('leaderboard-modal');
    const content = document.getElementById('leaderboard-content');
    content.innerHTML = '<p style="text-align:center;padding:16px">로딩 중...</p>';

    const data = await apiRequest('/leaderboard');
    if (data.error || !Array.isArray(data)) {
      content.innerHTML = '<p style="text-align:center;color:#e63946;padding:16px">불러오기 실패</p>';
      return;
    }
    if (data.length === 0) {
      content.innerHTML = '<p style="text-align:center;padding:16px">아직 기록이 없습니다</p>';
      return;
    }

    const rows = data
      .map((p, i) => {
        const tier = getTierInfo(p.lp);
        const total = p.wins + p.losses;
        const rate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
        return `<tr>
          <td>${i + 1}</td>
          <td><strong>${p.username}</strong></td>
          <td><span class="tier-badge" style="background:${tier.color}">${tier.name}</span></td>
          <td>${p.lp} LP</td>
          <td>${p.wins}승 ${p.losses}패</td>
          <td>${rate}%</td>
        </tr>`;
      })
      .join('');

    content.innerHTML = `
      <table class="leaderboard-table">
        <thead><tr><th>순위</th><th>닉네임</th><th>티어</th><th>LP</th><th>전적</th><th>승률</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  });

  document.getElementById('leaderboard-close-btn').addEventListener('click', () => {
    hideModal('leaderboard-modal');
  });

  // ── P2 modal (before friend game) ───────────────────────
  pikaVolley.onBeforeWithFriendGame = () => {
    // pikaVolley itself already set paused = true before invoking this callback;
    // register that pause with the manager so dropdown/messageBox interactions
    // elsewhere in the UI can no longer resume the game out from under this modal.
    pauseResumeManager.pause(pikaVolley, PauseResumePrecedence.ladder);
    if (!getUser()) {
      pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.ladder);
      return;
    }
    document.getElementById('p2-username').value = '';
    document.getElementById('p2-password').value = '';
    document.getElementById('p2-error').classList.add('ladder-hidden');
    showModal('p2-modal');
  };

  const p2ConfirmBtn = document.getElementById('p2-confirm-btn');
  const p2CancelBtn = document.getElementById('p2-cancel-btn');
  const p2Input = document.getElementById('p2-username');
  const p2PasswordInput = document.getElementById('p2-password');
  const p2Error = document.getElementById('p2-error');

  p2ConfirmBtn.addEventListener('click', async () => {
    const p2Name = p2Input.value.trim();
    const p2Password = p2PasswordInput.value;
    if (!p2Name || !p2Password) {
      p2Error.textContent = '상대방 아이디와 비밀번호를 입력해주세요';
      p2Error.classList.remove('ladder-hidden');
      return;
    }
    const currentUser = getUser();
    if (currentUser && p2Name === currentUser.username) {
      p2Error.textContent = '자기 자신과는 대결할 수 없습니다';
      p2Error.classList.remove('ladder-hidden');
      return;
    }

    p2ConfirmBtn.disabled = true;
    // Verify P2 actually owns this account (and that it exists) by checking their
    // password, the same way login does. The token returned is discarded here —
    // this call is only used to confirm the credentials, never to replace P1's session.
    const verifyResult = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: p2Name, password: p2Password }),
    });
    p2ConfirmBtn.disabled = false;

    if (verifyResult.error || !verifyResult.token) {
      p2Error.textContent = '상대방 아이디 또는 비밀번호가 올바르지 않습니다';
      p2Error.classList.remove('ladder-hidden');
      p2PasswordInput.value = '';
      return;
    }

    pikaVolley._p2Username = p2Name;
    p2PasswordInput.value = '';
    hideModal('p2-modal');
    pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.ladder);
  });

  p2CancelBtn.addEventListener('click', () => {
    pikaVolley._p2Username = null;
    p2PasswordInput.value = '';
    hideModal('p2-modal');
    pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.ladder);
  });

  [p2Input, p2PasswordInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') p2ConfirmBtn.click();
    });
  });

  // ── Game end result ──────────────────────────────────────
  pikaVolley.onGameEnd = async (player1Won, isWithFriend) => {
    if (!isWithFriend) return;
    const currentUser = getUser();
    if (!currentUser || !pikaVolley._p2Username) return;

    pauseResumeManager.pause(pikaVolley, PauseResumePrecedence.ladder);

    // snapshot before the await: nothing else may clear it out from under this request
    const p2Username = pikaVolley._p2Username;
    const result = await apiRequest('/game/result', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ player2Username: p2Username, player1Won }),
    });

    if (result.error) {
      console.error('랭킹 저장 실패:', result.error);
      alert(`랭킹 저장 실패: ${result.error}`);
      pikaVolley._p2Username = null;
      pikaVolley.returnToMenuAfterGame();
      pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.ladder);
      return;
    }

    if (result.player1) {
      setSession(getToken(), { ...currentUser, lp: result.player1.newLp });
      updateUserDisplay({ ...currentUser, lp: result.player1.newLp });
    }

    const title = document.getElementById('result-title');
    const p1Row = document.getElementById('result-p1');
    const p2Row = document.getElementById('result-p2');

    title.textContent = player1Won
      ? `${result.player1.username} 승리!`
      : `${result.player2.username} 승리!`;

    function buildRow(info) {
      const tier = getTierInfo(info.newLp);
      const sign = info.lpChange >= 0 ? '+' : '';
      const cls = info.lpChange >= 0 ? 'positive' : 'negative';
      return `
        <span class="result-player-name">${info.username}</span>
        <span class="tier-badge" style="background:${tier.color}">${tier.name}</span>
        <span class="result-lp">${info.newLp} LP
          <span class="lp-change ${cls}">(${sign}${info.lpChange})</span>
        </span>`;
    }

    p1Row.innerHTML = buildRow(result.player1);
    p2Row.innerHTML = buildRow(result.player2);
    showModal('result-modal');
  };

  document.getElementById('result-close-btn').addEventListener('click', () => {
    hideModal('result-modal');
    pikaVolley._p2Username = null;
    pikaVolley.returnToMenuAfterGame();
    pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.ladder);
  });
}
