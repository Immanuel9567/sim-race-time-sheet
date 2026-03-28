'use strict';
/* ── HUB.JS — Home page logic ────────────────────────────────── */

/* ── TOAST ──────────────────────────────────────────────────── */
function toast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show '+type;
  clearTimeout(t._t); t._t = setTimeout(()=>t.className='', 3200);
}

/* ── AUTH UI ────────────────────────────────────────────────── */
function openAuthModal()  { document.getElementById('authModal').classList.add('open'); switchTab('login'); }
function closeAuthModal() { document.getElementById('authModal').classList.remove('open'); clearAuthErrors(); }
function clearAuthErrors(){ ['loginError','regError'].forEach(id=>{ const el=document.getElementById(id); if(el){el.textContent='';el.style.display='none';} }); }

function switchTab(tab) {
  document.getElementById('formLogin').style.display    = tab==='login'    ? '' : 'none';
  document.getElementById('formRegister').style.display = tab==='register' ? '' : 'none';
  document.getElementById('tabLogin').classList.toggle('active',    tab==='login');
  document.getElementById('tabRegister').classList.toggle('active', tab==='register');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg; el.style.display = 'block';
}

function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const r = login(u, p);
  if (!r.ok) { showError('loginError', r.msg); return; }
  closeAuthModal();
  renderPage();
  toast(`Welcome back, ${r.user.username}!`);
}

function doRegister() {
  const u  = document.getElementById('regUser').value.trim();
  const p  = document.getElementById('regPass').value;
  const p2 = document.getElementById('regPass2').value;
  if (p !== p2) { showError('regError','Passwords do not match.'); return; }
  const r = register(u, p);
  if (!r.ok) { showError('regError', r.msg); return; }
  login(u, p);
  closeAuthModal();
  renderPage();
  toast(`Welcome, ${u}! Browse games and request to join.`);
}

function doLogout() { logout(); renderPage(); toast('Logged out.'); }

/* ── ENTER KEY SUPPORT ───────────────────────────────────────── */
['loginUser','loginPass'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
});
['regUser','regPass','regPass2'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('keydown', e => { if(e.key==='Enter') doRegister(); });
});

/* ── AUTH BUTTON ────────────────────────────────────────────── */
document.getElementById('authBtn').addEventListener('click', () => {
  const user = currentUser();
  if (user) { doLogout(); }
  else openAuthModal();
});

/* ── MODAL BACKDROP ─────────────────────────────────────────── */
document.querySelectorAll('.modal-overlay').forEach(o =>
  o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); })
);

/* ── GLOBAL STATS ────────────────────────────────────────────── */
function renderGlobalStats() {
  const allTimes  = JSON.parse(localStorage.getItem(KEYS.times)  || '[]');
  const allEvents = JSON.parse(localStorage.getItem(KEYS.events) || '[]');
  const racers    = new Set(allTimes.map(t=>t.driver?.toLowerCase())).size;
  document.getElementById('gStatRacers').textContent = getUsers().filter(u=>u.role!=='superuser'||true).length;
  document.getElementById('gStatEvents').textContent = allEvents.length;
  document.getElementById('gStatTimes').textContent  = allTimes.length;
}

