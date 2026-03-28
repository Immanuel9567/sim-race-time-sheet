'use strict';
/* ── HUB.JS — Home page logic ────────────────────────────────── */

/* ── TOAST ──────────────────────────────────────────────────── */
function toast(msg, type='success') {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='show '+type;
  clearTimeout(t._t); t._t=setTimeout(()=>t.className='',3500);
}

/* ── NOTIF PANEL ─────────────────────────────────────────────── */
function openNotifPanel() {
  const user=currentUser(); if(!user) return;
  markNotifsRead(user.id);
  renderNotifPanel();
  document.getElementById('notifPanel').classList.add('open');
  updateNotifBadge();
}
function closeNotifPanel() { document.getElementById('notifPanel').classList.remove('open'); }

function renderNotifPanel() {
  const user=currentUser(); if(!user) return;
  const notifs=getUserNotifs(user.id);
  const list=document.getElementById('notifList');
  if (!notifs.length) { list.innerHTML='<div class="notif-empty">No notifications yet.</div>'; return; }
  list.innerHTML=notifs.map(n=>`
    <div class="notif-item ${n.read?'':'unread'} notif-${n.type}">
      <div class="notif-msg">${esc(n.msg)}</div>
      <div class="notif-time">${timeAgo(n.ts)}</div>
    </div>`).join('');
}

function updateNotifBadge() {
  const user=currentUser();
  const badge=document.getElementById('notifBadge');
  if (!user||!badge) return;
  const count=unreadCount(user.id);
  badge.textContent=count;
  badge.style.display=count?'flex':'none';
}

/* ── NOTIF HINT BAR ──────────────────────────────────────────── */
function renderNotifHint() {
  const bar=document.getElementById('notifHint');
  if (!bar) return;
  const user=currentUser();
  if (!user) { bar.style.display='none'; return; }
  if (!('Notification' in window)||Notification.permission==='granted') { bar.style.display='none'; return; }
  bar.style.display='flex';
}

/* ── AUTH UI ─────────────────────────────────────────────────── */
function openAuthModal()  { document.getElementById('authModal').classList.add('open'); switchTab('login'); }
function closeAuthModal() { document.getElementById('authModal').classList.remove('open'); clearAuthErrors(); }
function clearAuthErrors(){ ['loginError','regError'].forEach(id=>{ const el=document.getElementById(id); if(el){el.textContent='';el.style.display='none';} }); }

function switchTab(tab) {
  document.getElementById('formLogin').style.display    = tab==='login'    ? '' : 'none';
  document.getElementById('formRegister').style.display = tab==='register' ? '' : 'none';
  document.getElementById('tabLogin').classList.toggle('active',    tab==='login');
  document.getElementById('tabRegister').classList.toggle('active', tab==='register');
}
function showError(id, msg) { const el=document.getElementById(id); el.textContent=msg; el.style.display='block'; }

function doLogin() {
  const r=login(document.getElementById('loginUser').value.trim(), document.getElementById('loginPass').value);
  if (!r.ok) { showError('loginError',r.msg); return; }
  closeAuthModal(); renderPage(); toast(`Welcome back, ${r.user.username}!`);
}
function doRegister() {
  const u=document.getElementById('regUser').value.trim();
  const p=document.getElementById('regPass').value;
  const p2=document.getElementById('regPass2').value;
  if (p!==p2) { showError('regError','Passwords do not match.'); return; }
  const r=register(u,p);
  if (!r.ok) { showError('regError',r.msg); return; }
  login(u,p); closeAuthModal();
  renderPage();
  // Show welcome screen for new users
  openWelcomeScreen();
}
function doLogout() { logout(); renderPage(); toast('Logged out.'); }

/* ── WELCOME SCREEN ──────────────────────────────────────────── */
function openWelcomeScreen() {
  const user=currentUser(); if(!user) return;
  // Pre-check any games already pending/approved
  GAMES.forEach(g=>{
    const cb=document.getElementById('wg_'+g.id);
    if(cb) cb.checked=!!(user.joinedGames?.[g.id]);
  });
  document.getElementById('welcomeModal').classList.add('open');
}
function finishWelcome() {
  const user=currentUser(); if(!user) return;
  GAMES.forEach(g=>{
    const cb=document.getElementById('wg_'+g.id);
    if(cb&&cb.checked&&!user.joinedGames?.[g.id]) requestJoin(g.id);
  });
  clearNewFlag(user.id);
  document.getElementById('welcomeModal').classList.remove('open');
  renderPage();
  toast('Welcome! Your join requests have been sent.');
}

