/* Mental Math Lab: settings
   Paste your Firebase settings below. While "firebase" is null, the site runs
   in demo mode: everything saves in this browser only. */
window.MML_CONFIG = {
  // Replace null with the firebaseConfig object from the Firebase console, e.g.
  // firebase: { apiKey: "...", authDomain: "...", databaseURL: "...", projectId: "...", storageBucket: "...", messagingSenderId: "...", appId: "..." },
  // For boss battles, the object needs databaseURL (Firebase console → Realtime Database, the link at the top).
  firebase: {
    apiKey: "AIzaSyB_7mMiqvlqMbIioDOHkn5u4fXyPfbL2VA",
    authDomain: "mental-math-lab.firebaseapp.com",
    databaseURL: "https://mental-math-lab-default-rtdb.firebaseio.com",
    projectId: "mental-math-lab",
    storageBucket: "mental-math-lab.firebasestorage.app",
    messagingSenderId: "840738214171",
    appId: "1:840738214171:web:33f7b67d768772ea5ec3be"
  },

  // Your admin account's User UID (Firebase console → Authentication → Users)
  adminUid: "oqVc4TlVR7awq5wm62xnsLpkmxq1",

  // Student logins are turned into fake emails behind the scenes (MayaR → mayar@students.example.com).
  // No email is ever sent. You don't need to change this.
  studentDomain: "students.example.com",
};
