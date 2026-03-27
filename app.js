'use strict';

/* ── CONSTANTS ──────────────────────────────────────────────── */
const ADMIN_PASSWORD = 'teamsrn';
const KEYS = { times:'nrh_times', events:'nrh_events', activity:'nrh_activity' };
const DEFAULT_EVENTS = [
  { id:'e1', name:'J5 Prime Sprint',    desc:'Short sprint around the island circuit — 3 timed laps.', status:'open', date:'2025-12-10', expiry:'', featured:false },
  { id:'e2', name:'Night Sprint 2025',  desc:'High grip, low visibility — see who thrives under pressure.', status:'live', date:'2025-12-15', expiry:'', featured:true  },
  { id:'e3', name:'City Sprint League', desc:'Urban circuit, technical corners. Weekly leaderboard.',  status:'open', date:'2025-12-18', expiry:'', featured:false },
];
const MEDALS = ['gold','silver','bronze'];

/* ── STATE ──────────────────────────────────────────────────── */
let times = [], events = [], activityLog = [], isAdmin = false;

/* ── STORAGE ────────────────────────────────────────────────── */
function loadAll() {
  times       = JSON.parse(localStorage.getItem(KEYS.times)    || '[]');
  activityLog = JSON.parse(localStorage.getItem(KEYS.activity) || '[]');
  const stored = localStorage.getItem(KEYS.events);
  events = stored ? JSON.parse(stored) : DEFAULT_EVENTS;
  if (!stored) saveEvents();
  autoExpireEvents();
}
function saveTimes()  { localStorage.setItem(KEYS.times,    JSON.stringify(times)); }
function saveEvents() { localStorage.setItem(KEYS.events,   JSON.stringify(events)); }
function saveAct()    { localStorage.setItem(KEYS.activity, JSON.stringify(activityLog)); }

/* Auto-expire: if today >= expiry date, set status to closed */
function autoExpireEvents() {
  const today = new Date().toISOString().slice(0,10);
  let changed = false;
  events.forEach(ev => {
    if (ev.expiry && ev.expiry <= today && ev.status !== 'closed') {
      ev.status = 'closed'; changed = true;
    }
  });
  if (changed) saveEvents();
}

/* Cross-tab sync */
window.addEventListener('storage', e => {
  if (Object.values(KEYS).includes(e.key)) { loadAll(); renderAll(); renderActivity(); }
});

/* ── UTILITIES ──────────────────────────────────────────────── */
function parseLap(str) {
  const m = str.match(/^(\d{1,2}):(\d{2})\.(\d{3})$/);
  return m ? (+m[1])*60000 + (+m[2])*1000 + (+m[3]) : Infinity;
}
function initials(n) { return n.trim().split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function uid()       { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function esc(s)      { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function timeAgo(ts) {
  const s = Math.floor((Date.now()-ts)/1000);
  return s<60?'just now':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':Math.floor(s/86400)+'d ago';
}
function getFiltered(f) {
  const sub = f==='all' ? times : times.filter(t=>t.event===f);
  return [...sub].sort((a,b)=>parseLap(a.lap)-parseLap(b.lap));
}

/* ── TOAST ──────────────────────────────────────────────────── */
function toast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show '+type;
  clearTimeout(t._t); t._t = setTimeout(()=>t.className='', 3000);
}

/* ── NOTIFICATIONS ──────────────────────────────────────────── */
async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  return (await Notification.requestPermission()) === 'granted';
}
function sendNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller)
    navigator.serviceWorker.controller.postMessage({ type:'NOTIFY', title, body });
  else new Notification(title, { body, icon:'./icons/icon-192.png', tag:'nrh', renotify:true });
}

/* ── PWA ────────────────────────────────────────────────────── */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(() => {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); window._installPrompt = e;
      document.getElementById('installBtn').style.display = 'inline-flex';
    });
  }).catch(()=>{});
}