/* ── PROFILE MODAL ───────────────────────────────────────────── */
function openProfileModal() {
  const user=currentUser(); if(!user) return;
  document.getElementById('profDisplayName').value = user.profile?.displayName||'';
  document.getElementById('profBio').value          = user.profile?.bio||'';
  document.getElementById('profColor').value        = user.profile?.color||'#e8f020';
  document.getElementById('profileModal').classList.add('open');
}
function saveProfile() {
  const user=currentUser(); if(!user) return;
  updateProfile(user.id, {
    displayName: document.getElementById('profDisplayName').value.trim(),
    bio:         document.getElementById('profBio').value.trim(),
    color:       document.getElementById('profColor').value,
  });
  document.getElementById('profileModal').classList.remove('open');
  renderPage(); toast('Profile updated!');
}

/* ── KEYBOARD SUPPORT ────────────────────────────────────────── */
['loginUser','loginPass'].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();if(e.key==='Escape')closeAuthModal();});
});
['regUser','regPass','regPass2'].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.addEventListener('keydown',e=>{if(e.key==='Enter')doRegister();});
});

/* ── NAV BUTTONS ─────────────────────────────────────────────── */
document.getElementById('authBtn').addEventListener('click',()=>{
  currentUser() ? doLogout() : openAuthModal();
});
document.getElementById('bellBtn').addEventListener('click',()=>{
  const user=currentUser();
  if(!user){ openAuthModal(); return; }
  if(document.getElementById('notifPanel').classList.contains('open')) closeNotifPanel();
  else openNotifPanel();
});

/* ── MODAL BACKDROPS ─────────────────────────────────────────── */
document.querySelectorAll('.modal-overlay').forEach(o=>
  o.addEventListener('click',e=>{ if(e.target===o) o.classList.remove('open'); })
);

/* ── GLOBAL STATS ────────────────────────────────────────────── */
function renderGlobalStats() {
  const allTimes=DB.get(KEYS.times)||[], allEvents=DB.get(KEYS.events)||[];
  document.getElementById('gStatRacers').textContent = getUsers().length;
  document.getElementById('gStatEvents').textContent = allEvents.length;
  document.getElementById('gStatTimes').textContent  = allTimes.length;
}

/* ── GAMES GRID ──────────────────────────────────────────────── */
function renderGames() {
  const user=currentUser();
  const allEvents=DB.get(KEYS.events)||[], allTimes=DB.get(KEYS.times)||[];

  document.getElementById('gamesGrid').innerHTML = GAMES.map(g => {
    const liveCount=(allEvents.filter(e=>e.gameId===g.id&&(e.status==='live'||e.status==='open'))).length;
    const timesCount=allTimes.filter(t=>t.gameId===g.id).length;
    const status=liveCount?`${liveCount} active event${liveCount>1?'s':''}`:'No active events';

    let joinState='guest';
    if(user){ joinState = isSuperuser(user)?'approved':(user.joinedGames?.[g.id]||'none'); }

    const badge = joinState==='approved'?`<span class="badge badge-open">Member</span>`
      :joinState==='pending'?`<span class="badge badge-closed">Pending</span>`:'';

    const action = joinState==='approved'
      ?`<a href="game.html?g=${g.id}" class="btn btn-primary btn-sm">Enter</a>`
      :joinState==='pending'
      ?`<a href="game.html?g=${g.id}" class="btn btn-ghost btn-sm">Browse</a>`
      :joinState==='guest'
      ?`<button class="btn btn-ghost btn-sm" onclick="openAuthModal()">Log In to Join</button><a href="game.html?g=${g.id}" class="btn btn-ghost btn-sm">Browse</a>`
      :`<button class="btn btn-primary btn-sm" onclick="joinGame('${g.id}')">Request to Join</button><a href="game.html?g=${g.id}" class="btn btn-ghost btn-sm">Browse</a>`;

    return `<article class="card game-card">
      <div class="game-icon">${g.icon}</div>
      <div class="game-info"><h4>${esc(g.name)}</h4><p class="card-meta">${status} · ${timesCount} time${timesCount!==1?'s':''}</p></div>
      <div class="card-foot"><div>${badge}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${action}</div></div>
    </article>`;
  }).join('');
}

function joinGame(gid) {
  const r=requestJoin(gid);
  if(r.ok){ toast('Request sent! Awaiting admin approval.'); renderPage(); }
  else toast(r.msg,'error');
}

