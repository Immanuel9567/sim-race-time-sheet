'use strict';
/* ── APP.JS — Game page logic ────────────────────────────────── */

const MEDALS = ['gold','silver','bronze'];
let gameId = '', gameMeta = null;
let times = [], events = [], activityLog = [];

/* ── INIT: READ URL PARAM ────────────────────────────────────── */
(function init() {
  const params = new URLSearchParams(location.search);
  gameId = params.get('g') || '';
  gameMeta = GAMES.find(g=>g.id===gameId);
  if (!gameMeta) { document.querySelector('.brand-name').textContent='Unknown Game'; return; }

  // Set game branding
  document.title = gameMeta.name + ' — NGN Sim Racers';
  document.getElementById('gameLogo').textContent  = gameMeta.icon;
  document.getElementById('gameTitle').textContent = gameMeta.name;
  document.getElementById('heroTitle').innerHTML   = `${esc(gameMeta.name)}<br><span>Leaderboard</span>`;

  loadGame();
  renderGamePage();
  registerSW();
})();

/* ── STORAGE ────────────────────────────────────────────────── */
function loadGame() {
  const allTimes   = JSON.parse(localStorage.getItem(KEYS.times)    || '[]');
  const allEvents  = JSON.parse(localStorage.getItem(KEYS.events)   || '[]');
  activityLog      = JSON.parse(localStorage.getItem(KEYS.activity) || '[]').filter(a=>a.gameId===gameId);
  times  = allTimes.filter(t=>t.gameId===gameId);
  events = allEvents.filter(e=>e.gameId===gameId);
  autoExpireEvents();
}

function saveTimes(updated) {
  const all = JSON.parse(localStorage.getItem(KEYS.times) || '[]');
  // Replace/add entries for this game
  const others = all.filter(t=>t.gameId!==gameId);
  localStorage.setItem(KEYS.times, JSON.stringify([...others, ...updated]));
  times = updated;
}
function saveEvents(updated) {
  const all = JSON.parse(localStorage.getItem(KEYS.events) || '[]');
  const others = all.filter(e=>e.gameId!==gameId);
  localStorage.setItem(KEYS.events, JSON.stringify([...others, ...updated]));
  events = updated;
}
function saveActivity() {
  const all = JSON.parse(localStorage.getItem(KEYS.activity) || '[]').filter(a=>a.gameId!==gameId);
  localStorage.setItem(KEYS.activity, JSON.stringify([...all, ...activityLog]));
}

function autoExpireEvents() {
  const today = new Date().toISOString().slice(0,10);
  let changed = false;
  events.forEach(ev => { if(ev.expiry && ev.expiry<=today && ev.status!=='closed'){ev.status='closed';changed=true;} });
  if (changed) saveEvents(events);
}

/* Cross-tab sync */
window.addEventListener('storage', e => {
  if (Object.values(KEYS).includes(e.key)) { loadGame(); renderAll(); renderActivity(); }
});

