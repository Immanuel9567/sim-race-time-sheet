'use strict';
/* ── AUTH.JS — User accounts, sessions, role system ─────────── */

const SUPERUSER = { username:'Immanuel', password:'teamsrn' };
const KEYS = {
  users:'srn_users', session:'srn_session',
  times:'srn_times', events:'srn_events', activity:'srn_activity'
};

const GAMES = [
  { id:'ac',  name:'Assetto Corsa',          icon:'🏎️' },
  { id:'acc', name:'Assetto Corsa Competizione', icon:'🏁' },
  { id:'pmr', name:'Project Motor Racing',   icon:'🚗' },
  { id:'aso', name:'Assoluto Racing',        icon:'📱' },
  { id:'ir',  name:'iRacing',               icon:'🛞' },
  { id:'lmu', name:'Le Mans Ultimate',       icon:'🏆' },
  { id:'f1',  name:'Formula 1',             icon:'🔴' },
];

/* ── STORAGE HELPERS ────────────────────────────────────────── */
const DB = {
  get: k  => JSON.parse(localStorage.getItem(k) || 'null'),
  set: (k,v) => localStorage.setItem(k, JSON.stringify(v)),
};

function getUsers()   { return DB.get(KEYS.users)   || []; }
function saveUsers(u) { DB.set(KEYS.users, u); }
function getSession() { return DB.get(KEYS.session); }
function saveSession(s){ DB.set(KEYS.session, s); }
function clearSession(){ localStorage.removeItem(KEYS.session); }

/* ── SEED SUPERUSER ─────────────────────────────────────────── */
function seedSuperuser() {
  let users = getUsers();
  if (!users.find(u => u.username === SUPERUSER.username)) {
    users.push({
      id: 'su_1',
      username: SUPERUSER.username,
      password: SUPERUSER.password,
      role: 'superuser',
      gameRoles: {},     // { gameId: 'admin' }
      status: 'active',
      joined: Date.now(),
      joinedGames: Object.fromEntries(GAMES.map(g=>[g.id,'approved'])),
    });
    saveUsers(users);
  }
}

/* ── AUTH FUNCTIONS ─────────────────────────────────────────── */
function register(username, password) {
  username = username.trim();
  if (!username || !password) return { ok:false, msg:'Username and password required.' };
  if (password.length < 6)   return { ok:false, msg:'Password must be at least 6 characters.' };
  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return { ok:false, msg:'Username already taken.' };
  const user = {
    id: uid(),
    username,
    password,              // plaintext — fine for localStorage-only app
    role: 'member',
    gameRoles: {},
    status: 'active',
    joined: Date.now(),
    joinedGames: {},       // gameId → 'pending'|'approved'|'declined'
  };
  users.push(user);
  saveUsers(users);
  return { ok:true, user };
}

function login(username, password) {
  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (!user) return { ok:false, msg:'Incorrect username or password.' };
  saveSession({ id:user.id, username:user.username });
  return { ok:true, user };
}

function logout() { clearSession(); }

function currentUser() {
  const sess = getSession();
  if (!sess) return null;
  return getUsers().find(u => u.id === sess.id) || null;
}

function isSuperuser(user) { return user && user.role === 'superuser'; }
function isGameAdmin(user, gameId) {
  return user && (user.role === 'superuser' || user.gameRoles?.[gameId] === 'admin');
}
function hasJoined(user, gameId) {
  return user && (user.role === 'superuser' || user.joinedGames?.[gameId] === 'approved');
}

/* ── USER MANAGEMENT (superuser) ────────────────────────────── */
function setUserRole(userId, role) {
  const users = getUsers();
  const u = users.find(u=>u.id===userId);
  if (u) { u.role = role; saveUsers(users); }
}
function setGameAdmin(userId, gameId, isAdmin) {
  const users = getUsers();
  const u = users.find(u=>u.id===userId);
  if (u) {
    u.gameRoles = u.gameRoles || {};
    if (isAdmin) u.gameRoles[gameId] = 'admin';
    else delete u.gameRoles[gameId];
    saveUsers(users);
  }
}
function approveJoin(userId, gameId) {
  const users = getUsers();
  const u = users.find(u=>u.id===userId);
  if (u) { u.joinedGames[gameId] = 'approved'; saveUsers(users); }
}
function declineJoin(userId, gameId) {
  const users = getUsers();
  const u = users.find(u=>u.id===userId);
  if (u) { u.joinedGames[gameId] = 'declined'; saveUsers(users); }
}

/* ── JOIN GAME (member requests) ────────────────────────────── */
function requestJoin(gameId) {
  const user = currentUser();
  if (!user) return { ok:false, msg:'Log in first.' };
  const users = getUsers();
  const u = users.find(u=>u.id===user.id);
  if (!u.joinedGames) u.joinedGames = {};
  if (u.joinedGames[gameId] === 'approved') return { ok:false, msg:'Already a member.' };
  u.joinedGames[gameId] = 'pending';
  saveUsers(users);
  return { ok:true };
}

/* ── UTILITY ─────────────────────────────────────────────────── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── INIT ────────────────────────────────────────────────────── */
seedSuperuser();
