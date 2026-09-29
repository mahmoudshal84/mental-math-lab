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

  /* Friends: shared helpers */
  const ONLINE_MS = 3 * 60000;   // "Online now" = checked in within the last 3 minutes
  const BEAT_MS = 2 * 60000;     // check in every 2 minutes while a page is showing
  const MAX_FRIENDS = 40;
  const pairId = (a, b) => (a < b ? a + "_" + b : b + "_" + a);
  const cleanUsername = (u) => String(u || "").trim().toLowerCase().replace(/[^a-z0-9'-]/g, "").replace(/['-]/g, "");
  const toMs = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : +t || 0);
  function personOut(uid, d) {
    return { uid, name: d.name, grade: d.grade, avatar: MML.avatar.clean(d.avatar || {}), online: Date.now() - toMs(d.seen) < ONLINE_MS };
  }
  function friendOut(id, d, me) {
    return { id, other: d.from === me ? d.to : d.from, from: d.from, to: d.to, status: d.status, at: toMs(d.at) };
  }
  // Remembers what this browser last wrote to people/{uid}, so pages don't rewrite it every time
  const peopleSig = (user, avatar) => JSON.stringify([user.profile.username, user.profile.displayName, user.profile.grade, MML.avatar.clean(avatar)]);
  const lastBeatKey = (uid) => "mml-beat-" + uid;

  /* =====================================================================
     Firebase version
     ===================================================================== */
  let F = null;
  // Site settings: is the site open, is Arcade open, and the message students see when it's closed
  const normSettings = (d) => ({ open: !d || d.open !== false, arcadeOpen: !d || d.arcadeOpen !== false, versusOpen: !d || d.versusOpen !== false, message: (d && d.message) || "" });

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
          b.set(fsM.doc(db, "people", uid), personDoc({ username, displayName, grade: +grade }, null));
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
        try {
          await F.fsM.updateDoc(F.fsM.doc(F.db, "students", uid), { grade: +grade });
          const pref = F.fsM.doc(F.db, "people", uid);
          if ((await F.fsM.getDoc(pref)).exists()) await F.fsM.updateDoc(pref, { grade: +grade });
        } catch (e) { throw friendly(e); }
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
          ["students", "secrets", "progress", "people"].forEach((c) => b.delete(fsM.doc(db, c, uid)));
          const fr = await fsM.getDocs(fsM.query(fsM.collection(db, "friends"), fsM.where("users", "array-contains", uid)));
          fr.forEach((d) => b.delete(d.ref));
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

  /* ---------- Friends (Firestore) ----------
     people/{uid}: username (lowercase), name, grade, avatar, seen. Lets students find each other by username.
     friends/{uidA_uidB}: users [a, b], from, to, status (pending / accepted / declined), at. */
  fb.people = {
    async sync(user, avatar) {
      const sig = peopleSig(user, avatar), key = "mml-people-" + user.uid;
      try { if (localStorage.getItem(key) === sig) return; } catch (e) { }
      const { fsM, db } = F;
      await fsM.setDoc(fsM.doc(db, "people", user.uid), {
        username: user.profile.username.toLowerCase(), name: user.profile.displayName, grade: user.profile.grade,
        avatar: MML.avatar.clean(avatar), seen: fsM.serverTimestamp(),
      });
      try { localStorage.setItem(key, sig); localStorage.setItem(lastBeatKey(user.uid), String(Date.now())); } catch (e) { }
    },
    async beat(user) {
      const { fsM, db } = F;
      await fsM.updateDoc(fsM.doc(db, "people", user.uid), { seen: fsM.serverTimestamp() });
    },
    async find(username) {
      const { fsM, db } = F;
      const snap = await fsM.getDocs(fsM.query(fsM.collection(db, "people"), fsM.where("username", "==", cleanUsername(username)), fsM.limit(1)));
      return snap.empty ? null : personOut(snap.docs[0].id, snap.docs[0].data());
    },
    async get(uids) {
      const { fsM, db } = F, out = {};
      const snaps = await Promise.all(uids.map((u) => fsM.getDoc(fsM.doc(db, "people", u)).catch(() => null)));
      snaps.forEach((s, i) => { if (s && s.exists()) out[uids[i]] = personOut(uids[i], s.data()); });
      return out;
    },
  };
  fb.friends = {
    async list(user) {
      const { fsM, db } = F;
      try {
        const snap = await fsM.getDocs(fsM.query(fsM.collection(db, "friends"), fsM.where("users", "array-contains", user.uid)));
        return snap.docs.map((d) => friendOut(d.id, d.data(), user.uid));
      } catch (e) { throw friendly(e); }
    },
    async request(user, username) {
      const { fsM, db } = F;
      try {
        const other = await fb.people.find(username);
        if (!other) return { kind: "notfound" };
        if (other.uid === user.uid) return { kind: "self" };
        const ref = fsM.doc(db, "friends", pairId(user.uid, other.uid));
        const s = await fsM.getDoc(ref);
        if (s.exists()) {
          const d = s.data();
          if (d.status === "accepted") return { kind: "already", person: other };
          if (d.from === user.uid) return { kind: "waiting", person: other };
          await fsM.updateDoc(ref, { status: "accepted", at: fsM.serverTimestamp() });
          return { kind: "accepted", person: other };
        }
        await fsM.setDoc(ref, { users: pairId(user.uid, other.uid).split("_"), from: user.uid, to: other.uid, status: "pending", at: fsM.serverTimestamp() });
        return { kind: "sent", person: other };
      } catch (e) { throw friendly(e); }
    },
    async answer(user, id, accept) {
      const { fsM, db } = F;
      try { await fsM.updateDoc(fsM.doc(db, "friends", id), { status: accept ? "accepted" : "declined", at: fsM.serverTimestamp() }); }
      catch (e) { throw friendly(e); }
    },
    async remove(user, id) {
      const { fsM, db } = F;
      try { await fsM.deleteDoc(fsM.doc(db, "friends", id)); } catch (e) { throw friendly(e); }
    },
  };
  Object.assign(fb.admin, {
    async friendships() {
      const { fsM, db } = F;
      try {
        const snap = await fsM.getDocs(fsM.collection(db, "friends"));
        return snap.docs.map((d) => Object.assign({ id: d.id }, d.data(), { at: toMs(d.data().at) }));
      } catch (e) { throw friendly(e); }
    },
    async removeFriendship(id) {
      try { await F.fsM.deleteDoc(F.fsM.doc(F.db, "friends", id)); } catch (e) { throw friendly(e); }
    },
    // Adds every student to the name list, so friends can find them before they've logged in again
    async fillPeople() {
      const { fsM, db } = F;
      try {
        const [s, pe, pr] = await Promise.all(["students", "people", "progress"].map((c) => fsM.getDocs(fsM.collection(db, c))));
        const have = new Set(pe.docs.map((d) => d.id)), prog = {};
        pr.forEach((d) => (prog[d.id] = d.data()));
        const missing = s.docs.filter((d) => !have.has(d.id));
        for (let i = 0; i < missing.length; i += 400) {
          const b = fsM.writeBatch(db);
          for (const d of missing.slice(i, i + 400)) b.set(fsM.doc(db, "people", d.id), personDoc(d.data(), prog[d.id]));
          await b.commit();
        }
        return missing.length;
      } catch (e) { throw friendly(e); }
    },
  });
  function personDoc(s, p) {
    return { username: s.username.toLowerCase(), name: s.displayName, grade: s.grade, avatar: MML.avatar.clean(p && p.avatar), seen: 0 };
  }

  /* ---------- Live match data (Realtime Database), used by Versus ----------
     A thin wrapper so versus.js works the same in demo mode. Paths look like "rooms/BKTZ/players". */
  fb.live = {
    async ready() {
      const { dbm, rt: db } = await rt();
      if (!F.offsetOn) {
        F.offsetOn = true; F.offset = 0;
        dbm.onValue(dbm.ref(db, ".info/serverTimeOffset"), (s) => (F.offset = s.val() || 0));
      }
    },
    now: () => Date.now() + ((F && F.offset) || 0), // the database's clock, so every screen counts down together
    async get(path) { const { dbm, rt: db } = await rt(); return (await dbm.get(dbm.ref(db, path))).val(); },
    async watch(path, cb) { const { dbm, rt: db } = await rt(); return dbm.onValue(dbm.ref(db, path), (s) => cb(s.val()), (e) => cb(null, friendly(e))); },
    async set(path, v) { const { dbm, rt: db } = await rt(); await dbm.set(dbm.ref(db, path), v); },
    async update(path, obj) { const { dbm, rt: db } = await rt(); await dbm.update(dbm.ref(db, path), obj); },
    async remove(path) { const { dbm, rt: db } = await rt(); await dbm.remove(dbm.ref(db, path)); },
    async txn(path, fn) {
      const { dbm, rt: db } = await rt();
      const r = await dbm.runTransaction(dbm.ref(db, path), fn, { applyLocally: false });
      return { committed: r.committed, value: r.snapshot.val() };
    },
    // What to do if this browser disconnects (closed tab, lost Wi-Fi): null removes the path
    async onLeave(path, v) { const { dbm, rt: db } = await rt(); const od = dbm.onDisconnect(dbm.ref(db, path)); await (v === null ? od.remove() : od.set(v)); },
    async cancelLeave(path) { const { dbm, rt: db } = await rt(); await dbm.onDisconnect(dbm.ref(db, path)).cancel(); },
  };

  /* ---------- Versus invites (Firestore): invites/{fromUid}_{toUid} ---------- */
  fb.invites = {
    async send(user, toUid, code) {
      const { fsM, db } = F;
      try {
        await fsM.setDoc(fsM.doc(db, "invites", user.uid + "_" + toUid),
          { from: user.uid, to: toUid, name: user.profile.displayName, code, at: fsM.serverTimestamp() });
      } catch (e) { throw friendly(e); }
    },
    async watch(user, cb) {
      const { fsM, db } = F;
      return fsM.onSnapshot(fsM.query(fsM.collection(db, "invites"), fsM.where("to", "==", user.uid)),
        (snap) => cb(snap.docs.map((d) => Object.assign({ id: d.id }, d.data(), { at: toMs(d.data().at) || Date.now() }))), () => cb([]));
    },
    async remove(id) { try { await F.fsM.deleteDoc(F.fsM.doc(F.db, "invites", id)); } catch (e) { } },
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
    const d = { week: PR.weekId(), students: {}, secrets: {}, progress: {}, docs: {}, people: {}, friends: {} };
    if (old && old.students) { d.students = old.students; d.secrets = old.secrets; d.progress = old.progress; d.people = old.people || {}; d.friends = old.friends || {}; }
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
    // Pretend classmates for the friends list. Ava has already sent Sam a friend request.
    DEMO_PALS.forEach(([uid, username, name, grade], i) => {
      if (!d.people[uid]) d.people[uid] = { username: username.toLowerCase(), name, grade, seen: 0,
        avatar: { shape: ["dart", "delta", "saucer", "twin", "needle"][i], color: ["mint", "pink", "ice", "orange", "lilac"][i], decal: ["none", "stripe", "eyes", "star", "dots"][i], trail: "pink", theme: "cobalt", site: "lab" } };
    });
    if (d.students.demo1 && !Object.keys(d.friends).length) d.friends[pairId("demo1", "pal1")] = { users: pairId("demo1", "pal1").split("_"), from: "pal1", to: "demo1", status: "pending", at: Date.now() };
    for (const [uid, st] of Object.entries(d.students)) if (!d.people[uid]) d.people[uid] = personDoc(st, d.progress[uid]);
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

  const DEMO_PALS = [["pal1", "AvaK", "Ava K.", 6], ["pal2", "LeoM", "Leo M.", 7], ["pal3", "ZoeP", "Zoe P.", 8], ["pal4", "EliR", "Eli R.", 7], ["pal5", "MiaT", "Mia T.", 6]];
  const isPal = (uid) => /^pal\d$/.test(uid);

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
        d.people[uid] = personDoc({ username, displayName, grade: +grade }, null);
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
        const d = dload(); d.students[uid].grade = +grade; if (d.people[uid]) d.people[uid].grade = +grade; dsave(d);
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
        delete d.students[uid]; delete d.secrets[uid]; delete d.progress[uid]; delete d.people[uid];
        for (const [id, f] of Object.entries(d.friends)) if (f.users.includes(uid)) delete d.friends[id];
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

  /* Demo friends: saved in this browser. Pretend classmates are online half the time
     and accept friend requests a few seconds after they're sent. */
  demo.people = {
    async sync(user, avatar) {
      const d = dload();
      d.people[user.uid] = { username: user.profile.username.toLowerCase(), name: user.profile.displayName, grade: user.profile.grade, avatar: MML.avatar.clean(avatar), seen: Date.now() };
      dsave(d);
    },
    async beat(user) { const d = dload(); if (d.people[user.uid]) { d.people[user.uid].seen = Date.now(); dsave(d); } },
    async find(username) {
      await wait();
      const d = dload(), u = cleanUsername(username);
      const uid = Object.keys(d.people).find((k) => d.people[k].username === u);
      return uid ? demoPerson(d, uid) : null;
    },
    async get(uids) { const d = dload(), out = {}; for (const u of uids) if (d.people[u]) out[u] = demoPerson(d, u); return out; },
  };
  function demoPerson(d, uid) {
    const p = personOut(uid, d.people[uid]);
    if (isPal(uid)) p.online = (+uid.slice(3) + Math.floor(Date.now() / 60000)) % 2 === 0;
    return p;
  }
  demo.friends = {
    async list(user) {
      await wait(80);
      const d = dload();
      let changed = false;
      for (const f of Object.values(d.friends))
        if (f.status === "pending" && isPal(f.to) && Date.now() - f.at > 4000) { f.status = "accepted"; f.at = Date.now(); changed = true; }
      if (changed) dsave(d);
      return Object.entries(d.friends).filter(([, f]) => f.users.includes(user.uid)).map(([id, f]) => friendOut(id, f, user.uid));
    },
    async request(user, username) {
      const other = await demo.people.find(username);
      if (!other) return { kind: "notfound" };
      if (other.uid === user.uid) return { kind: "self" };
      const d = dload(), id = pairId(user.uid, other.uid), f = d.friends[id];
      if (f) {
        if (f.status === "accepted") return { kind: "already", person: other };
        if (f.from === user.uid) return { kind: "waiting", person: other };
        f.status = "accepted"; f.at = Date.now(); dsave(d);
        return { kind: "accepted", person: other };
      }
      d.friends[id] = { users: id.split("_"), from: user.uid, to: other.uid, status: "pending", at: Date.now() };
      dsave(d);
      return { kind: "sent", person: other };
    },
    async answer(user, id, accept) {
      await wait();
      const d = dload(), f = d.friends[id];
      if (f && f.to === user.uid && f.status !== "accepted") { f.status = accept ? "accepted" : "declined"; f.at = Date.now(); dsave(d); }
    },
    async remove(user, id) { await wait(); const d = dload(); delete d.friends[id]; dsave(d); },
  };
  Object.assign(demo.admin, {
    async friendships() { await wait(); return Object.entries(dload().friends).map(([id, f]) => Object.assign({ id }, f)); },
    async removeFriendship(id) { const d = dload(); delete d.friends[id]; dsave(d); },
    async fillPeople() { return 0; },
    // Names for friendships with pretend classmates (demo only)
    demoNames() { const d = dload(), out = {}; for (const [uid, p] of Object.entries(d.people)) out[uid] = p.name; return out; },
  });

  /* Demo live match data: one tree saved in this browser (so two tabs can even play each other) */
  const LKEY = "mml-demo-live";
  const lload = () => { try { return JSON.parse(localStorage.getItem(LKEY)) || {}; } catch (e) { return {}; } };
  const lsave = (t) => { try { localStorage.setItem(LKEY, JSON.stringify(t)); } catch (e) { } };
  const lparts = (p) => String(p).split("/").filter(Boolean);
  const lat = (t, p) => lparts(p).reduce((o, k) => (o == null ? undefined : o[k]), t);
  function lput(t, p, v) {
    const ks = lparts(p); let o = t;
    const trail = [];
    for (const k of ks.slice(0, -1)) { if (typeof o[k] !== "object" || o[k] === null) o[k] = {}; trail.push([o, k]); o = o[k]; }
    const last = ks[ks.length - 1];
    if (v === null || v === undefined) delete o[last]; else o[last] = clone(v);
    // like the real database, empty branches disappear
    for (let i = trail.length - 1; i >= 0; i--) { const [par, k] = trail[i]; if (par[k] && !Object.keys(par[k]).length) delete par[k]; else break; }
  }
  demo.live = {
    async ready() { },
    now: () => Date.now(),
    async get(p) { const v = lat(lload(), p); return v === undefined ? null : clone(v); },
    async watch(p, cb) {
      let last = "";
      const tick = () => { const v = lat(lload(), p); const s = JSON.stringify(v === undefined ? null : v); if (s !== last) { last = s; cb(JSON.parse(s)); } };
      tick();
      const t = setInterval(tick, 150);
      return () => clearInterval(t);
    },
    async set(p, v) { const t = lload(); lput(t, p, v); lsave(t); },
    async update(p, obj) { const t = lload(); for (const [k, v] of Object.entries(obj)) lput(t, p + "/" + k, v); lsave(t); },
    async remove(p) { const t = lload(); lput(t, p, null); lsave(t); },
    async txn(p, fn) {
      const t = lload(), cur = lat(t, p);
      const nv = fn(cur === undefined ? null : clone(cur));
      if (nv === undefined) return { committed: false, value: cur === undefined ? null : cur };
      lput(t, p, nv); lsave(t);
      return { committed: true, value: nv };
    },
    async onLeave() { },
    async cancelLeave() { },
  };
  demo.invites = {
    async send(user, toUid, code) {
      const d = dload(); d.invites = d.invites || {};
      d.invites[user.uid + "_" + toUid] = { from: user.uid, to: toUid, name: user.profile.displayName, code, at: Date.now() };
      dsave(d);
    },
    async watch(user, cb) {
      let last = "";
      const tick = () => {
        const all = dload().invites || {};
        const mine = Object.entries(all).filter(([, v]) => v.to === user.uid).map(([id, v]) => Object.assign({ id }, v));
        const s = JSON.stringify(mine); if (s !== last) { last = s; cb(mine); }
      };
      tick();
      const t = setInterval(tick, 700);
      return () => clearInterval(t);
    },
    async remove(id) { const d = dload(); if (d.invites) { delete d.invites[id]; dsave(d); } },
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
    saveProgress: (user, p, opts) => impl.saveProgress(user, p, opts).then((r) => { MML.backend.people.sync(user, p.avatar); return r; }),
    getBoard: (o) => impl.getBoard(o),
    admin: impl.admin,
    battle: impl.battle,
    settings: impl.settings,
    bosses: impl.bosses,
    friends: impl.friends,
    maxFriends: MAX_FRIENDS,
    live: impl.live,
    invites: impl.invites,
    people: {
      // Adds or updates this student's entry in the name list (name, grade, ship). Skips the write if nothing changed.
      sync(user, avatar) { if (!user || user.isAdmin) return Promise.resolve(); return impl.people.sync(user, avatar).catch(() => { }); },
      // "I'm here" check-in for the online dot: right away (unless another page just did it), then every 2 minutes while the page is showing
      heartbeat(user) {
        if (!user || user.isAdmin || MML.backend.people._beating) return;
        MML.backend.people._beating = true;
        const key = lastBeatKey(user.uid);
        const beat = (force) => {
          if (document.hidden) return;
          let last = 0; try { last = +localStorage.getItem(key) || 0; } catch (e) { }
          if (!force && Date.now() - last < BEAT_MS - 5000) return;
          try { localStorage.setItem(key, String(Date.now())); } catch (e) { }
          impl.people.beat(user).catch(() => { });
        };
        beat(false);
        setInterval(() => beat(false), 30000);
        document.addEventListener("visibilitychange", () => beat(false));
      },
      find: (u) => impl.people.find(u),
      get: (uids) => (uids.length ? impl.people.get(uids) : Promise.resolve({})),
    },
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