/* ── WELCOME BAR ─────────────────────────────────────────────── */
function renderWelcome() {
  const user=currentUser(), bar=document.getElementById('userWelcome');
  if (!user) { bar.style.display='none'; return; }
  const roleLabel=isSuperuser(user)?'⚡ Superuser':Object.keys(user.gameRoles||{}).length?'🛡 Admin':'🏎 Member';
  const displayName=user.profile?.displayName||user.username;
  bar.style.display='block';
  bar.innerHTML=`<div class="welcome-inner">
    <span>👋 <strong>${esc(displayName)}</strong>
      <span class="badge badge-open" style="font-size:10px;margin-left:6px">${roleLabel}</span></span>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost btn-sm" onclick="openProfileModal()">✏ Profile</button>
      <button class="btn btn-ghost btn-sm" onclick="doLogout()">Log Out</button>
    </div>
  </div>`;
}

/* ── PUBLIC MEMBERS LIST ─────────────────────────────────────── */
function renderMembersList() {
  const users=getUsers(), el=document.getElementById('membersGrid');
  if (!users.length) { el.innerHTML='<div class="empty-state">No members yet.</div>'; return; }

  const presence=getPresence();
  const sorted=[...users].sort((a,b)=>{
    const aOn=isOnline(a.id), bOn=isOnline(b.id);
    if(aOn&&!bOn) return -1; if(!aOn&&bOn) return 1;
    return (presence[b.id]||0)-(presence[a.id]||0);
  });

  el.innerHTML=sorted.map(u=>{
    const online=isOnline(u.id), seen=lastSeen(u.id);
    const color=u.profile?.color||'#e8f020';
    const displayName=u.profile?.displayName||u.username;
    const bio=u.profile?.bio?`<div class="member-bio">${esc(u.profile.bio)}</div>`:'';
    const roleTag=isSuperuser(u)?'<span class="member-role su">⚡ Superuser</span>'
      :Object.keys(u.gameRoles||{}).length?'<span class="member-role admin">🛡 Admin</span>'
      :'<span class="member-role">🏎 Member</span>';
    const gameChips=GAMES.filter(g=>u.role==='superuser'||u.joinedGames?.[g.id]==='approved')
      .map(g=>`<span class="game-chip" title="${g.name}">${g.icon}</span>`).join('');
    return `<div class="member-card ${online?'is-online':''}">
      <div class="member-card-top">
        <div class="presence-wrap">
          <div class="avatar" style="background:${color};color:#000">${initials(u.username)}</div>
          <span class="presence-dot ${online?'online':'offline'}"></span>
        </div>
        <div style="flex:1;min-width:0">
          <div class="member-name">${esc(displayName)}</div>
          <div class="member-seen">${seen}</div>
          ${bio}
        </div>
        ${roleTag}
      </div>
      <div class="member-games">${gameChips||'<span style="color:var(--muted);font-size:12px">No games yet</span>'}</div>
    </div>`;
  }).join('');
}

/* ── SUPERUSER PANEL ─────────────────────────────────────────── */
function renderSuperuserPanel() {
  const user=currentUser(), panel=document.getElementById('suPanel');
  if(!user||!isSuperuser(user)){ panel.style.display='none'; return; }
  panel.style.display='block';
  renderUserManagement(); renderPendingRequests();
}

function renderUserManagement() {
  const users=getUsers().filter(u=>!isSuperuser(u));
  const list=document.getElementById('userList');
  if(!users.length){ list.innerHTML='<div class="empty-state" style="padding:20px">No users yet.</div>'; return; }
  list.innerHTML=users.map(u=>{
    const online=isOnline(u.id), seen=lastSeen(u.id);
    const gameCols=GAMES.map(g=>{
      const isAdm=u.gameRoles?.[g.id]==='admin';
      return `<div class="su-game-cell">
        <span class="sm" style="color:var(--muted2)">${g.icon} ${g.name}</span>
        ${isAdm
          ?`<button class="btn btn-danger btn-sm" onclick="suRemoveAdmin('${u.id}','${g.id}')">Remove</button>`
          :`<button class="btn btn-ghost  btn-sm" onclick="suMakeAdmin('${u.id}','${g.id}')">Make Admin</button>`}
      </div>`;
    }).join('');
    const admGames=Object.keys(u.gameRoles||{}).filter(g=>u.gameRoles[g]==='admin');
    const roleBadge=admGames.length
      ?admGames.map(gid=>{const g=GAMES.find(x=>x.id===gid);return`<span class="badge badge-live">${g?g.icon:''} ${g?g.name:gid} Admin</span>`;}).join('')
      :`<span class="badge badge-closed">Member</span>`;
    return `<div class="su-user-block">
      <div class="su-user-header">
        <div class="presence-wrap">
          <div class="avatar" style="background:${u.profile?.color||'#e8f020'};color:#000">${initials(u.username)}</div>
          <span class="presence-dot ${online?'online':'offline'}"></span>
        </div>
        <div><div style="font-weight:700;font-size:15px">${esc(u.profile?.displayName||u.username)}</div>
          <div class="sm muted">@${esc(u.username)} · Joined ${timeAgo(u.joined)} · ${seen}</div></div>
        <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">${roleBadge}</div>
      </div>
      <div class="su-game-grid">${gameCols}</div>
    </div>`;
  }).join('');
}