/* ── GAMES GRID ──────────────────────────────────────────────── */
function renderGames() {
  const user  = currentUser();
  const grid  = document.getElementById('gamesGrid');
  const allEvents = JSON.parse(localStorage.getItem(KEYS.events) || '[]');
  const allTimes  = JSON.parse(localStorage.getItem(KEYS.times)  || '[]');

  grid.innerHTML = GAMES.map(g => {
    const gameEvents = allEvents.filter(e=>e.gameId===g.id);
    const gameTimes  = allTimes.filter(t=>t.gameId===g.id);
    const liveCount  = gameEvents.filter(e=>e.status==='live'||e.status==='open').length;
    const status     = liveCount ? `${liveCount} active event${liveCount>1?'s':''}` : 'No active events';

    let joinState = 'browse'; // default: visitor
    if (user) {
      if (isSuperuser(user)) joinState = 'member';
      else joinState = user.joinedGames?.[g.id] || 'none';
    }

    const badge = joinState==='approved'||joinState==='member'
      ? `<span class="badge badge-open">Member</span>`
      : joinState==='pending'
      ? `<span class="badge badge-closed">Pending</span>`
      : '';

    const action = joinState==='approved'||joinState==='member'
      ? `<a href="game.html?g=${g.id}" class="btn btn-primary btn-sm">Enter</a>`
      : joinState==='pending'
      ? `<span class="btn btn-ghost btn-sm" style="opacity:.5;cursor:default">Awaiting approval</span>`
      : user
      ? `<button class="btn btn-ghost btn-sm" onclick="joinGame('${g.id}')">Request to Join</button><a href="game.html?g=${g.id}" class="btn btn-ghost btn-sm">Browse</a>`
      : `<button class="btn btn-ghost btn-sm" onclick="openAuthModal()">Log In to Join</button><a href="game.html?g=${g.id}" class="btn btn-ghost btn-sm">Browse</a>`;

    return `<article class="card game-card">
      <div class="game-icon">${g.icon}</div>
      <div class="game-info">
        <h4>${esc(g.name)}</h4>
        <p class="card-meta">${status} · ${gameTimes.length} time${gameTimes.length!==1?'s':''}</p>
      </div>
      <div class="card-foot">
        <div style="display:flex;gap:6px;align-items:center">${badge}</div>
        <div style="display:flex;gap:6px">${action}</div>
      </div>
    </article>`;
  }).join('');
}

function joinGame(gameId) {
  const r = requestJoin(gameId);
  if (r.ok) { toast('Join request sent! Awaiting admin approval.'); renderPage(); }
  else toast(r.msg, 'error');
}

/* ── WELCOME BAR ─────────────────────────────────────────────── */
function renderWelcome() {
  const user = currentUser();
  const bar  = document.getElementById('userWelcome');
  if (!user) { bar.style.display='none'; return; }

  const roleLabel = user.role==='superuser' ? '⚡ Superuser'
    : Object.keys(user.gameRoles||{}).length ? '🛡 Game Admin' : '🏎 Member';

  bar.style.display = 'block';
  bar.innerHTML = `<div class="welcome-inner">
    <span>Logged in as <strong>${esc(user.username)}</strong> <span class="badge badge-open" style="font-size:10px">${roleLabel}</span></span>
    <button class="btn btn-ghost btn-sm" onclick="doLogout()">Log Out</button>
  </div>`;
}

/* ── SUPERUSER PANEL ─────────────────────────────────────────── */
function renderSuperuserPanel() {
  const user = currentUser();
  const panel = document.getElementById('suPanel');
  if (!user || !isSuperuser(user)) { panel.style.display='none'; return; }
  panel.style.display = 'block';
  renderUserList();
  renderPendingRequests();
}

function renderUserList() {
  const users = getUsers().filter(u=>u.role!=='superuser'||u.username!==SUPERUSER.username);
  const list  = document.getElementById('userList');
  if (!users.length) { list.innerHTML='<div class="empty-state" style="padding:20px">No users yet.</div>'; return; }

  list.innerHTML = users.map(u => {
    const isAdminSomewhere = Object.keys(u.gameRoles||{}).length > 0;
    const gameAdminBadges = GAMES.map(g =>
      `<label class="game-admin-toggle" title="${g.name}">
        <input type="checkbox" ${u.gameRoles?.[g.id]==='admin'?'checked':''} onchange="toggleGameAdmin('${u.id}','${g.id}',this.checked)">
        ${g.icon} ${g.name}
      </label>`
    ).join('');

    return `<div class="user-row">
      <div class="driver-info">
        <div class="avatar">${initials(u.username)}</div>
        <div>
          <div style="font-weight:600">${esc(u.username)}</div>
          <div class="sm muted">Joined ${timeAgo(u.joined)}</div>
        </div>
      </div>
      <div class="user-controls">
        <div class="game-admin-grid">${gameAdminBadges}</div>
      </div>
    </div>`;
  }).join('');
}

