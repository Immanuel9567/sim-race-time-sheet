'use strict';
/* ── AUTH.JS — User accounts, sessions, roles, presence ─────── */

const SUPERUSER = { username:'Immanuel', password:'teamsrn' };
const KEYS = {
  users:'srn_users', session:'srn_session',
  times:'srn_times', events:'srn_events', activity:'srn_activity',
  presence:'srn_presence',
};
const ONLINE_THRESHOLD = 90 * 1000; // ms — within this = online

const GAMES = [
  { id:'ac',  name:'Assetto Corsa',              icon:'🏎️' },
  { id:'acc', name:'Assetto Corsa Competizione', icon:'🏁' },
  { id:'pmr', name:'Project Motor Racing',       icon:'🚗' },
  { id:'aso', name:'Assoluto Racing',            icon:'📱' },
  { id:'ir',  name:'iRacing',                   icon:'🛞' },
  { id:'lmu', name:'Le Mans Ultimate',           icon:'🏆' },
  { id:'f1',  name:'Formula 1',                 icon:'🔴' },
];

/* ── STORAGE ─────────────────────────────────────────────────── */
const DB = {
  get:   k   => JSON.parse(localStorage.getItem(k) || 'null'),
  set:   (k,v) => localStorage.setItem(k, JSON.stringify(v)),
  del:   k   => localStorage.removeItem(k),
};
function getUsers()    { return DB.get(KEYS.users)    || []; }
function saveUsers(u)  { DB.set(KEYS.users, u); }
function getSession()  { return DB.get(KEYS.session); }
function saveSession(s){ DB.set(KEYS.session, s); }
function clearSession(){ DB.del(KEYS.session); }

/* ── PRESENCE ────────────────────────────────────────────────── */
function getPresence()  { return DB.get(KEYS.presence) || {}; }
function savePresence(p){ DB.set(KEYS.presence, p); }

// Called on login and on a 30s interval while tab is open
function heartbeat() {
  const sess = getSession();
  if (!sess) return;
  const p = getPresence();
  p[sess.id] = Date.now();
  savePresence(p);
}

function isOnline(userId) {
  const p = getPresence();
  return p[userId] && (Date.now() - p[userId]) < ONLINE_THRESHOLD;
}

function lastSeen(userId) {
  const p = getPresence();
  if (!p[userId]) return 'Never';
  const diff = Date.now() - p[userId];
  if (diff < ONLINE_THRESHOLD) return 'Online';
  const s = Math.floor(diff / 1000);
  if (s < 3600)  return Math.floor(s/60)+'m ago';
  if (s < 86400) return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';
}

/* ── SEED SUPERUSER ──────────────────────────────────────────── */
function seedSuperuser() {
  const users = getUsers();
  if (!users.find(u => u.username === SUPERUSER.username)) {
    users.push({
      id: 'su_1',
      username: SUPERUSER.username,
      password: SUPERUSER.password,
      role: 'superuser',
      gameRoles: {},
      status: 'active',
      joined: Date.now(),
      joinedGames: Object.fromEntries(GAMES.map(g=>[g.id,'approved'])),
    });
    saveUsers(users);
  }
}

/* ── AUTH ────────────────────────────────────────────────────── */
function register(username, password) {
  username = username.trim();
  if (!username || !password) return { ok:false, msg:'Username and password required.' };
  if (password.length < 6)   return { ok:false, msg:'Password must be at least 6 characters.' };
  if (username.toLowerCase() === SUPERUSER.username.toLowerCase())
    return { ok:false, msg:'Username not available.' };
  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return { ok:false, msg:'Username already taken.' };
  const user = {
    id: uid(), username, password,
    role: 'member', gameRoles: {}, status: 'active',
    joined: Date.now(), joinedGames: {},
  };
  users.push(user);
  saveUsers(users);
  return { ok:true, user };
}

function login(username, password) {
  const users = getUsers();
  const user = users.find(u =>
    u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );
  if (!user) return { ok:false, msg:'Incorrect username or password.' };
  saveSession({ id:user.id, username:user.username });
  heartbeat(); // mark online immediately
  return { ok:true, user };
}

function logout() {
  // Mark last seen before clearing
  heartbeat();
  clearSession();
}

function currentUser() {
  const sess = getSession();
  if (!sess) return null;
  return getUsers().find(u => u.id === sess.id) || null;
}

/* ── ROLE HELPERS ────────────────────────────────────────────── */
function isSuperuser(user)         { return user?.role === 'superuser'; }
function isGameAdmin(user, gameId) { return user && (user.role==='superuser' || user.gameRoles?.[gameId]==='admin'); }
function hasJoined(user, gameId)   { return user && (user.role==='superuser' || user.joinedGames?.[gameId]==='approved'); }

/* ── USER MANAGEMENT ─────────────────────────────────────────── */
function setGameAdmin(userId, gameId, on) {
  const users = getUsers();
  const u = users.find(u=>u.id===userId); if(!u) return;
  u.gameRoles = u.gameRoles || {};
  if (on) u.gameRoles[gameId] = 'admin';
  else    delete u.gameRoles[gameId];
  saveUsers(users);
}

function approveJoin(userId, gameId) {
  const users = getUsers();
  const u = users.find(u=>u.id===userId); if(!u) return;
  u.joinedGames = u.joinedGames || {};
  u.joinedGames[gameId] = 'approved';
  saveUsers(users);
}

function declineJoin(userId, gameId) {
  const users = getUsers();
  const u = users.find(u=>u.id===userId); if(!u) return;
  u.joinedGames[gameId] = 'declined';
  saveUsers(users);
}

/* ── JOIN GAME ───────────────────────────────────────────────── */
function requestJoin(gameId) {
  const user = currentUser();
  if (!user) return { ok:false, msg:'Log in first.' };
  const users = getUsers();
  const u = users.find(u=>u.id===user.id); if(!u) return { ok:false, msg:'User not found.' };
  u.joinedGames = u.joinedGames || {};
  if (u.joinedGames[gameId]==='approved') return { ok:false, msg:'Already a member.' };
  u.joinedGames[gameId] = 'pending';
  saveUsers(users);
  return { ok:true };
}

/* ── UTILS ───────────────────────────────────────────────────── */
function uid()  { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function initials(n) { return n.trim().split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function timeAgo(ts) {
  const s=Math.floor((Date.now()-ts)/1000);
  return s<60?'just now':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':Math.floor(s/86400)+'d ago';
}

/* ── INIT ────────────────────────────────────────────────────── */
seedSuperuser();

// Heartbeat every 30s while tab is open
setInterval(heartbeat, 30000);
