'use strict';
/* ── AUTH.JS — Accounts, sessions, roles, presence, notifications */

const SUPERUSER = { username:'Immanuel', password:'teamsrn' };
const KEYS = {
  users:'srn_users', session:'srn_session',
  times:'srn_times', events:'srn_events', activity:'srn_activity',
  presence:'srn_presence', notifs:'srn_notifs',
};
const ONLINE_THRESHOLD = 90000; // 90s

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
  get:   k     => JSON.parse(localStorage.getItem(k) || 'null'),
  set:   (k,v) => localStorage.setItem(k, JSON.stringify(v)),
  del:   k     => localStorage.removeItem(k),
};
function getUsers()    { return DB.get(KEYS.users)    || []; }
function saveUsers(u)  { DB.set(KEYS.users, u); }
function getSession()  { return DB.get(KEYS.session); }
function saveSession(s){ DB.set(KEYS.session, s); }
function clearSession(){ DB.del(KEYS.session); }

/* ── ONE-TIME RESET ─────────────────────────────────────────── */
if (!localStorage.getItem('srn_reset_v1')) {
  ['srn_users','srn_session','srn_presence','srn_activity','srn_notifs'].forEach(k=>localStorage.removeItem(k));
  localStorage.setItem('srn_reset_v1','done');
}

/* ── PRESENCE ────────────────────────────────────────────────── */
function getPresence()   { return DB.get(KEYS.presence) || {}; }
function savePresence(p) { DB.set(KEYS.presence, p); }

function heartbeat() {
  const sess = getSession(); if (!sess) return;
  const p = getPresence(); p[sess.id] = Date.now(); savePresence(p);
}
function isOnline(uid) {
  const p = getPresence(); return !!(p[uid] && Date.now()-p[uid] < ONLINE_THRESHOLD);
}
function lastSeen(uid) {
  const p = getPresence(); if (!p[uid]) return 'Never';
  const d = Date.now()-p[uid];
  if (d < ONLINE_THRESHOLD) return 'Online';
  const s = Math.floor(d/1000);
  if (s < 3600)  return Math.floor(s/60)+'m ago';
  if (s < 86400) return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';
}

/* ── NOTIFICATIONS ───────────────────────────────────────────── */
function getAllNotifs()       { return DB.get(KEYS.notifs) || {}; }
function getUserNotifs(uid)   { return (getAllNotifs())[uid] || []; }
function saveAllNotifs(n)     { DB.set(KEYS.notifs, n); }

// Push a notification to every approved member of a game (or all games)
function pushNotifToMembers(msg, type='activity', gameId=null) {
  const users  = getUsers();
  const all    = getAllNotifs();
  const entry  = { id:uid(), msg, type, ts:Date.now(), read:false };
  users.forEach(u => {
    // Send to all active users; if gameId set, only members of that game
    const relevant = !gameId || u.role==='superuser'
      || u.joinedGames?.[gameId]==='approved'
      || Object.keys(u.gameRoles||{}).includes(gameId);
    if (!relevant) return;
    if (!all[u.id]) all[u.id]=[];
    all[u.id].unshift(entry);
    if (all[u.id].length>50) all[u.id]=all[u.id].slice(0,50);
  });
  saveAllNotifs(all);
}

function markNotifsRead(uid) {
  const all = getAllNotifs();
  if (all[uid]) all[uid].forEach(n=>n.read=true);
  saveAllNotifs(all);
}

function unreadCount(uid) {
  return getUserNotifs(uid).filter(n=>!n.read).length;
}

/* ── SEED SUPERUSER ──────────────────────────────────────────── */
function seedSuperuser() {
  const users = getUsers();
  if (!users.find(u => u.username===SUPERUSER.username)) {
    users.push({
      id:'su_1', username:SUPERUSER.username, password:SUPERUSER.password,
      role:'superuser', gameRoles:{}, status:'active', joined:Date.now(),
      joinedGames:Object.fromEntries(GAMES.map(g=>[g.id,'approved'])),
      profile:{ bio:'', color:'#e8f020', displayName:'' },
    });
    saveUsers(users);
  }
}

