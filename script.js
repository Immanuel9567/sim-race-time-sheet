import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const firebaseConfig = {
apiKey: "AIzaSyAGJuDfcrJSNV5hpXJb8ynm66Yv7aalkOs",
authDomain: "naija-racersquad.firebaseapp.com",
projectId: "naija-racersquad",
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const leaderboardRef = collection(db, "leaderboard");


window.addRow = async () => {
  const docRef = await addDoc(leaderboardRef, {
    driver: "New Driver",
    team: "New Team",
    car: "Unknown",
    time: 0,   // initialized to zero
    points: 0
  });

  // Wait a tick for the snapshot to render
  setTimeout(() => {
    const tbody = document.getElementById("tableBody");
    const lastRow = tbody.lastElementChild;
    if (lastRow) {
      const timeCell = lastRow.querySelector('[data-field="time"]');
      if (timeCell) {
        timeCell.focus();
        // optional: select text for easy overwrite
        document.execCommand('selectAll', false, null);
      }
    }
  }, 50);
};



window.updateField = async (id, field, value) => {
const ref = doc(db, "leaderboard", id);
await updateDoc(ref, {
[field]: field === "points" ? Number(value) : value
});
};


window.deleteRow = async (id) => {
await deleteDoc(doc(db, "leaderboard", id));
};


import { query, orderBy } from 
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const leaderboardQuery = query(
  leaderboardRef,
  orderBy("time", "asc") // fastest first
);

onSnapshot(leaderboardQuery, snapshot => {
const tbody = document.getElementById("tableBody");
tbody.innerHTML = "";


snapshot.forEach(docSnap => {
const d = docSnap.data();
const tr = document.createElement("tr");

tr.innerHTML = `
  <td data-label="Driver" contenteditable
      onblur="updateField('${docSnap.id}', 'driver', this.innerText)">
      ${d.driver}
  </td>

  <td data-label="Team" contenteditable
      onblur="updateField('${docSnap.id}', 'team', this.innerText)">
      ${d.time ?? ""}
  </td>

  <td data-label="Car" contenteditable
      onblur="updateField('${docSnap.id}', 'car', this.innerText)">
      ${d.points}
  </td>

  <td data-label="Time" contenteditable
      onblur="updateField('${docSnap.id}', 'time', this.innerText)">
      ${d.team}
  </td>

  <td data-label="Action">
    <button class="delete"
      onclick="deleteRow('${docSnap.id}')">Delete</button>
  </td>
`;

tbody.appendChild(tr);
});
});

document.getElementById("addBtn").addEventListener("click", addRow);

await addDoc(leaderboardRef, {
  driver: "New Driver",
  time: 9999,     // REQUIRED for orderBy
  points: 0,
  team: "New Team",
});

const tables = {
  championship1: collection(db, "waldorf_leaderboard"),
  championship2: collection(db, "waldorfrev"),
  timeTrial: collection(db, "leaderboard_timeTrial")
};


window.toggleFabMenu = () => {
  document.getElementById("fabMenu").classList.toggle("show");
};

// Attach listener
document.getElementById("fabBtn").addEventListener("click", toggleFabMenu);