/* ── SUBMIT TIME ────────────────────────────────────────────── */
function submitTime() {
  const driver = document.getElementById('inputDriver').value.trim();
  const lap    = document.getElementById('inputLap').value.trim();
  const event  = document.getElementById('inputEvent').value;
  const team   = document.getElementById('inputTeam').value.trim();

  const fd = document.getElementById('field-driver');
  const fl = document.getElementById('field-lap');
  fd.classList.remove('has-error'); fl.classList.remove('has-error');
  if (!driver) { fd.classList.add('has-error'); return; }
  if (parseLap(lap) === Infinity) { fl.classList.add('has-error'); return; }

  // Block submissions to closed/expired events
  const ev = events.find(e => e.name === event);
  if (ev && ev.status === 'closed') { toast('This event is closed.', 'error'); return; }

  const ms = parseLap(lap);
  const xi = times.findIndex(t => t.driver.toLowerCase()===driver.toLowerCase() && t.event===event);
  let msg = '';

  if (xi !== -1) {
    const oldMs = parseLap(times[xi].lap);
    if (ms < oldMs) {
      const diff = ((oldMs-ms)/1000).toFixed(3);
      times[xi] = { ...times[xi], lap, team: team||times[xi].team, ts:Date.now() };
      msg = `🏁 ${driver} improved by ${diff}s → ${lap}`;
      toast(`Personal best! Improved by ${diff}s`);
    } else {
      toast(`${driver} already has a faster time (${times[xi].lap}).`, 'error'); return;
    }
  } else {
    times.push({ id:uid(), driver, lap, event, team, ts:Date.now() });
    msg = `🏁 ${driver} posted ${lap} in ${event}`;
    toast(`Time submitted: ${lap}`);
  }

  saveTimes();
  pushActivity(driver, lap, event);
  sendNotification('NGN Sim Racers Club', msg);
  if (Notification.permission === 'default')
    requestNotifPermission().then(g => g && toast('🔔 Notifications enabled!'));

  ['inputDriver','inputLap','inputTeam'].forEach(id => document.getElementById(id).value = '');
  renderAll();
}

/* ── ACTIVITY FEED ──────────────────────────────────────────── */
function pushActivity(driver, lap, event) {
  activityLog.unshift({ driver, lap, event, ts:Date.now() });
  if (activityLog.length > 15) activityLog = activityLog.slice(0,15);
  saveAct(); renderActivity();
}
function renderActivity() {
  const feed = document.getElementById('activityFeed');
  feed.innerHTML = activityLog.length
    ? activityLog.map(a=>`<div class="feed-item"><strong>${esc(a.driver)}</strong> posted <em>${esc(a.lap)}</em> in <strong>${esc(a.event)}</strong><span class="feed-time">${timeAgo(a.ts)}</span></div>`).join('')
    : `<div class="feed-item muted">No activity yet.</div>`;
}