/* ── UTILITIES ──────────────────────────────────────────────── */
function parseLap(str) {
  const m = str.match(/^(\d{1,2}):(\d{2})\.(\d{3})$/);
  return m ? (+m[1])*60000 + (+m[2])*1000 + (+m[3]) : Infinity;
}
function initials(n) { return n.trim().split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function uid()       { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function getFiltered(f) {
  const sub = f==='all' ? times : times.filter(t=>t.event===f);
  return [...sub].sort((a,b)=>parseLap(a.lap)-parseLap(b.lap));
}
function timeAgo(ts) {
  const s=Math.floor((Date.now()-ts)/1000);
  return s<60?'just now':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':Math.floor(s/86400)+'d ago';
}

/* ── TOAST ──────────────────────────────────────────────────── */
function toast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent=msg; t.className='show '+type;
  clearTimeout(t._t); t._t=setTimeout(()=>t.className='',3200);
}

/* ── MODAL HELPERS ──────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o=>
  o.addEventListener('click',e=>{ if(e.target===o) o.classList.remove('open'); })
);

/* ── USER MENU ──────────────────────────────────────────────── */
document.getElementById('userMenuBtn').addEventListener('click', () => {
  const user = currentUser();
  if (!user) { window.location='index.html'; return; }
  const role = isSuperuser(user) ? '⚡ Superuser' : isGameAdmin(user,gameId) ? '🛡 Game Admin' : '🏎 Member';
  document.getElementById('userMenuName').textContent = user.username;
  document.getElementById('userMenuRole').textContent = role;
  openModal('userMenuModal');
});

function doLogout() { logout(); window.location='index.html'; }

/* ── MEMBER BAR ─────────────────────────────────────────────── */
function renderMemberBar() {
  const user = currentUser();
  const bar  = document.getElementById('memberBar');
  const ts   = document.getElementById('timesheet');

  if (!user) {
    bar.style.display='block';
    bar.innerHTML=`<div class="welcome-inner"><span>You're browsing as a guest.</span><a href="index.html" class="btn btn-primary btn-sm">Log In to Join</a></div>`;
    ts.style.display='none'; return;
  }

  const joined = hasJoined(user, gameId);
  const pending = user.joinedGames?.[gameId]==='pending';

  if (joined) {
    bar.style.display='none';
    ts.style.display='';
    document.getElementById('userMenuBtn').textContent = user.username;
  } else if (pending) {
    bar.style.display='block';
    bar.innerHTML=`<div class="welcome-inner"><span>Your membership request is pending admin approval.</span></div>`;
    ts.style.display='none';
  } else {
    bar.style.display='block';
    bar.innerHTML=`<div class="welcome-inner"><span>You are not a member of this game.</span><button class="btn btn-primary btn-sm" onclick="doRequestJoin()">Request to Join</button></div>`;
    ts.style.display='none';
  }
}

function doRequestJoin() {
  const r = requestJoin(gameId);
  if (r.ok) { toast('Request sent! Awaiting admin approval.'); renderGamePage(); }
  else toast(r.msg,'error');
}

/* ── ADMIN PANEL ────────────────────────────────────────────── */
function renderAdminPanel() {
  const user = currentUser();
  const panel = document.getElementById('adminPanel');
  if (!user || !isGameAdmin(user,gameId)) { panel.style.display='none'; return; }
  panel.style.display='block';
  document.getElementById('adminRole').textContent = isSuperuser(user) ? 'Superuser' : 'Game Admin';
  document.querySelectorAll('.adminOnly').forEach(el=>el.style.display='');
}

function showPendingPanel() {
  const div = document.getElementById('pendingMembers');
  div.style.display = div.style.display==='none' ? '' : 'none';
  if (div.style.display==='none') return;

  const users = getUsers();
  const pending = users.filter(u=>(u.joinedGames||{})[gameId]==='pending');
  if (!pending.length) { div.innerHTML='<p class="muted sm">No pending requests.</p>'; return; }

  div.innerHTML = pending.map(u=>`
    <div class="user-row">
      <div class="driver-info">
        <div class="avatar">${initials(u.username)}</div>
        <div style="font-weight:600">${esc(u.username)}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="gameApprove('${u.id}')">Approve</button>
        <button class="btn btn-danger  btn-sm" onclick="gameDecline('${u.id}')">Decline</button>
      </div>
    </div>`).join('');
}

function gameApprove(uid) { approveJoin(uid,gameId); showPendingPanel(); toast('Member approved!'); }
function gameDecline(uid) { declineJoin(uid,gameId); showPendingPanel(); toast('Declined.','error'); }

/* ── SUBMIT TIME ────────────────────────────────────────────── */
function submitTime() {
  const user = currentUser();
  if (!user || !hasJoined(user,gameId)) { toast('You must be a member to submit.','error'); return; }

  const driver = document.getElementById('inputDriver').value.trim() || user.username;
  const lap    = document.getElementById('inputLap').value.trim();
  const event  = document.getElementById('inputEvent').value;
  const team   = document.getElementById('inputTeam').value.trim();

  const fd=document.getElementById('field-driver'), fl=document.getElementById('field-lap');
  fd.classList.remove('has-error'); fl.classList.remove('has-error');
  if (!driver) { fd.classList.add('has-error'); return; }
  if (parseLap(lap)===Infinity) { fl.classList.add('has-error'); return; }

  const ev = events.find(e=>e.name===event);
  if (ev && ev.status==='closed') { toast('This event is closed.','error'); return; }

  const ms = parseLap(lap);
  const updated = [...times];
  const xi = updated.findIndex(t=>t.driver.toLowerCase()===driver.toLowerCase()&&t.event===event);
  let msg='';

  if (xi!==-1) {
    const oldMs=parseLap(updated[xi].lap);
    if (ms<oldMs) {
      const diff=((oldMs-ms)/1000).toFixed(3);
      updated[xi]={...updated[xi],lap,team:team||updated[xi].team,ts:Date.now()};
      msg=`🏁 ${driver} improved by ${diff}s → ${lap}`;
      toast(`Personal best! Improved by ${diff}s`);
    } else { toast(`${driver} already has a faster time (${updated[xi].lap}).`,'error'); return; }
  } else {
    updated.push({id:uid(),driver,lap,event,team,gameId,ts:Date.now()});
    msg=`🏁 ${driver} posted ${lap} in ${event}`;
    toast(`Time submitted: ${lap}`);
  }

  saveTimes(updated);
  pushActivity(driver,lap,event);
  sendNotification('NGN Sim Racers', msg);
  if (Notification.permission==='default')
    Notification.requestPermission().then(g=>g==='granted'&&toast('🔔 Notifications enabled!'));

  ['inputLap','inputTeam'].forEach(id=>document.getElementById(id).value='');
  renderAll();
}

/* ── ACTIVITY ────────────────────────────────────────────────── */
function pushActivity(driver,lap,event) {
  activityLog.unshift({driver,lap,event,gameId,ts:Date.now()});
  if(activityLog.length>15) activityLog=activityLog.slice(0,15);
  saveActivity(); renderActivity();
}
function renderActivity() {
  const feed=document.getElementById('activityFeed');
  feed.innerHTML=activityLog.length
    ? activityLog.map(a=>`<div class="feed-item"><strong>${esc(a.driver)}</strong> posted <em>${esc(a.lap)}</em> in <strong>${esc(a.event)}</strong><span class="feed-time">${timeAgo(a.ts)}</span></div>`).join('')
    : '<div class="feed-item muted">No activity yet.</div>';
}

/* ── EVENTS CRUD ────────────────────────────────────────────── */
function openCreateEventModal() {
  ['evtName','evtDesc','evtDate','evtExpiry'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('evtStatus').value='open';
  document.getElementById('evtFeatured').checked=false;
  document.getElementById('evtModalId').value='';
  document.getElementById('eventModalTitle').textContent='Create Event';
  openModal('eventModal');
}
function openEditEventModal(id) {
  const ev=events.find(e=>e.id===id); if(!ev) return;
  document.getElementById('evtName').value=ev.name;
  document.getElementById('evtDesc').value=ev.desc;
  document.getElementById('evtDate').value=ev.date||'';
  document.getElementById('evtExpiry').value=ev.expiry||'';
  document.getElementById('evtStatus').value=ev.status;
  document.getElementById('evtFeatured').checked=!!ev.featured;
  document.getElementById('evtModalId').value=ev.id;
  document.getElementById('eventModalTitle').textContent='Edit Event';
  openModal('eventModal');
}
function saveEvent() {
  const id=document.getElementById('evtModalId').value;
  const name=document.getElementById('evtName').value.trim();
  if (!name) { toast('Event name required.','error'); return; }
  const ev={
    name, desc:document.getElementById('evtDesc').value.trim(),
    date:document.getElementById('evtDate').value,
    expiry:document.getElementById('evtExpiry').value,
    status:document.getElementById('evtStatus').value,
    featured:document.getElementById('evtFeatured').checked,
    gameId,
  };
  const updated=[...events];
  if (ev.featured) updated.forEach(e=>e.featured=false);
  if (id) { const i=updated.findIndex(e=>e.id===id); if(i!==-1) updated[i]={...updated[i],...ev}; toast(`"${name}" updated.`); }
  else { updated.push({id:uid(),...ev}); toast(`"${name}" created!`); }
  saveEvents(updated);
  closeModal('eventModal');
  renderAll();
}

/* ── RENDER: EVENTS ─────────────────────────────────────────── */
function renderEvents() {
  const grid=document.getElementById('eventsGrid');
  const user=currentUser();
  const canAdmin=user&&isGameAdmin(user,gameId);

  ['inputEvent','lbFilter','tsFilter'].forEach(sid=>{
    const sel=document.getElementById(sid), cur=sel.value;
    const all=sid!=='inputEvent'?'<option value="all">All Events</option>':'';
    sel.innerHTML=all+events.map(e=>`<option value="${esc(e.name)}"${cur===e.name?' selected':''}>${esc(e.name)}</option>`).join('');
  });

  if (!events.length) {
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1">No events yet.${canAdmin?' Create one above.':''}</div>`;
    return;
  }
  const today=new Date().toISOString().slice(0,10);
  grid.innerHTML=events.map(ev=>{
    const count=times.filter(t=>t.event===ev.name).length;
    const exp=ev.expiry&&ev.expiry<=today;
    const cls=exp?'badge-expired':ev.status==='live'?'badge-live':ev.status==='closed'?'badge-closed':'badge-open';
    const lbl=exp?'Expired':ev.status.charAt(0).toUpperCase()+ev.status.slice(1);
    const canSub=!exp&&ev.status!=='closed';
    return `<article class="card">
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <div class="badge ${cls}">${lbl}</div>
        ${ev.featured?'<div class="badge" style="background:rgba(232,240,32,.1);color:var(--accent)">⭐ Featured</div>':''}
      </div>
      <h4>${esc(ev.name)}</h4>
      <p class="card-meta">${esc(ev.desc)}${ev.date?` · <span style="color:var(--muted)">${ev.date}</span>`:''}${ev.expiry?` <span style="color:var(--muted)">Closes ${ev.expiry}</span>`:''}</p>
      <div class="card-foot">
        <span class="participants">${count} participant${count!==1?'s':''}</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <a href="#leaderboard" class="btn btn-ghost btn-sm" onclick="filterTo('${esc(ev.name)}')">Leaderboard</a>
          ${canSub?`<a href="#timesheet" class="btn btn-primary btn-sm" onclick="selectEvent('${esc(ev.name)}')">Submit</a>`:''}
          ${canAdmin?`<button class="btn btn-ghost btn-sm" onclick="openEditEventModal('${ev.id}')">✏ Edit</button>`:''}
        </div>
      </div>
    </article>`;
  }).join('');
}

/* ── RENDER: LEADERBOARD ────────────────────────────────────── */
function renderLeaderboard() {
  const rows=getFiltered(document.getElementById('lbFilter').value).slice(0,10);
  document.getElementById('leaderboardBody').innerHTML=rows.length
    ? rows.map((r,i)=>`<tr class="lb-row ${MEDALS[i]||''}">
        <td class="pos">${i+1}</td>
        <td><div class="driver-info"><div class="avatar">${initials(r.driver)}</div><div><div class="driver-name">${esc(r.driver)}</div><div class="driver-event">${esc(r.event)}</div></div></div></td>
        <td class="lap-time">${esc(r.lap)}</td>
        <td style="color:var(--muted2);font-size:12px">${r.team?esc(r.team):'—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="empty-state">No times yet — be first!</td></tr>';
}

/* ── RENDER: TIMESHEET ──────────────────────────────────────── */
function renderTable() {
  const user=currentUser(), canAdmin=user&&isGameAdmin(user,gameId);
  const rows=getFiltered(document.getElementById('tsFilter').value);
  document.querySelectorAll('.adminOnly').forEach(el=>el.style.display=canAdmin?'':'none');
  document.getElementById('timesheetBody').innerHTML=rows.length
    ? rows.map((r,i)=>`<tr>
        <td class="pos-col">${i+1}</td>
        <td><div class="driver-info"><div class="avatar" style="width:28px;height:28px;font-size:11px">${initials(r.driver)}</div><div><div style="font-weight:600">${esc(r.driver)}</div>${r.team?`<div style="font-size:12px;color:var(--muted2)">${esc(r.team)}</div>`:''}</div></div></td>
        <td class="time-col">${esc(r.lap)}</td>
        <td style="font-size:13px;color:var(--muted2)">${esc(r.event)}</td>
        <td style="font-size:13px;color:var(--muted2)">${r.team?esc(r.team):'—'}</td>
        ${canAdmin?`<td><button class="delete-btn" onclick="deleteEntry('${r.id}')">✕</button></td>`:'<td></td>'}
      </tr>`).join('')
    : '<tr><td colspan="6" class="empty-state">No times yet. Submit the first one!</td></tr>';
}

function deleteEntry(id) {
  const entry=times.find(t=>t.id===id); if(!entry) return;
  if(!confirm(`Delete ${entry.driver}'s time?`)) return;
  saveTimes(times.filter(t=>t.id!==id));
  renderAll(); toast('Entry deleted.','error');
}

/* ── RENDER: STATS + FEATURED ───────────────────────────────── */
function renderStats() {
  document.getElementById('statSubmissions').textContent=times.length;
  document.getElementById('statEvents').textContent=events.length;
  document.getElementById('statRacers').textContent=new Set(times.map(t=>t.driver.toLowerCase())).size;
}
function renderFeatured() {
  const ev=events.find(e=>e.featured)||events.find(e=>e.status==='live')||events[0];
  if (!ev) return;
  const today=new Date().toISOString().slice(0,10);
  const exp=ev.expiry&&ev.expiry<=today;
  const count=times.filter(t=>t.event===ev.name).length;
  document.getElementById('featuredTitle').textContent=ev.name;
  document.getElementById('featuredDate').textContent=ev.date||'';
  document.getElementById('featuredCount').textContent=count+' participant'+(count!==1?'s':'');
  document.getElementById('featuredSubmit').onclick=()=>selectEvent(ev.name);
  document.getElementById('featuredSubmit').disabled=exp||ev.status==='closed';
  const badge=document.getElementById('featuredBadge');
  badge.textContent=exp?'Expired':ev.status.charAt(0).toUpperCase()+ev.status.slice(1);
  badge.className='badge '+(exp?'badge-expired':ev.status==='live'?'badge-live':ev.status==='closed'?'badge-closed':'badge-open');
}

/* ── NAV HELPERS ────────────────────────────────────────────── */
function selectEvent(name) {
  const sel=document.getElementById('inputEvent'); if(sel) sel.value=name;
  document.getElementById('tsFilter').value=name;
  document.getElementById('lbFilter').value=name;
  setTimeout(()=>{ document.getElementById('timesheet').scrollIntoView({behavior:'smooth'}); document.getElementById('inputDriver').focus(); },100);
}
function filterTo(name) { document.getElementById('lbFilter').value=name; renderLeaderboard(); }

/* ── RENDER ALL ─────────────────────────────────────────────── */
function renderAll() { renderEvents(); renderLeaderboard(); renderTable(); renderStats(); renderFeatured(); renderMemberBar(); renderAdminPanel(); }
function renderGamePage() { loadGame(); renderAll(); renderActivity(); }

/* ── LISTENERS ──────────────────────────────────────────────── */
document.getElementById('lbFilter').addEventListener('change', renderLeaderboard);
document.getElementById('tsFilter').addEventListener('change', renderTable);
document.getElementById('inputLap').addEventListener('input', function(){ this.value=this.value.replace(/[^\d:.]/g,''); });

/* ── NOTIFICATIONS ──────────────────────────────────────────── */
function sendNotification(title,body) {
  if(!('Notification' in window)||Notification.permission!=='granted') return;
  if('serviceWorker' in navigator&&navigator.serviceWorker.controller)
    navigator.serviceWorker.controller.postMessage({type:'NOTIFY',title,body});
  else new Notification(title,{body,icon:'./icons/icon-192.png',tag:'srn',renotify:true});
}

document.getElementById('notifBtn').addEventListener('click', async()=>{
  if(!('Notification' in window)) return;
  const r=await Notification.requestPermission();
  if(r==='granted'){ toast('🔔 Notifications enabled!'); document.getElementById('notifBtn').classList.add('notif-on'); }
  else toast('Notifications blocked.','error');
});
if(typeof Notification!=='undefined'&&Notification.permission==='granted')
  document.getElementById('notifBtn').classList.add('notif-on');

/* ── PWA ────────────────────────────────────────────────────── */
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
document.getElementById('installBtn').addEventListener('click', async()=>{
  if(!window._installPrompt) return;
  window._installPrompt.prompt();
  const {outcome}=await window._installPrompt.userChoice;
  if(outcome==='accepted'){ localStorage.setItem('srn_installed','1'); document.getElementById('installBtn').style.display='none'; toast('App installed!'); }
  window._installPrompt=null;
});