function suMakeAdmin(uid,gid){ setGameAdmin(uid,gid,true); renderUserManagement(); renderMembersList(); toast('Admin role granted.'); }
function suRemoveAdmin(uid,gid){ setGameAdmin(uid,gid,false); renderUserManagement(); renderMembersList(); toast('Admin role removed.'); }

function renderPendingRequests() {
  const users=getUsers(), list=document.getElementById('pendingList'), reqs=[];
  users.forEach(u=>{ Object.entries(u.joinedGames||{}).forEach(([gid,status])=>{
    if(status==='pending'){ const game=GAMES.find(g=>g.id===gid); reqs.push({user:u,gameId:gid,gameName:game?.name||gid}); }
  });});
  const badge=document.getElementById('pendingBadge');
  if(badge){ badge.textContent=reqs.length+' pending'; badge.style.display=reqs.length?'':'none'; }
  if(!reqs.length){ list.innerHTML='<div class="empty-state" style="padding:20px">No pending requests.</div>'; return; }
  list.innerHTML=reqs.map(r=>`
    <div class="user-row">
      <div class="driver-info">
        <div class="avatar" style="background:${r.user.profile?.color||'#e8f020'};color:#000">${initials(r.user.username)}</div>
        <div><div style="font-weight:600">${esc(r.user.profile?.displayName||r.user.username)}</div>
          <div class="sm muted">wants to join ${esc(r.gameName)}</div></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="approveMember('${r.user.id}','${r.gameId}')">Approve</button>
        <button class="btn btn-danger  btn-sm" onclick="declineMember('${r.user.id}','${r.gameId}')">Decline</button>
      </div>
    </div>`).join('');
}

function approveMember(uid,gid){ approveJoin(uid,gid); renderPage(); toast('Member approved!'); }
function declineMember(uid,gid){ declineJoin(uid,gid); renderPage(); toast('Request declined.','error'); }

/* ── PANEL TOGGLE ────────────────────────────────────────────── */
function togglePanel(bodyId, chevronId) {
  const body=document.getElementById(bodyId), chevron=document.getElementById(chevronId);
  const open=body.style.display==='none';
  body.style.display=open?'':'none';
  if(chevron) chevron.style.transform=open?'rotate(180deg)':'';
}

/* ── RENDER PAGE ─────────────────────────────────────────────── */
function renderPage() {
  const user=currentUser();
  document.getElementById('authBtn').textContent=user?'Log Out':'Log In';
  renderWelcome(); renderGames(); renderGlobalStats();
  renderMembersList(); renderSuperuserPanel();
  updateNotifBadge(); renderNotifHint();
  // Auto-show welcome screen for new users
  if(user&&user.isNew) openWelcomeScreen();
}

/* ── PWA ─────────────────────────────────────────────────────── */
function registerSW() {
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(()=>{
    if(localStorage.getItem('srn_installed')==='1') return;
    window.addEventListener('beforeinstallprompt',e=>{
      e.preventDefault(); window._installPrompt=e;
      document.getElementById('installBtn').style.display='inline-flex';
    });
    window.addEventListener('appinstalled',()=>{
      localStorage.setItem('srn_installed','1');
      document.getElementById('installBtn').style.display='none';
    });
  }).catch(()=>{});
}

document.getElementById('installBtn').addEventListener('click',async()=>{
  if(!window._installPrompt) return;
  window._installPrompt.prompt();
  const {outcome}=await window._installPrompt.userChoice;
  if(outcome==='accepted'){ localStorage.setItem('srn_installed','1'); document.getElementById('installBtn').style.display='none'; toast('App installed!'); }
  window._installPrompt=null;
});

/* ── CROSS-TAB SYNC ──────────────────────────────────────────── */
window.addEventListener('storage',e=>{
  if(Object.values(KEYS).includes(e.key)){ renderPage(); }
});

/* ── INIT ────────────────────────────────────────────────────── */
heartbeat();
renderPage();
registerSW();
setInterval(()=>{ heartbeat(); renderMembersList(); updateNotifBadge(); }, 30000);
