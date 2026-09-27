/* Mental Math Lab: backend
   Talks to Firebase when js/config.js has your Firebase settings.
   Otherwise runs in demo mode, saving everything in this browser. */
window.MML = window.MML || {};
(function (MML) {
  const CFG = window.MML_CONFIG || {};
  const PR = MML.progress;
  const FB_VERSION = "10.14.1";
  const DEMO = !CFG.firebase;
  const toEmail = (u) => `${String(u).trim().toLowerCase()}@${CFG.studentDomain || "students.example.com"}`;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function makeNames(first, initial) {
    const f = String(first).trim().replace(/[^A-Za-z'-]/g, "");
    const i = String(initial).trim().replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase();
    if (!f || !i) throw new Error("Enter a first name and a last initial.");
    const cap = f.charAt(0).toUpperCase() + f.slice(1);
    return { username: cap.replace(/['-]/g, "") + i, displayName: `${cap} ${i}.` };
  }
  function friendly(e) {
    const code = (e && e.code) || "";
    const map = {
      "auth/invalid-credential": "That username and password don't match.",
      "auth/wrong-password": "That username and password don't match.",
      "auth/user-not-found": "That username and password don't match.",
      "auth/invalid-email": "That username and password don't match.",
      "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
      "auth/network-request-failed": "Can't reach the internet. Check your connection and try again.",
      "auth/email-already-in-use": "That username is already taken. Add a number to the first name, like Maya2.",
      "auth/weak-password": "Passwords need at least 6 characters.",
      "permission-denied": "The database blocked this. Check that the security rules are published and the admin UID matches.",
      "unavailable": "Can't reach the database. Check your internet connection.",
    };
    const err = new Error(map[code] || e.message || "Something went wrong. Try again.");
    err.code = code;
    return err;
  }
  function rankTop(top, field) {
    top.forEach((e) => (e.rank = 1 + top.filter((o) => o[field] > e[field]).length));
    return top;
  }

  let current = null, initPromise = null;

  /* =====================================================================
     Firebase version
     ===================================================================== */
  let F = null;
  // Site settings: is the site open, is Arcade open, and the message students see when it's closed
  const normSettings = (d) => ({ open: !d || d.open !== false, arcadeOpen: !d || d.arcadeOpen !== false, message: (d && d.message) || "" });

  const fb = {
    async init() {
      const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
      const [appM, authM, fsM] = await Promise.all([
        import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")]);
      const app = appM.initializeApp(CFG.firebase);
      F = { appM, authM, fsM, app, auth: authM.getAuth(app), db: fsM.getFirestore(app) };
      const u = await new Promise((res) => { const off = authM.onAuthStateChanged(F.auth, (x) => { off(); res(x); }); });
      current = await fb.userInfo(u);
      return current;
    },
    async userInfo(u) {
      if (!u) return null;
      if (u.uid === CFG.adminUid) return { uid: u.uid, isAdmin: true, profile: { displayName: "Teacher" } };
      const s = await F.fsM.getDoc(F.fsM.doc(F.db, "students", u.uid));
      if (!s.exists()) { await F.authM.signOut(F.auth); return null; }
      return { uid: u.uid, isAdmin: false, profile: s.data() };
    },
    async studentLogin(username, pw) {
      try {
        const cred = await F.authM.signInWithEmailAndPassword(F.auth, toEmail(username), pw);
        current = await fb.userInfo(cred.user);
      } catch (e) { throw friendly(e); }
      if (!current) throw new Error("That account isn't set up yet. Ask your teacher.");
      if (current.isAdmin) return current;
      return current;
    },
    async adminLogin(email, pw) {
      try {
        const cred = await F.authM.signInWithEmailAndPassword(F.auth, email.trim(), pw);
        if (cred.user.uid !== CFG.adminUid) {
          await F.authM.signOut(F.auth);
          throw new Error("That account isn't the admin. Check the adminUid in js/config.js.");
        }
        current = { uid: cred.user.uid, isAdmin: true, profile: { displayName: "Teacher" } };
        return current;
      } catch (e) { throw e.code ? friendly(e) : e; }
    },
    async logout() { await F.authM.signOut(F.auth); current = null; },
    async loadProgress(uid) {
      try {
        const s = await F.fsM.getDoc(F.fsM.doc(F.db, "progress", uid));
        return PR.normalize(s.exists() ? s.data() : null);
      } catch (e) { throw friendly(e); }
    },
    async saveProgress(user, p, opts = {}) {
      const { fsM, db } = F;
      p.lastActive = Date.now();
      const b = fsM.writeBatch(db);
      b.set(fsM.doc(db, "progress", user.uid), clone(p));
      if (opts.boards) for (const e of PR.boardEntries(p, user.profile)) b.set(fsM.doc(db, ...e.path, user.uid), clone(e.data));
      try { await b.commit(); } catch (e) { throw friendly(e); }
    },
    async getBoard({ period, scope, field }) {
      const { fsM, db } = F;
      const col = period === "week" ? fsM.collection(db, "weeks", PR.weekId(), scope) : fsM.collection(db, "alltime", scope, "players");
      try {
        const snap = await fsM.getDocs(fsM.query(col, fsM.where(field, ">", 0), fsM.orderBy(field, "desc"), fsM.limit(10)));
        const top = rankTop(snap.docs.map((d) => Object.assign({ uid: d.id }, d.data())), field);
        let me = null;
        if (current && !current.isAdmin) {
          const mine = top.find((e) => e.uid === current.uid);
          if (mine) me = { rank: mine.rank, value: mine[field], inTop: true };
          else {
            const ms = await fsM.getDoc(fsM.doc(col, current.uid));
            const v = ms.exists() ? ms.data()[field] : 0;
            if (v > 0) {
              const c = await fsM.getCountFromServer(fsM.query(col, fsM.where(field, ">", v)));
              me = { rank: c.data().count + 1, value: v, inTop: false };
            }
          }
        }
        return { top, me };
      } catch (e) { throw friendly(e); }
    },
    async secondaryAuth() {
      if (!F.sec) {
        const app2 = F.appM.initializeApp(CFG.firebase, "secondary");
        F.sec = F.authM.initializeAuth(app2, { persistence: F.authM.inMemoryPersistence });
      }
      return F.sec;
    },
    admin: {
      async listStudents() {
        const { fsM, db } = F;
        try {
          const [s, sec, pr] = await Promise.all(["students", "secrets", "progress"].map((c) => fsM.getDocs(fsM.collection(db, c))));
          const pw = {}, prog = {};
          sec.forEach((d) => (pw[d.id] = d.data().password));
          pr.forEach((d) => (prog[d.id] = d.data()));
          return s.docs.map((d) => studentRow(d.id, d.data(), pw[d.id], prog[d.id]));
        } catch (e) { throw friendly(e); }
      },
      async createStudent({ first, initial, grade, password }) {
        const { fsM, db, authM } = F;
        const { username, displayName } = makeNames(first, initial);
        if (String(password).length < 6) throw new Error("Passwords need at least 6 characters.");
        try {
          const dup = await fsM.getDocs(fsM.query(fsM.collection(db, "students"), fsM.where("username", "==", username)));
          if (!dup.empty) throw Object.assign(new Error(`${username} already exists. Add a number to the first name, like ${first}2.`), { dup: true });
          const sa = await fb.secondaryAuth();
          const cred = await authM.createUserWithEmailAndPassword(sa, toEmail(username), password);
          const uid = cred.user.uid;
          await authM.signOut(sa);
          const b = fsM.writeBatch(db);
          b.set(fsM.doc(db, "students", uid), { username, displayName, grade: +grade, created: Date.now() });
          b.set(fsM.doc(db, "secrets", uid), { password: String(password) });
          b.set(fsM.doc(db, "progress", uid), clone(PR.fresh()));
          await b.commit();
          return { uid, username, displayName };
        } catch (e) { throw e.dup ? e : friendly(e); }
      },
      async changePassword(uid, newPw) {
        const { fsM, db, authM } = F;
        if (String(newPw).length < 6) throw new Error("Passwords need at least 6 characters.");
        try {
          const [s, sec] = await Promise.all([fsM.getDoc(fsM.doc(db, "students", uid)), fsM.getDoc(fsM.doc(db, "secrets", uid))]);
          const sa = await fb.secondaryAuth();
          await authM.signInWithEmailAndPassword(sa, toEmail(s.data().username), sec.data().password);
          await authM.updatePassword(sa.currentUser, String(newPw));
          await authM.signOut(sa);
          await fsM.setDoc(fsM.doc(db, "secrets", uid), { password: String(newPw) });
        } catch (e) { throw friendly(e); }
      },
      async setGrade(uid, grade) {
        await fb.admin.clearScores(uid);
        try { await F.fsM.updateDoc(F.fsM.doc(F.db, "students", uid), { grade: +grade }); } catch (e) { throw friendly(e); }
      },
      async clearScores(uid, { keepProgress } = {}) {
        const { fsM, db } = F;
        try {
          const s = await fsM.getDoc(fsM.doc(db, "students", uid));
          const g = "g" + (s.exists() ? s.data().grade : 0), W = PR.weekId();
          const b = fsM.writeBatch(db);
          [["weeks", W, g], ["weeks", W, "school"], ["alltime", g, "players"], ["alltime", "school", "players"]]
            .forEach((path) => b.delete(fsM.doc(db, ...path, uid)));
          if (!keepProgress) {
            const ps = await fsM.getDoc(fsM.doc(db, "progress", uid));
            if (ps.exists()) {
              const p = PR.normalize(ps.data());
              p.arcade = {};
              for (const w of Object.values(p.weekStats)) w.arc = {};
              b.set(fsM.doc(db, "progress", uid), clone(p));
            }
          }
          await b.commit();
        } catch (e) { throw friendly(e); }
      },
      async resetProgress(uid) {
        await fb.admin.clearScores(uid, { keepProgress: true });
        try { await F.fsM.setDoc(F.fsM.doc(F.db, "progress", uid), clone(PR.fresh())); } catch (e) { throw friendly(e); }
      },
      async deleteStudent(uid) {
        const { fsM, db, authM } = F;
        let warning = null;
        try {
          const [s, sec] = await Promise.all([fsM.getDoc(fsM.doc(db, "students", uid)), fsM.getDoc(fsM.doc(db, "secrets", uid))]);
          const sa = await fb.secondaryAuth();
          await authM.signInWithEmailAndPassword(sa, toEmail(s.data().username), sec.data().password);
          await authM.deleteUser(sa.currentUser);
        } catch (e) {
          warning = "The student's data was removed, but their login couldn't be deleted automatically. You can delete it in the Firebase console under Authentication → Users.";
        }
        await fb.admin.clearScores(uid, { keepProgress: true });
        try {
          const b = fsM.writeBatch(db);
          ["students", "secrets", "progress"].forEach((c) => b.delete(fsM.doc(db, c, uid)));
          await b.commit();
        } catch (e) { throw friendly(e); }
        return { warning };
      },
    },
  };


  /* ---------- Site lock (Firestore doc site/settings) ---------- */
  fb.settings = {
    async watch(cb) {
      const { fsM, db } = F;
      // If the settings can't be read (for example, rules not published yet), the site stays open.
      return fsM.onSnapshot(fsM.doc(db, "site", "settings"), (s) => cb(normSettings(s.exists() ? s.data() : null)),
        (e) => cb(normSettings(null), friendly(e)));
    },
    async set(patch) {
      const { fsM, db } = F;
      try { await fsM.setDoc(fsM.doc(db, "site", "settings"), Object.assign({}, patch, { changedAt: fsM.serverTimestamp() }), { merge: true }); }
      catch (e) { throw friendly(e); }
    },
  };

  /* ---------- Boss drawings: one per boss (topic) ----------
     bosses/{topic}: full-size poses, loaded during battles.
     site/bossArt: small copies of every boss's poses plus the artist, loaded by the home page (one read). */
  fb.bosses = {
    async get(topic) {
      const { fsM, db } = F;
      try { const s = await fsM.getDoc(fsM.doc(db, "bosses", topic)); return s.exists() ? s.data() : null; }
      catch (e) { throw friendly(e); }
    },
    async art() {
      const { fsM, db } = F;
      try { const s = await fsM.getDoc(fsM.doc(db, "site", "bossArt")); return s.exists() ? s.data() : {}; }
      catch (e) { return {}; }
    },
    async save(topic, { artist, frames, thumbs }) {
      const { fsM, db } = F, bt = fsM.writeBatch(db), now = Date.now();
      bt.set(fsM.doc(db, "bosses", topic), { artist, frames, updated: now });
      bt.set(fsM.doc(db, "site", "bossArt"), { [topic]: { artist, frames: thumbs, updated: now } }, { merge: true });
      try { await bt.commit(); } catch (e) { throw friendly(e); }
    },
    async remove(topic) {
      const { fsM, db } = F, bt = fsM.writeBatch(db);
      bt.delete(fsM.doc(db, "bosses", topic));
      bt.set(fsM.doc(db, "site", "bossArt"), { [topic]: fsM.deleteField() }, { merge: true });
      try { await bt.commit(); } catch (e) { throw friendly(e); }
    },
  };

  /* ---------- Boss battles (Firebase Realtime Database) ---------- */
  async function rt() {
    if (!CFG.firebase.databaseURL) throw new Error("Boss battles need the Realtime Database. Add databaseURL to js/config.js (see the README).");
    if (!F.dbm) {
      F.dbm = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-database.js`);
      F.rt = F.dbm.getDatabase(F.app);
    }
    return F;
  }
  fb.battle = {
    async watch(cb) {
      const { dbm, rt: db } = await rt();
      return dbm.onValue(dbm.ref(db, "battle"), (s) => cb(s.val()), (e) => cb(null, friendly(e)));
    },
    async start(cfg) {
      const { dbm, rt: db } = await rt();
      const now = Date.now();
      await dbm.set(dbm.ref(db, "battle"), Object.assign({}, cfg, { active: true, hp: cfg.maxHp, startedAt: now, endsAt: now + cfg.minutes * 60000 }));
    },
    async end() { const { dbm, rt: db } = await rt(); await dbm.update(dbm.ref(db, "battle"), { active: false }); },
    async join(user, avatar) {
      const { dbm, rt: db } = await rt();
      await dbm.update(dbm.ref(db, "battle/players/" + user.uid), { name: user.profile.displayName, avatar: clone(avatar) });
    },
    async hit(user, dmg) {
      const { dbm, rt: db } = await rt();
      await dbm.runTransaction(dbm.ref(db, "battle/hp"), (hp) => (hp === null ? undefined : Math.max(0, hp - dmg)));
      await dbm.update(dbm.ref(db, "battle/players/" + user.uid), { damage: dbm.increment(dmg), correct: dbm.increment(1), answered: dbm.increment(1) });
    },
    async heal(user, n, maxHp) {
      const { dbm, rt: db } = await rt();
      await dbm.runTransaction(dbm.ref(db, "battle/hp"), (hp) => (hp === null ? undefined : Math.min(maxHp, hp + n)));
      await dbm.update(dbm.ref(db, "battle/players/" + user.uid), { answered: dbm.increment(1) });
    },
  };

  function studentRow(uid, s, password, p) {
    const pr = PR.normalize(p);
    return {
      uid, username: s.username, displayName: s.displayName, grade: s.grade, password: password || "",
      xp: pr.xp, coins: pr.coins, stars: PR.totalStars(pr), lastActive: pr.lastActive,
    };
  }

  /* =====================================================================
     Demo version (saves in this browser; comes with sample classmates)
     ===================================================================== */
  const DKEY = "mml-demo-db-v4", SKEY = "mml-demo-session";
  const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  function dload() {
    try { const d = JSON.parse(localStorage.getItem(DKEY)); if (d && d.week === PR.weekId()) return d; } catch (e) { }
    return dseed();
  }
  function dsave(d) { try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch (e) { } }
  function dseed() {
    const old = (() => { try { return JSON.parse(localStorage.getItem(DKEY)); } catch (e) { return null; } })();
    const d = { week: PR.weekId(), students: {}, secrets: {}, progress: {}, docs: {} };
    if (old && old.students) { d.students = old.students; d.secrets = old.secrets; d.progress = old.progress; }
    if (!Object.keys(d.students).length) {
      d.students.demo1 = { username: "SamD", displayName: "Sam D.", grade: 7, created: Date.now() };
      d.secrets.demo1 = { password: "demo123" };
      d.progress.demo1 = PR.fresh();
    }
    const names = ["Ava K.", "Leo M.", "Zoe P.", "Eli R.", "Mia T.", "Noah B.", "Ivy C.", "Owen S.", "Ruby H.", "Jay W.", "Lila F.", "Max G."];
    const A = MML.avatar.catalog, pick = (a) => a[Math.floor(Math.random() * a.length)].id;
    const W = PR.weekId();
    let n = 0;
    for (const grade of [6, 7, 8]) {
      for (let i = 0; i < 12; i++) {
        const uid = `bot${grade}${i}`, name = names[(i + grade) % names.length];
        const av = { shape: pick(A.shape.items), color: pick(A.color.items), decal: pick(A.decal.items), trail: pick(A.trail.items), theme: "cobalt" };
        const xp = 10 * Math.floor(Math.random() * 14), a = 30 + Math.floor(Math.random() * 60);
        const scores = (k) => Object.fromEntries(MML.gameInfo.order.map((id) => [id, Math.random() < 0.6 ? k * 10 * Math.floor(Math.random() * 60) : 0]));
        const wk = Object.assign({ name, avatar: av, grade, xp, answered: a, correct: Math.floor(a * (0.7 + Math.random() * 0.3)) }, scores(2));
        if (Math.random() < 0.7) wk.improve = Math.round((Math.random() * 16 - 3) * 10) / 10;
        ddoc(d, ["weeks", W, "g" + grade], uid, wk);
        ddoc(d, ["alltime", "g" + grade, "players"], uid, Object.assign({ name, avatar: av, grade, xp: xp * 4 + 60 }, scores(3)));
        ddoc(d, ["weeks", W, "school"], uid, Object.assign({ name, avatar: av, grade, xp }, i < 5 ? scores(2) : {}));
        ddoc(d, ["alltime", "school", "players"], uid, Object.assign({ name, avatar: av, grade, xp: xp * 4 + 60 }, i < 5 ? scores(3) : {}));
        n++;
      }
    }
    // put the demo students' own entries back
    for (const [uid, s] of Object.entries(d.students)) {
      const p = PR.normalize(d.progress[uid]);
      for (const e of PR.boardEntries(p, s)) ddoc(d, e.path, uid, e.data);
    }
    dsave(d);
    return d;
  }
  function ddoc(d, path, uid, data) { const k = path.join("/"); (d.docs[k] = d.docs[k] || {})[uid] = clone(data); }
  function ddel(d, path, uid) { const k = path.join("/"); if (d.docs[k]) delete d.docs[k][uid]; }
  function duser(uid) {
    if (!uid) return null;
    if (uid === "admin") return { uid, isAdmin: true, profile: { displayName: "Teacher" } };
    const d = dload(), s = d.students[uid];
    return s ? { uid, isAdmin: false, profile: clone(s) } : null;
  }

  const demo = {
    async init() { await wait(30); current = duser(localStorage.getItem(SKEY)); return current; },
    async studentLogin(username, pw) {
      await wait();
      const d = dload();
      const uid = Object.keys(d.students).find((k) => d.students[k].username.toLowerCase() === String(username).trim().toLowerCase());
      if (!uid || d.secrets[uid].password !== pw) throw new Error("That username and password don't match.");
      localStorage.setItem(SKEY, uid);
      current = duser(uid);
      return current;
    },
    async adminLogin(email, pw) {
      await wait();
      if (!email || !pw) throw new Error("Enter an email and password.");
      localStorage.setItem(SKEY, "admin");
      current = duser("admin");
      return current;
    },
    async logout() { localStorage.removeItem(SKEY); current = null; },
    async loadProgress(uid) { await wait(60); return PR.normalize(dload().progress[uid]); },
    async saveProgress(user, p, opts = {}) {
      await wait(150);
      const d = dload();
      p.lastActive = Date.now();
      d.progress[user.uid] = clone(p);
      if (opts.boards) for (const e of PR.boardEntries(p, user.profile)) ddoc(d, e.path, user.uid, e.data);
      dsave(d);
    },
    async getBoard({ period, scope, field }) {
      await wait(100);
      const d = dload();
      const key = period === "week" ? ["weeks", PR.weekId(), scope].join("/") : ["alltime", scope, "players"].join("/");
      const all = Object.entries(d.docs[key] || {}).map(([uid, v]) => Object.assign({ uid }, v)).filter((e) => e[field] > 0);
      all.sort((a, b) => b[field] - a[field]);
      const top = rankTop(all.slice(0, 10), field);
      let me = null;
      if (current && !current.isAdmin) {
        const mine = all.find((e) => e.uid === current.uid);
        if (mine) {
          const rank = 1 + all.filter((e) => e[field] > mine[field]).length;
          me = { rank, value: mine[field], inTop: top.some((e) => e.uid === current.uid) };
        }
      }
      return { top, me };
    },
    admin: {
      async listStudents() {
        await wait();
        const d = dload();
        return Object.entries(d.students).map(([uid, s]) => studentRow(uid, s, d.secrets[uid] && d.secrets[uid].password, d.progress[uid]));
      },
      async createStudent({ first, initial, grade, password }) {
        await wait(200);
        const { username, displayName } = makeNames(first, initial);
        if (String(password).length < 6) throw new Error("Passwords need at least 6 characters.");
        const d = dload();
        if (Object.values(d.students).some((s) => s.username.toLowerCase() === username.toLowerCase()))
          throw new Error(`${username} already exists. Add a number to the first name, like ${first}2.`);
        const uid = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        d.students[uid] = { username, displayName, grade: +grade, created: Date.now() };
        d.secrets[uid] = { password: String(password) };
        d.progress[uid] = PR.fresh();
        dsave(d);
        return { uid, username, displayName };
      },
      async changePassword(uid, pw) {
        await wait();
        if (String(pw).length < 6) throw new Error("Passwords need at least 6 characters.");
        const d = dload(); d.secrets[uid] = { password: String(pw) }; dsave(d);
      },
      async setGrade(uid, grade) {
        await demo.admin.clearScores(uid);
        const d = dload(); d.students[uid].grade = +grade; dsave(d);
      },
      async clearScores(uid, { keepProgress } = {}) {
        await wait();
        const d = dload(), s = d.students[uid], g = "g" + (s ? s.grade : 0), W = PR.weekId();
        [["weeks", W, g], ["weeks", W, "school"], ["alltime", g, "players"], ["alltime", "school", "players"]].forEach((p) => ddel(d, p, uid));
        if (!keepProgress && d.progress[uid]) {
          const p = PR.normalize(d.progress[uid]);
          p.arcade = {};
          for (const w of Object.values(p.weekStats)) w.arc = {};
          d.progress[uid] = p;
        }
        dsave(d);
      },
      async resetProgress(uid) {
        await demo.admin.clearScores(uid, { keepProgress: true });
        const d = dload(); d.progress[uid] = PR.fresh(); dsave(d);
      },
      async deleteStudent(uid) {
        await demo.admin.clearScores(uid, { keepProgress: true });
        const d = dload();
        delete d.students[uid]; delete d.secrets[uid]; delete d.progress[uid];
        dsave(d);
        return { warning: null };
      },
    },
  };


  /* Demo site lock: saved in this browser */
  const SETKEY = "mml-demo-settings";
  demo.settings = {
    async watch(cb) {
      let last = "";
      const tick = () => {
        let d = null; try { d = JSON.parse(localStorage.getItem(SETKEY)); } catch (e) { }
        const s = JSON.stringify(normSettings(d));
        if (s !== last) { last = s; cb(JSON.parse(s)); }
      };
      tick();
      const t = setInterval(tick, 500);
      return () => clearInterval(t);
    },
    async set(patch) {
      let d = {}; try { d = JSON.parse(localStorage.getItem(SETKEY)) || {}; } catch (e) { }
      try { localStorage.setItem(SETKEY, JSON.stringify(Object.assign(d, patch, { changedAt: Date.now() }))); } catch (e) { }
    },
  };

  /* Demo boss drawings: saved in this browser */
  const CBKEY = "mml-demo-bossart";
  const cbload = () => { try { return JSON.parse(localStorage.getItem(CBKEY)) || {}; } catch (e) { return {}; } };
  const cbsave = (d) => {
    try { localStorage.setItem(CBKEY, JSON.stringify(d)); }
    catch (e) { throw new Error("This browser is out of room for demo drawings. Remove one and try again."); }
  };
  demo.bosses = {
    async get(topic) { const d = cbload()[topic]; return d ? { artist: d.artist, frames: d.frames, updated: d.updated } : null; },
    async art() { const all = cbload(), out = {}; for (const [t, d] of Object.entries(all)) out[t] = { artist: d.artist, frames: d.thumbs, updated: d.updated }; return out; },
    async save(topic, data) { const all = cbload(); all[topic] = Object.assign({}, data, { updated: Date.now() }); cbsave(all); },
    async remove(topic) { const all = cbload(); delete all[topic]; cbsave(all); },
  };

  /* Demo boss battles: saved in this browser, with pretend classmates dealing damage */
  const BKEY = "mml-demo-battle";
  const bload = () => { try { return JSON.parse(localStorage.getItem(BKEY)); } catch (e) { return null; } };
  const bsave = (b) => { try { localStorage.setItem(BKEY, JSON.stringify(b)); } catch (e) { } };
  const BOTS = ["Ava K.", "Leo M.", "Zoe P.", "Eli R.", "Mia T.", "Noah B.", "Ivy C.", "Owen S."];
  demo.battle = {
    async watch(cb) {
      let last = "";
      const tick = () => {
        let b = bload();
        if (b && b.active && b.hp > 0 && Date.now() < b.endsAt && Date.now() - (b.lastBot || 0) > 1100) {
          const name = BOTS[Math.floor(Math.random() * BOTS.length)], id = "bot-" + name;
          const dmg = 10 * (1 + Math.floor(Math.random() * 3));
          b.players = b.players || {};
          const pl = (b.players[id] = b.players[id] || { name, avatar: { shape: ["dart", "delta", "saucer", "twin"][name.length % 4], color: ["mint", "pink", "ice", "orange"][name.charCodeAt(0) % 4] }, damage: 0, correct: 0, answered: 0 });
          pl.damage += dmg; pl.correct++; pl.answered++;
          b.hp = Math.max(0, b.hp - dmg); b.lastBot = Date.now();
          bsave(b);
        }
        const s = JSON.stringify(b);
        if (s !== last) { last = s; cb(b); }
      };
      tick();
      const t = setInterval(tick, 400);
      return () => clearInterval(t);
    },
    async start(cfg) { const now = Date.now(); bsave(Object.assign({}, cfg, { active: true, hp: cfg.maxHp, startedAt: now, endsAt: now + cfg.minutes * 60000, players: {} })); },
    async end() { const b = bload(); if (b) { b.active = false; bsave(b); } },
    async join(user, avatar) {
      const b = bload(); if (!b) return;
      b.players = b.players || {};
      b.players[user.uid] = Object.assign({ damage: 0, correct: 0, answered: 0 }, b.players[user.uid], { name: user.profile.displayName, avatar });
      bsave(b);
    },
    async hit(user, dmg) {
      const b = bload(); if (!b || !b.active) return;
      b.hp = Math.max(0, b.hp - dmg);
      const pl = b.players[user.uid]; if (pl) { pl.damage += dmg; pl.correct++; pl.answered++; }
      bsave(b);
    },
    async heal(user, n, maxHp) {
      const b = bload(); if (!b || !b.active) return;
      b.hp = Math.min(maxHp, b.hp + n);
      const pl = b.players[user.uid]; if (pl) pl.answered++;
      bsave(b);
    },
  };

  /* =====================================================================
     Public interface
     ===================================================================== */
  const impl = DEMO ? demo : fb;
  MML.backend = {
    demo: DEMO,
    init() { return (initPromise = initPromise || impl.init()); },
    user: () => current,
    studentLogin: (u, p) => impl.studentLogin(u, p),
    adminLogin: (e, p) => impl.adminLogin(e, p),
    logout: () => impl.logout(),
    loadProgress: (uid) => impl.loadProgress(uid),
    saveProgress: (user, p, opts) => impl.saveProgress(user, p, opts),
    getBoard: (o) => impl.getBoard(o),
    admin: impl.admin,
    battle: impl.battle,
    settings: impl.settings,
    bosses: impl.bosses,
    makeNames,
    /* For game pages: send anyone who isn't a signed-in student back to the login page */
    async requireStudent() {
      let u = null;
      try { u = await MML.backend.init(); } catch (e) { u = null; }
      if (!u || u.isAdmin) {
        location.href = "index.html" + location.search;
        return new Promise(() => { });
      }
      return u;
    },
  };

  // Small banner so it's obvious when the site isn't connected to Firebase yet
  if (DEMO) {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body.classList.contains("game")) return;
      const b = document.createElement("div");
      b.className = "demo-bar";
      b.textContent = "Demo mode: saving on this computer only. Add your Firebase settings to js/config.js to go live.";
      document.body.prepend(b);
    });
  }
})(window.MML);