/* ── AUTH ────────────────────────────────────────────────────── */
function register(username, password) {
  username = username.trim();
  if (!username || !password) return { ok:false, msg:'Username and password required.' };
  if (password.length < 6)   return { ok:false, msg:'Password must be at least 6 characters.' };
  if (username.toLowerCase()===SUPERUSER.username.toLowerCase()) return { ok:false, msg:'Username not available.' };
  const users = getUsers();
  if (users.find(u=>u.username.toLowerCase()===username.toLowerCase()))
    return { ok:false, msg:'Username already taken.' };
  const user = {
    id:uid(), username, password, role:'member', gameRoles:{}, status:'active',
    joined:Date.now(), joinedGames:{},
    profile:{ bio:'', color:'#e8f020', displayName:'' },
    isNew:true, // triggers welcome screen
  };
  users.push(user);
  saveUsers(users);
  return { ok:true, user };
}

function login(username, password) {
  const users = getUsers();
  const user  = users.find(u=>u.username.toLowerCase()===username.toLowerCase()&&u.password===password);
  if (!user) return { ok:false, msg:'Incorrect username or password.' };
  saveSession({ id:user.id, username:user.username });
  heartbeat();
  return { ok:true, user };
}

function logout() { heartbeat(); clearSession(); }

function currentUser() {
  const sess = getSession(); if (!sess) return null;
  return getUsers().find(u=>u.id===sess.id) || null;
}

/* ── PROFILE UPDATE ──────────────────────────────────────────── */
function updateProfile(userId, fields) {
  const users = getUsers();
  const u = users.find(u=>u.id===userId); if (!u) return;
  u.profile = { ...(u.profile||{}), ...fields };
  saveUsers(users);
}

function clearNewFlag(userId) {
  const users = getUsers();
  const u = users.find(u=>u.id===userId); if (!u) return;
  delete u.isNew; saveUsers(users);
}

/* ── ROLE HELPERS ────────────────────────────────────────────── */
function isSuperuser(user)         { return user?.role==='superuser'; }
function isGameAdmin(user, gameId) { return user&&(user.role==='superuser'||user.gameRoles?.[gameId]==='admin'); }
function hasJoined(user, gameId)   { return user&&(user.role==='superuser'||user.joinedGames?.[gameId]==='approved'); }

/* ── USER MANAGEMENT ─────────────────────────────────────────── */
function setGameAdmin(userId, gameId, on) {
  const users=getUsers(), u=users.find(u=>u.id===userId); if(!u) return;
  u.gameRoles=u.gameRoles||{};
  if(on) u.gameRoles[gameId]='admin'; else delete u.gameRoles[gameId];
  saveUsers(users);
}
function approveJoin(userId, gameId) {
  const users=getUsers(), u=users.find(u=>u.id===userId); if(!u) return;
  u.joinedGames=u.joinedGames||{}; u.joinedGames[gameId]='approved'; saveUsers(users);
  // Notify the approved member
  const all=getAllNotifs();
  const game=GAMES.find(g=>g.id===gameId);
  if(!all[userId]) all[userId]=[];
  all[userId].unshift({id:uid(),msg:`✅ Your request to join ${game?.name||gameId} was approved!`,type:'approval',ts:Date.now(),read:false});
  saveAllNotifs(all);
}
function declineJoin(userId, gameId) {
  const users=getUsers(), u=users.find(u=>u.id===userId); if(!u) return;
  u.joinedGames[gameId]='declined'; saveUsers(users);
}
function requestJoin(gameId) {
  const user=currentUser(); if(!user) return { ok:false, msg:'Log in first.' };
  const users=getUsers(), u=users.find(u=>u.id===user.id); if(!u) return { ok:false };
  u.joinedGames=u.joinedGames||{};
  if(u.joinedGames[gameId]==='approved') return { ok:false, msg:'Already a member.' };
  u.joinedGames[gameId]='pending'; saveUsers(users);
  return { ok:true };
}

/* ── UTILS ───────────────────────────────────────────────────── */
function uid()       { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function esc(s)      { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function initials(n) { return n.trim().split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function timeAgo(ts) {
  const s=Math.floor((Date.now()-ts)/1000);
  return s<60?'just now':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':Math.floor(s/86400)+'d ago';
}

/* ── INIT ────────────────────────────────────────────────────── */
seedSuperuser();
setInterval(heartbeat, 30000);