/* ── EVENTS CRUD ────────────────────────────────────────────── */
function openCreateEventModal() {
  if (!isAdmin) return;
  ['evtName','evtDesc','evtDate','evtExpiry'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('evtStatus').value  = 'open';
  document.getElementById('evtFeatured').checked = false;
  document.getElementById('evtModalId').value = '';
  document.getElementById('eventModalTitle').textContent = 'Create Event';
  document.getElementById('eventModal').classList.add('open');
}
function openEditEventModal(id) {
  if (!isAdmin) return;
  const ev = events.find(e=>e.id===id); if (!ev) return;
  document.getElementById('evtName').value    = ev.name;
  document.getElementById('evtDesc').value    = ev.desc;
  document.getElementById('evtDate').value    = ev.date   || '';
  document.getElementById('evtExpiry').value  = ev.expiry || '';
  document.getElementById('evtStatus').value  = ev.status;
  document.getElementById('evtFeatured').checked = !!ev.featured;
  document.getElementById('evtModalId').value = ev.id;
  document.getElementById('eventModalTitle').textContent = 'Edit Event';
  document.getElementById('eventModal').classList.add('open');
}
function closeEventModal() { document.getElementById('eventModal').classList.remove('open'); }

function saveEvent() {
  const id       = document.getElementById('evtModalId').value;
  const name     = document.getElementById('evtName').value.trim();
  const desc     = document.getElementById('evtDesc').value.trim();
  const date     = document.getElementById('evtDate').value;
  const expiry   = document.getElementById('evtExpiry').value;
  const status   = document.getElementById('evtStatus').value;
  const featured = document.getElementById('evtFeatured').checked;

  if (!name) { toast('Event name is required.', 'error'); return; }

  // Only one featured at a time
  if (featured) events.forEach(e => e.featured = false);

  if (id) {
    const idx = events.findIndex(e=>e.id===id);
    if (idx !== -1) { events[idx] = { ...events[idx], name, desc, date, expiry, status, featured }; toast(`"${name}" updated.`); }
  } else {
    events.push({ id:uid(), name, desc, date, expiry, status, featured });
    toast(`"${name}" created!`);
  }
  saveEvents(); closeEventModal(); renderAll();
}

/* ── DELETE TIME (admin only, events are never deleted) ─────── */
function deleteEntry(id) {
  if (!isAdmin) return;
  const entry = times.find(t=>t.id===id); if (!entry) return;
  if (!confirm(`Delete ${entry.driver}'s time (${entry.lap}) from ${entry.event}?`)) return;
  times = times.filter(t=>t.id!==id);
  saveTimes(); renderAll();
  toast(`Deleted ${entry.driver}'s entry.`, 'error');
}

/* ── RENDER: EVENTS ─────────────────────────────────────────── */
function renderEvents() {
  // Rebuild dropdowns (preserve selection)
  ['inputEvent','lbFilter','tsFilter'].forEach(sid => {
    const sel = document.getElementById(sid), cur = sel.value;
    const allOpt = sid !== 'inputEvent' ? '<option value="all">All Events</option>' : '';
    sel.innerHTML = allOpt + events.map(e=>`<option value="${esc(e.name)}"${cur===e.name?' selected':''}>${esc(e.name)}</option>`).join('');
  });

  const grid = document.getElementById('eventsGrid');
  if (!events.length) { grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1">No events yet.</div>`; return; }

  grid.innerHTML = events.map(ev => {
    const count = times.filter(t=>t.event===ev.name).length;
    const isExpired = ev.expiry && ev.expiry <= new Date().toISOString().slice(0,10);
    const badgeCls  = isExpired ? 'badge-expired' : ev.status==='live' ? 'badge-live' : ev.status==='closed' ? 'badge-closed' : 'badge-open';
    const label     = isExpired ? 'Expired' : ev.status.charAt(0).toUpperCase()+ev.status.slice(1);
    const canSubmit = !isExpired && ev.status !== 'closed';
    return `<article class="card">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <div class="badge ${badgeCls}">${label}</div>
        ${ev.featured ? '<div class="badge" style="background:rgba(232,240,32,.1);color:var(--accent)">⭐ Featured</div>' : ''}
      </div>
      <h4>${esc(ev.name)}</h4>
      <p class="card-meta">${esc(ev.desc)}${ev.date?` · <span style="color:var(--muted)">${ev.date}</span>`:''}${ev.expiry?` <span style="color:var(--muted)">Closes ${ev.expiry}</span>`:''}</p>
      <div class="card-foot">
        <span class="participants">${count} participant${count!==1?'s':''}</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <a href="#leaderboard" class="btn btn-ghost btn-sm" onclick="filterTo('${esc(ev.name)}')">Leaderboard</a>
          ${canSubmit ? `<a href="#timesheet" class="btn btn-primary btn-sm" onclick="selectEvent('${esc(ev.name)}')">Submit</a>` : ''}
          ${isAdmin ? `<button class="btn btn-ghost btn-sm" onclick="openEditEventModal('${ev.id}')">✏ Edit</button>` : ''}
        </div>
      </div>
    </article>`;
  }).join('');
}

/* ── RENDER: LEADERBOARD ────────────────────────────────────── */
function renderLeaderboard() {
  const rows  = getFiltered(document.getElementById('lbFilter').value).slice(0,10);
  const tbody = document.getElementById('leaderboardBody');
  tbody.innerHTML = rows.length
    ? rows.map((r,i)=>`<tr class="lb-row ${MEDALS[i]||''}">
        <td class="pos">${i+1}</td>
        <td><div class="driver-info"><div class="avatar">${initials(r.driver)}</div><div><div class="driver-name">${esc(r.driver)}</div><div class="driver-event">${esc(r.event)}</div></div></div></td>
        <td class="lap-time">${esc(r.lap)}</td>
        <td style="color:var(--muted2);font-size:12px">${r.team?esc(r.team):'—'}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="empty-state">No times yet — be first!</td></tr>`;
}

/* ── RENDER: TIMESHEET TABLE ────────────────────────────────── */
function renderTable() {
  const rows  = getFiltered(document.getElementById('tsFilter').value);
  const tbody = document.getElementById('timesheetBody');
  document.querySelectorAll('.adminOnly').forEach(el=>el.style.display=isAdmin?'':'none');
  tbody.innerHTML = rows.length
    ? rows.map((r,i)=>`<tr>
        <td class="pos-col">${i+1}</td>
        <td><div class="driver-info"><div class="avatar" style="width:28px;height:28px;font-size:11px">${initials(r.driver)}</div><div><div style="font-weight:600">${esc(r.driver)}</div>${r.team?`<div style="font-size:12px;color:var(--muted2)">${esc(r.team)}</div>`:''}</div></div></td>
        <td class="time-col">${esc(r.lap)}</td>
        <td style="font-size:13px;color:var(--muted2)">${esc(r.event)}</td>
        <td style="font-size:13px;color:var(--muted2)">${r.team?esc(r.team):'—'}</td>
        ${isAdmin?`<td><button class="delete-btn" onclick="deleteEntry('${r.id}')">✕</button></td>`:'<td></td>'}
      </tr>`).join('')
    : `<tr><td colspan="6" class="empty-state">No times yet. Submit the first one!</td></tr>`;
}

/* ── RENDER: STATS + FEATURED ───────────────────────────────── */
function renderStats() {
  document.getElementById('statSubmissions').textContent = times.length;
  document.getElementById('statEvents').textContent      = events.length;
  document.getElementById('statRacers').textContent      = new Set(times.map(t=>t.driver.toLowerCase())).size;
}
function renderFeatured() {
  const ev = events.find(e=>e.featured) || events.find(e=>e.status==='live') || events[0];
  if (!ev) return;
  const count = times.filter(t=>t.event===ev.name).length;
  const isExpired = ev.expiry && ev.expiry <= new Date().toISOString().slice(0,10);
  document.getElementById('featuredTitle').textContent = ev.name;
  document.getElementById('featuredDate').textContent  = ev.date ? ev.date : '';
  document.getElementById('featuredCount').textContent = count+' participant'+(count!==1?'s':'');
  document.getElementById('featuredSubmit').onclick    = ()=>selectEvent(ev.name);
  document.getElementById('featuredSubmit').disabled   = isExpired || ev.status==='closed';
  const badge = document.getElementById('featuredBadge');
  badge.textContent = isExpired?'Expired':ev.status.charAt(0).toUpperCase()+ev.status.slice(1);
  badge.className   = 'badge '+(isExpired?'badge-expired':ev.status==='live'?'badge-live':ev.status==='closed'?'badge-closed':'badge-open');
}

function renderAll() { renderEvents(); renderLeaderboard(); renderTable(); renderStats(); renderFeatured(); }

/* ── NAVIGATION HELPERS ─────────────────────────────────────── */
function selectEvent(name) {
  const sel = document.getElementById('inputEvent');
  if (sel) sel.value = name;
  document.getElementById('tsFilter').value = name;
  document.getElementById('lbFilter').value = name;
  setTimeout(()=>{ document.getElementById('timesheet').scrollIntoView({behavior:'smooth'}); document.getElementById('inputDriver').focus(); }, 100);
}
function filterTo(name) {
  document.getElementById('lbFilter').value = name;
  renderLeaderboard();
}

/* ── ADMIN AUTH ─────────────────────────────────────────────── */
document.getElementById('adminToggle').addEventListener('click', () => {
  if (isAdmin) { document.getElementById('adminPanel').scrollIntoView({behavior:'smooth'}); return; }
  document.getElementById('adminModal').classList.add('open');
  setTimeout(()=>document.getElementById('adminPassInput').focus(), 100);
});
document.getElementById('adminPassInput').addEventListener('keydown', e=>{
  if (e.key==='Enter') verifyAdmin();
  if (e.key==='Escape') closeAdminModal();
});
function closeAdminModal() {
  document.getElementById('adminModal').classList.remove('open');
  document.getElementById('adminPassInput').value = '';
  document.getElementById('adminPassError').style.display = 'none';
}
function verifyAdmin() {
  if (document.getElementById('adminPassInput').value === ADMIN_PASSWORD) {
    isAdmin = true; closeAdminModal();
    document.getElementById('adminToggle').textContent = '⚡ Admin';
    document.getElementById('adminToggle').style.color = 'var(--accent)';
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('adminPanel').scrollIntoView({behavior:'smooth'});
    renderAll(); toast('Admin mode unlocked.');
  } else {
    document.getElementById('adminPassError').style.display = 'block';
    document.getElementById('adminPassInput').value = '';
    document.getElementById('adminPassInput').focus();
  }
}
function logoutAdmin() {
  isAdmin = false;
  document.getElementById('adminToggle').textContent = 'Admin';
  document.getElementById('adminToggle').style.color = '';
  document.getElementById('adminPanel').style.display = 'none';
  renderAll(); toast('Logged out of admin mode.');
}

/* ── EVENT LISTENERS ────────────────────────────────────────── */
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{ if(e.target===o) o.classList.remove('open'); }));
document.getElementById('lbFilter').addEventListener('change', renderLeaderboard);
document.getElementById('tsFilter').addEventListener('change', renderTable);
document.getElementById('inputLap').addEventListener('input', function(){ this.value=this.value.replace(/[^\d:.]/g,''); });
document.getElementById('notifBtn').addEventListener('click', async ()=>{
  const g = await requestNotifPermission();
  if (g) { toast('🔔 Notifications enabled!'); document.getElementById('notifBtn').classList.add('notif-on'); }
  else toast('Notifications blocked. Enable in browser settings.', 'error');
});
document.getElementById('installBtn').addEventListener('click', async ()=>{
  if (!window._installPrompt) return;
  window._installPrompt.prompt();
  const { outcome } = await window._installPrompt.userChoice;
  if (outcome==='accepted') { document.getElementById('installBtn').style.display='none'; toast('App installed!'); }
  window._installPrompt = null;
});
if (typeof Notification!=='undefined' && Notification.permission==='granted')
  document.getElementById('notifBtn').classList.add('notif-on');

/* ── INIT ───────────────────────────────────────────────────── */
loadAll(); renderAll(); renderActivity(); registerSW();