function toggleGameAdmin(userId, gameId, on) {
  setGameAdmin(userId, gameId, on);
  toast(on ? 'Admin role granted.' : 'Admin role removed.');
}

function renderPendingRequests() {
  const users = getUsers();
  const list  = document.getElementById('pendingList');
  const reqs  = [];
  users.forEach(u => {
    Object.entries(u.joinedGames||{}).forEach(([gid, status]) => {
      if (status==='pending') {
        const game = GAMES.find(g=>g.id===gid);
        reqs.push({ user:u, gameId:gid, gameName:game?.name||gid });
      }
    });
  });

  if (!reqs.length) { list.innerHTML='<div class="empty-state" style="padding:20px">No pending requests.</div>'; return; }

  list.innerHTML = reqs.map(r => `
    <div class="user-row">
      <div class="driver-info">
        <div class="avatar">${initials(r.user.username)}</div>
        <div><div style="font-weight:600">${esc(r.user.username)}</div><div class="sm muted">wants to join ${esc(r.gameName)}</div></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="approveMember('${r.user.id}','${r.gameId}')">Approve</button>
        <button class="btn btn-danger  btn-sm" onclick="declineMember('${r.user.id}','${r.gameId}')">Decline</button>
      </div>
    </div>`).join('');
}

function approveMember(uid, gid) { approveJoin(uid, gid); renderPage(); toast('Member approved!'); }
function declineMember(uid, gid) { declineJoin(uid, gid); renderPage(); toast('Request declined.','error'); }

/* ── RENDER PAGE ─────────────────────────────────────────────── */
function renderPage() {
  const user = currentUser();
  const authBtn = document.getElementById('authBtn');
  authBtn.textContent = user ? 'Log Out' : 'Log In';

  renderWelcome();
  renderGames();
  renderGlobalStats();
  renderSuperuserPanel();
}

/* ── PWA / NOTIFICATIONS ─────────────────────────────────────── */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(() => {
    // Only show install button if not already installed
    if (localStorage.getItem('srn_installed') === '1') return;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); window._installPrompt = e;
      document.getElementById('installBtn').style.display = 'inline-flex';
    });
    window.addEventListener('appinstalled', () => {
      localStorage.setItem('srn_installed','1');
      document.getElementById('installBtn').style.display = 'none';
    });
  }).catch(()=>{});
}

document.getElementById('notifBtn').addEventListener('click', async () => {
  if (!('Notification' in window)) return;
  const r = await Notification.requestPermission();
  if (r==='granted') { toast('🔔 Notifications enabled!'); document.getElementById('notifBtn').classList.add('notif-on'); }
  else toast('Notifications blocked in browser settings.','error');
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!window._installPrompt) return;
  window._installPrompt.prompt();
  const { outcome } = await window._installPrompt.userChoice;
  if (outcome==='accepted') {
    localStorage.setItem('srn_installed','1');
    document.getElementById('installBtn').style.display='none';
    toast('App installed!');
  }
  window._installPrompt = null;
});
if (typeof Notification!=='undefined' && Notification.permission==='granted')
  document.getElementById('notifBtn').classList.add('notif-on');

/* ── UTILS (local copies needed on hub page) ────────────────── */
function initials(n) { return n.trim().split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function timeAgo(ts) {
  const s = Math.floor((Date.now()-ts)/1000);
  return s<60?'just now':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':Math.floor(s/86400)+'d ago';
}

/* ── INIT ────────────────────────────────────────────────────── */
renderPage();
registerSW();
