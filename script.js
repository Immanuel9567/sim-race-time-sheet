import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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

 