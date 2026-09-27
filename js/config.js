/* Mental Math Lab: settings
   Paste your Firebase settings below. While "firebase" is null, the site runs
   in demo mode: everything saves in this browser only. */
window.MML_CONFIG = {
  // Replace null with the firebaseConfig object from the Firebase console, e.g.
  // firebase: { apiKey: "...", authDomain: "...", databaseURL: "...", projectId: "...", storageBucket: "...", messagingSenderId: "...", appId: "..." },
  // For boss battles, the object needs databaseURL (Firebase console → Realtime Database, the link at the top).
  firebase: null,

  // Your admin account's User UID (Firebase console → Authentication → Users)
  adminUid: "PASTE_YOUR_ADMIN_UID_HERE",

  // Student logins are turned into fake emails behind the scenes (MayaR → mayar@students.example.com).
  // No email is ever sent. You don't need to change this.
  studentDomain: "students.example.com",
};
