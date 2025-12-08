<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAGJuDfcrJSNV5hpXJb8ynm66Yv7aalkOs",
  authDomain: "naija-racersquad.firebaseapp.com",
  databaseURL: "https://naija-racersquad-default-rtdb.firebaseio.com",
  projectId: "naija-racersquad",
  storageBucket: "naija-racersquad.firebasestorage.app",
  messagingSenderId: "914741294926",
  appId: "1:914741294926:web:3322231385b62ab767d01f",
  measurementId: "G-4WGLG2J5F8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const recordsRef = ref(db, 'records');

const form = document.getElementById('timeForm');
const leaderboard = document.getElementById('leaderboard');
const loginBtn = document.getElementById('loginBtn');
let isAdmin = false;

// Parse time string to seconds
function parseTime(timeStr) {
  const [minSec, ms] = timeStr.split('.');
  const [minutes, seconds] = minSec.split(':').map(Number);
  return minutes * 60 + seconds + (ms ? parseFloat('0.' + ms) : 0);
}

// Render leaderboard
function updateLeaderboard(records) {
  leaderboard.innerHTML = '';
  if (!records.length) return;

  records.sort((a, b) => parseTime(a.time) - parseTime(b.time));
  const fastestTime = parseTime(records[0].time);

  records.forEach((record, i) => {
    const row = document.createElement('tr');
    if (parseTime(record.time) === fastestTime) row.classList.add('fastest');

    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${record.name}</td>
      <td>${record.time}</td>
      <td>${record.team || ''}</td>
      ${isAdmin ? `<td><button class="deleteBtn" data-id="${record.id}">Delete</button></td>` : `<td></td>`}
    `;
    leaderboard.appendChild(row);
  });

  // Add delete buttons for admin
  if (isAdmin) {
    document.querySelectorAll('.deleteBtn').forEach(btn => {
      btn.onclick = e => remove(ref(db, 'records/' + e.target.dataset.id));
    });
  }
}

// Listen to database changes
onValue(recordsRef, snapshot => {
  const data = snapshot.val() || {};
  const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
  updateLeaderboard(records);
});

// Add new record
form.onsubmit = e => {
  e.preventDefault();
  const name = document.getElementById('driverName').value;
  const time = document.getElementById('lapTime').value;
  const team = document.getElementById('teamName').value;

  if (name && time) {
    push(recordsRef, { name, time, team });
    form.reset();
  } else alert('Please enter both name and time');
};

// Admin login
loginBtn.onclick = () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  isAdmin = username === 'V8' && password === 'racing123';
  alert(isAdmin ? 'Logged in as Admin' : 'Logged in as Team Member');

  // Re-render table to show/hide delete buttons
  onValue(recordsRef, snapshot => {
    const data = snapshot.val() || {};
    const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    updateLeaderboard(records);
  });
};
</script>
