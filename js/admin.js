/* Mental Math Lab: admin page (teacher only) */
(async function () {
  const B = MML.backend, P = MML.problems;
  const $ = (id) => document.getElementById(id);
  const views = ["loadingView", "loginView", "studentView", "adminView"];
  const show = (id) => views.forEach((v) => ($(v).hidden = v !== id));
  const WORDS = ["tiger", "rocket", "maple", "comet", "otter", "pixel", "mango", "falcon", "cactus", "nova", "panda", "river", "lemon", "storm", "zebra", "koala", "orbit", "pepper", "violet", "summit"];
  const makePass = () => WORDS[Math.floor(Math.random() * WORDS.length)] + (10 + Math.floor(Math.random() * 90));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let user = null;
  try { user = await B.init(); } catch (e) { }
  if (!user) showLogin();
  else if (!user.isAdmin) show("studentView");
  else start();

  function showLogin() {
    show("loginView");
    $("aDemo").hidden = !B.demo;
    $("loginForm").onsubmit = async (e) => {
      e.preventDefault();
      $("aErr").textContent = ""; $("aBtn").disabled = true;
      try { user = await B.adminLogin($("aEmail").value, $("aPass").value); start(); }
      catch (err) { $("aErr").textContent = err.message; }
      $("aBtn").disabled = false;
    };
  }

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.hidden = true), 2500);
  }

  let students = [];
  function start() {
    show("adminView");
    $("logout").onclick = async () => { await B.logout(); location.href = "admin.html"; };
    $("fPass").value = makePass();
    $("genPass").onclick = () => { $("fPass").value = makePass(); };
    $("addForm").onsubmit = addOne;
    $("bulkBtn").onclick = addMany;
    $("search").oninput = renderRows;
    $("gradeFilter").onchange = renderRows;
    $("printBtn").onclick = printCards;
    setupLinks();
    setupAccess();
    setupBoss();
    setupDrawn();
    setupVersus();
    load().then(setupFriends);
  }

  async function load() {
    try {
      students = await B.admin.listStudents();
      const dl = $("dArtists"); dl.innerHTML = "";
      for (const s of students) dl.appendChild(new Option(s.displayName));
    }
    catch (e) { $("rows").innerHTML = ""; const tr = document.createElement("tr"); tr.innerHTML = "<td colspan='9'></td>"; tr.firstChild.textContent = e.message; $("rows").appendChild(tr); return; }
    renderRows();
    if (friendsReady) loadFriends(); // a deleted student's friendships disappear too
  }

  function visible() {
    const q = $("search").value.trim().toLowerCase(), g = $("gradeFilter").value;
    return students
      .filter((s) => (!g || String(s.grade) === g) && (!q || s.displayName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)))
      .sort((a, b) => a.grade - b.grade || a.displayName.localeCompare(b.displayName));
  }
  function ago(ts) {
    if (!ts) return "Never";
    const days = Math.floor((Date.now() - ts) / 86400000);
    return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
  }
  function renderRows() {
    const list = visible(), body = $("rows");
    body.innerHTML = "";
    $("count").textContent = `${list.length} student${list.length === 1 ? "" : "s"}`;
    if (!list.length) { body.innerHTML = "<tr><td colspan='9'>No students yet. Add some above.</td></tr>"; return; }
    for (const s of list) {
      const tr = document.createElement("tr");
      [s.displayName, s.username, s.grade, s.password, s.stars, s.xp, s.coins, ago(s.lastActive)].forEach((v) => {
        const td = document.createElement("td"); td.textContent = v; tr.appendChild(td);
      });
      const cell = document.createElement("td"), acts = document.createElement("div");
      acts.className = "acts"; cell.appendChild(acts);
      const btn = (label, fn, danger) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "mini" + (danger ? " danger" : "");
        b.textContent = label; b.onclick = () => fn(s, b); acts.appendChild(b);
      };
      btn("Password", changePassword);
      btn("Grade", changeGrade);
      btn("Clear scores", clearScores);
      btn("Reset", resetProgress, true);
      btn("Delete", deleteStudent, true);
      tr.appendChild(cell);
      body.appendChild(tr);
    }
  }

  async function run(button, fn, done) {
    button.disabled = true;
    try { await fn(); toast(done); await load(); }
    catch (e) { alert(e.message); }
    button.disabled = false;
  }
  function changePassword(s, b) {
    const pw = prompt(`New password for ${s.displayName} (6+ characters):`, makePass());
    if (!pw) return;
    run(b, () => B.admin.changePassword(s.uid, pw.trim()), `Password changed for ${s.displayName}`);
  }
  function changeGrade(s, b) {
    const g = prompt(`New grade for ${s.displayName} (6, 7, or 8). Their scores this week will be cleared from the boards.`, s.grade);
    if (!g || !["6", "7", "8"].includes(g.trim())) return;
    run(b, () => B.admin.setGrade(s.uid, +g), `${s.displayName} moved to grade ${g}`);
  }
  function clearScores(s, b) {
    if (!confirm(`Remove ${s.displayName} from all leaderboards and reset their Arcade scores? Stars, XP, and coins stay.`)) return;
    run(b, () => B.admin.clearScores(s.uid), `Scores cleared for ${s.displayName}`);
  }
  function resetProgress(s, b) {
    if (!confirm(`Reset ALL progress for ${s.displayName}? Stars, XP, coins, and ship items go back to zero. This can't be undone.`)) return;
    run(b, () => B.admin.resetProgress(s.uid), `Progress reset for ${s.displayName}`);
  }
  function deleteStudent(s, b) {
    if (!confirm(`Delete ${s.displayName}'s account? They won't be able to log in, and all their progress is removed. This can't be undone.`)) return;
    b.disabled = true;
    B.admin.deleteStudent(s.uid)
      .then((r) => { toast(`${s.displayName} deleted`); if (r && r.warning) alert(r.warning); return load(); })
      .catch((e) => { alert(e.message); b.disabled = false; });
  }

  async function addOne(e) {
    e.preventDefault();
    const msg = $("addMsg"); msg.style.color = ""; msg.textContent = "Adding…"; $("addBtn").disabled = true;
    try {
      const r = await B.admin.createStudent({ first: $("fFirst").value, initial: $("fInit").value, grade: $("fGrade").value, password: $("fPass").value.trim() });
      msg.style.color = "#0a7a55";
      msg.textContent = `Added ${r.displayName} (username ${r.username}, password ${$("fPass").value.trim()})`;
      $("fFirst").value = ""; $("fInit").value = ""; $("fPass").value = makePass(); $("fFirst").focus();
      await load();
    } catch (err) { msg.textContent = err.message; }
    $("addBtn").disabled = false;
  }

  async function addMany() {
    const lines = $("bulk").value.split("\n").map((l) => l.trim()).filter(Boolean);
    const log = $("bulkLog"); log.innerHTML = "";
    const say = (text, bad) => { const d = document.createElement("div"); d.textContent = text; if (bad) d.className = "bad"; log.appendChild(d); log.scrollTop = log.scrollHeight; };
    if (!lines.length) return say("Type at least one line first.", true);
    $("bulkBtn").disabled = true;
    const failed = [];
    for (const line of lines) {
      const parts = line.split(/[\s,]+/).filter(Boolean);
      const [first, initial, grade] = parts, password = parts[3] || makePass();
      if (!first || !initial || !["6", "7", "8"].includes(grade)) { say(`Skipped "${line}": needs first name, last initial, and grade 6, 7, or 8.`, true); failed.push(line); continue; }
      try {
        const r = await B.admin.createStudent({ first, initial, grade, password });
        say(`Added ${r.username} (password ${password})`);
      } catch (err) { say(`${first} ${initial}: ${err.message}`, true); failed.push(line); }
      await sleep(B.demo ? 50 : 700); // Firebase limits how fast accounts can be created
    }
    $("bulk").value = failed.join("\n");
    say(failed.length ? `Done. ${failed.length} line${failed.length > 1 ? "s" : ""} left in the box to fix.` : "Done.");
    $("bulkBtn").disabled = false;
    await load();
  }

  function printCards() {
    const list = visible(), area = $("printArea"), site = new URL("index.html", location.href).href.replace(/index\.html$/, "");
    area.innerHTML = "";
    for (const s of list) {
      const c = document.createElement("div"); c.className = "login-card";
      c.innerHTML = `<div><b></b> (grade <span></span>)</div><div>Website: <span></span></div><div>Username: <b></b></div><div>Password: <b></b></div>`;
      const [name, grade, url, user, pass] = c.querySelectorAll("b, span");
      name.textContent = s.displayName; grade.textContent = s.grade; url.textContent = site; user.textContent = s.username; pass.textContent = s.password;
      area.appendChild(c);
    }
    window.print();
  }

  /* Versus matches: live rooms, with an End button. Old finished rooms are tidied up. */
  function setupVersus() {
    const L = B.live, OLD_MS = 3 * 3600000;
    let first = true;
    async function loadRooms() {
      const body = $("vsRows");
      try {
        const all = (await L.get("rooms")) || {};
        const now = L.now();
        if (first) {
          first = false;
          for (const [c, r] of Object.entries(all))
            if (!r.players || now - (r.created || 0) > OLD_MS) { await L.remove("rooms/" + c); delete all[c]; } // no match lasts 3 hours
        }
        body.innerHTML = "";
        const list = Object.entries(all).sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
        if (!list.length) { body.innerHTML = "<tr><td colspan='7'>No matches right now.</td></tr>"; $("vsErr").textContent = ""; return; }
        for (const [c, r] of list) {
          const ps = Object.values(r.players || {});
          const names = (t) => ps.filter((p) => p.team === t).map((p) => p.name + (p.on === false ? " (left)" : "")).join(", ") || "—";
          const g = r.game;
          const status = r.state === "lobby" ? "In the lobby"
            : g && g.winner ? `Finished: ${g.winner === "a" ? "Mint" : "Pink"} won ${(g.wins || {})[g.winner] || 0}–${(g.wins || {})[g.winner === "a" ? "b" : "a"] || 0}`
            : `Playing round ${g ? g.round : 1}`;
          const tr = document.createElement("tr");
          const topic = P.strands[r.topic] ? `${P.strands[r.topic].name}, level ${r.level}` : "";
          const mins = Math.max(0, Math.round((now - (r.created || now)) / 60000));
          const when = mins < 1 ? "Just now" : mins < 60 ? `${mins} min ago` : ago(r.created);
          [c, names("a"), names("b"), status, topic, when].forEach((v, i) => {
            const td = document.createElement("td"); td.textContent = v;
            if (i === 1) td.className = "mint"; if (i === 2) td.className = "pink";
            tr.appendChild(td);
          });
          const td = document.createElement("td"), b = document.createElement("button");
          b.type = "button"; b.className = "mini danger"; b.textContent = "End";
          b.onclick = async () => {
            if (!confirm(`End match ${c}? Its players go back to the Versus menu.`)) return;
            b.disabled = true;
            try { await L.remove("rooms/" + c); toast(`Ended match ${c}`); loadRooms(); } catch (e) { alert(e.message); b.disabled = false; }
          };
          td.appendChild(b); tr.appendChild(td); body.appendChild(tr);
        }
        $("vsErr").textContent = "";
      } catch (e) { body.innerHTML = ""; $("vsErr").textContent = e.message; }
    }
    $("vsRefresh").onclick = loadRooms;
    loadRooms();
    setInterval(() => { if (!document.hidden) loadRooms(); }, 20000);
  }

  /* Friends: every friendship and request, with a Remove button */
  let friendships = [], friendsReady = false;
  async function setupFriends() {
    friendsReady = true;
    $("fSearch").oninput = renderFriends;
    // Put every student in the name list once, so classmates can find them right away
    try {
      if (!localStorage.getItem("mml-people-filled")) {
        const n = await B.admin.fillPeople();
        localStorage.setItem("mml-people-filled", "1");
        if (n) toast(`Added ${n} student${n > 1 ? "s" : ""} to the friends name list`);
      }
    } catch (e) { $("fErr").textContent = e.message; }
    loadFriends();
  }
  async function loadFriends() {
    try { friendships = await B.admin.friendships(); $("fErr").textContent = ""; }
    catch (e) { $("fErr").textContent = e.message; friendships = []; }
    renderFriends();
  }
  function renderFriends() {
    const names = Object.assign({}, B.admin.demoNames ? B.admin.demoNames() : {});
    for (const s of students) names[s.uid] = s.displayName;
    const nm = (uid) => names[uid] || "(deleted student)";
    const q = $("fSearch").value.trim().toLowerCase();
    const order = { pending: 0, accepted: 1, declined: 2 };
    const list = friendships
      .filter((f) => !q || nm(f.users[0]).toLowerCase().includes(q) || nm(f.users[1]).toLowerCase().includes(q))
      .sort((a, b) => order[a.status] - order[b.status] || b.at - a.at);
    const acc = friendships.filter((f) => f.status === "accepted").length;
    $("fCount").textContent = `${acc} friendship${acc === 1 ? "" : "s"}, ${friendships.length - acc} request${friendships.length - acc === 1 ? "" : "s"}`;
    const body = $("fRows"); body.innerHTML = "";
    if (!list.length) { body.innerHTML = `<tr><td colspan="5">${friendships.length ? "No matches." : "No friendships yet."}</td></tr>`; return; }
    for (const f of list) {
      const tr = document.createElement("tr");
      // Show the student who sent the request first
      const status = f.status === "accepted" ? "Friends" : f.status === "pending" ? "Request waiting" : "Declined";
      [nm(f.from), nm(f.to), status, ago(f.at)].forEach((v, i) => {
        const td = document.createElement("td"); td.textContent = v;
        if (i === 2) td.className = f.status;
        tr.appendChild(td);
      });
      const td = document.createElement("td"), b = document.createElement("button");
      b.type = "button"; b.className = "mini danger"; b.textContent = "Remove";
      b.onclick = async () => {
        if (!confirm(`Remove the ${f.status === "accepted" ? "friendship" : "request"} between ${nm(f.from)} and ${nm(f.to)}?`)) return;
        b.disabled = true;
        try { await B.admin.removeFriendship(f.id); toast("Removed"); await loadFriends(); }
        catch (e) { alert(e.message); b.disabled = false; }
      };
      td.appendChild(b); tr.appendChild(td); body.appendChild(tr);
    }
  }

  /* Site access: lock/unlock the whole site and Arcade */
  function setupAccess() {
    let s = null;
    const draw = () => {
      if (!s) return;
      $("siteState").innerHTML = s.open ? "Site: <b class='open'>Open</b>" : "Site: <b class='shut'>🔒 Locked</b>";
      $("arcState").innerHTML = s.arcadeOpen ? "Arcade: <b class='open'>Open</b>" : "Arcade: <b class='shut'>🔒 Locked</b>";
      $("vsState").innerHTML = s.versusOpen ? "Versus: <b class='open'>Open</b>" : "Versus: <b class='shut'>🔒 Locked</b>";
      $("vsBtn").textContent = s.versusOpen ? "Lock Versus" : "Open Versus";
      $("vsBtn").className = "btn " + (s.versusOpen ? "btn-danger" : "btn-primary");
      $("vsBtn").disabled = false;
      $("siteBtn").textContent = s.open ? "Lock the site" : "Open the site";
      $("arcBtn").textContent = s.arcadeOpen ? "Lock Arcade" : "Open Arcade";
      $("siteBtn").className = "btn " + (s.open ? "btn-danger" : "btn-primary");
      $("arcBtn").className = "btn " + (s.arcadeOpen ? "btn-danger" : "btn-primary");
      $("siteBtn").disabled = $("arcBtn").disabled = false;
      if (document.activeElement !== $("lockMsgIn")) $("lockMsgIn").value = s.message;
      const warn = $("bossLockWarn");
      if (warn) warn.hidden = s.open;
    };
    B.settings.watch((v, err) => { s = v; $("accessErr").textContent = err ? err.message : ""; draw(); })
      .catch((e) => ($("accessErr").textContent = e.message));
    const set = async (patch, btn) => {
      btn.disabled = true; $("accessErr").textContent = "";
      try { await B.settings.set(patch); } catch (e) { $("accessErr").textContent = e.message; }
      btn.disabled = false;
    };
    $("siteBtn").onclick = (e) => s && set({ open: !s.open }, e.currentTarget);
    $("arcBtn").onclick = (e) => s && set({ arcadeOpen: !s.arcadeOpen }, e.currentTarget);
    $("vsBtn").onclick = (e) => s && set({ versusOpen: !s.versusOpen }, e.currentTarget);
    $("lockMsgSave").onclick = async (e) => {
      await set({ message: $("lockMsgIn").value.trim().slice(0, 200) }, e.currentTarget);
      $("lockMsgNote").textContent = " Saved.";
      setTimeout(() => ($("lockMsgNote").textContent = ""), 2000);
    };
  }

  /* Boss drawings: one per boss. Cards show each boss's current look; the editor uploads and cleans a drawing. */
  const previews = []; // { canvas, frames } or { canvas, builtin: topic }, animated together
  function animatePreviews() {
    const t = performance.now() / 1000;
    for (const p of previews) {
      if (!p.canvas.isConnected || p.canvas.offsetParent === null) continue;
      const c = p.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2), w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) { c.width = w * dpr; c.height = h * dpr; }
      const x = c.getContext("2d");
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, w, h);
      if (p.builtin) MML.drawBoss(x, p.builtin, w / 2, h * 0.58, Math.min(w, h) * 0.6, t, 0, 0);
      else if (p.frames && p.frames.length) MML.drawCustomBoss(x, { frames: p.frames }, w / 2, h / 2, Math.min(w, h) * 0.8, t, 0, 0);
    }
    requestAnimationFrame(animatePreviews);
  }
  const toImages = (srcs) => Promise.all(srcs.map((s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = s; }))).then((a) => a.filter(Boolean));
  // Small copies for the trophy shelf, so students' home pages load quickly
  async function makeThumbs(frames) {
    const ims = await toImages(frames);
    return ims.map((im) => {
      const s = Math.min(1, 180 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
      const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, c.width, c.height);
      const u = c.toDataURL("image/webp", 0.8);
      return u.startsWith("data:image/webp") ? u : c.toDataURL("image/png");
    });
  }

  let editing = null; // the topic whose drawing is being uploaded
  let openEditor = () => {}; // set up in setupDrawn
  async function loadDrawn(fresh) {
    const art = await MML.loadBossArt(fresh);
    const list = $("drawnList"); list.innerHTML = "";
    for (let i = previews.length - 1; i >= 0; i--) if (previews[i].list) previews.splice(i, 1);
    for (const t of P.order) {
      const d = art[t], boss = MML.bosses[t];
      const card = document.createElement("div"); card.className = "drawn-card" + (editing === t ? " editing" : "");
      const cv = document.createElement("canvas"); cv.setAttribute("aria-hidden", "true");
      const nm = document.createElement("b"); nm.textContent = boss.name;
      const info = document.createElement("small");
      info.textContent = d ? `${P.strands[t].name}. Drawn by ${d.artist || "a student"}, ${d.frames.length} pose${d.frames.length === 1 ? "" : "s"}.` : `${P.strands[t].name}. Built-in art.`;
      const up = document.createElement("button"); up.type = "button"; up.className = "btn btn-primary";
      up.textContent = d ? "Replace drawing" : "Upload drawing";
      up.onclick = () => openEditor(t, d);
      card.append(cv, nm, info, up);
      if (d) {
        const del = document.createElement("button"); del.type = "button"; del.className = "btn btn-ghost"; del.textContent = "Use built-in art";
        del.onclick = async () => {
          if (!confirm(`Go back to the built-in art for ${boss.name}? The drawing will be deleted.`)) return;
          try { await B.bosses.remove(t); MML.customBossCache[t] = null; loadDrawn(true); } catch (e) { $("dErr").textContent = e.message; }
        };
        card.appendChild(del);
      }
      list.appendChild(card);
      previews.push(d ? { canvas: cv, frames: d.frames, list: true } : { canvas: cv, builtin: t, list: true });
    }
  }

  function setupDrawn() {
    let result = null, busy = 0;
    const main = { canvas: $("dPrev"), frames: [] };
    previews.push(main);
    requestAnimationFrame(animatePreviews);
    function reset() {
      ["dArtist", "dF1", "dF2", "dF3"].forEach((id) => ($(id).value = ""));
      $("dInside").checked = true; $("dCenter").checked = false; $("dStrength").value = 40;
      result = null; main.frames = []; $("dSave").disabled = true; $("dErr").textContent = "";
      $("dInfo").textContent = "Choose at least pose 1 to see a preview.";
    }
    openEditor = (t, d) => {
      editing = t; reset();
      $("dTitle").textContent = `${d ? "Replace the drawing" : "Upload a drawing"} for ${MML.bosses[t].name}`;
      if (d) $("dArtist").value = d.artist || "";
      $("drawnEditor").hidden = false;
      loadDrawn();
      $("drawnEditor").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    $("dCancel").onclick = () => { editing = null; reset(); $("drawnEditor").hidden = true; loadDrawn(); };
    async function rebuild() {
      const files = ["dF1", "dF2", "dF3"].map((id) => $(id).files[0]).filter(Boolean);
      $("dErr").textContent = ""; result = null; $("dSave").disabled = true;
      if (!$("dF1").files[0]) { main.frames = []; $("dInfo").textContent = "Choose at least pose 1 to see a preview."; return; }
      const job = ++busy;
      $("dInfo").textContent = "Cleaning up the drawing…";
      try {
        const imgs = await Promise.all(files.map(MML.bossMaker.loadFile));
        await new Promise((r) => setTimeout(r, 20));
        const r = MML.bossMaker.process(imgs, { strength: +$("dStrength").value, center: $("dCenter").checked, keepInside: $("dInside").checked });
        if (job !== busy) return;
        result = r;
        main.frames = await toImages(r.frames);
        $("dInfo").textContent = `${r.frames.length} pose${r.frames.length === 1 ? "" : "s"}, ${Math.round(r.bytes / 1024)} KB. Looks good? Save it.`;
        $("dSave").disabled = false;
      } catch (e) { if (job === busy) { $("dErr").textContent = e.message; $("dInfo").textContent = ""; main.frames = []; } }
    }
    let timer = null;
    const soon = () => { clearTimeout(timer); $("dSave").disabled = true; timer = setTimeout(rebuild, 250); };
    ["dF1", "dF2", "dF3", "dCenter", "dInside"].forEach((id) => ($(id).onchange = soon));
    $("dStrength").oninput = soon;
    $("dSave").onclick = async () => {
      if (!result || !editing) return;
      $("dSave").disabled = true;
      const t = editing, name = MML.bosses[t].name;
      try {
        const thumbs = await makeThumbs(result.frames);
        await B.bosses.save(t, { artist: $("dArtist").value.trim().slice(0, 40), frames: result.frames, thumbs });
        MML.customBossCache[t] = null;
        editing = null; reset(); $("drawnEditor").hidden = true;
        await loadDrawn(true);
        $("dErr").textContent = "";
        $("dInfo").textContent = "";
        alertSaved(name);
      } catch (e) { $("dErr").textContent = e.message; $("dSave").disabled = false; }
    };
    loadDrawn(true);
  }
  function alertSaved(name) {
    const n = document.createElement("p"); n.className = "note saved-note"; n.textContent = `Saved! ${name} now uses the new drawing.`;
    $("drawnList").before(n); setTimeout(() => n.remove(), 4000);
  }

  function setupBoss() {
    const bt = $("bTopic"), bl = $("bLevel");
    for (const id of P.order) bt.add(new Option(`${P.strands[id].name} (${MML.bosses[id].name})`, id));
    const fill = () => { bl.innerHTML = ""; P.strands[bt.value].levels.forEach((lv, i) => bl.add(new Option(`${i + 1}: ${lv.name}`, i + 1))); };
    bt.onchange = fill; fill();
    let live = null;
    $("bStart").onclick = async () => {
      $("bErr").textContent = "";
      const count = Math.max(1, Math.min(80, +$("bCount").value || 25)), minutes = +$("bMin").value, diff = +$("bDiff").value;
      const maxHp = Math.round((count * minutes * 100 * diff) / 10) * 10;
      $("bStart").disabled = true;
      try { await B.battle.start({ topic: bt.value, level: +bl.value, minutes, maxHp, bossName: MML.bosses[bt.value].name }); }
      catch (e) { $("bErr").textContent = e.message; }
      $("bStart").disabled = false;
    };
    $("bEnd").onclick = async () => {
      if (!confirm("End the battle now? Students keep the coins they've earned.")) return;
      try { await B.battle.end(); } catch (e) { $("bErr").textContent = e.message; }
    };
    const draw = () => {
      const b = live, on = b && b.startedAt && b.active && b.hp > 0 && Date.now() < b.endsAt;
      $("bossSetup").hidden = !!on; $("bossLive").hidden = !on;
      if (!on) return;
      const players = Object.keys(b.players || {}).length, left = Math.max(0, b.endsAt - Date.now());
      $("bLiveText").textContent = `${b.bossName}: ${Math.ceil(b.hp)} of ${b.maxHp} health left. ${players} player${players === 1 ? "" : "s"}. ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")} left.`;
      $("bHp").style.width = (b.hp / b.maxHp) * 100 + "%";
    };
    B.battle.watch((b, err) => { if (err) { $("bErr").textContent = err.message; return; } live = b; draw(); })
      .catch((e) => { $("bErr").textContent = e.message; });
    setInterval(draw, 1000);
  }

  function setupLinks() {
    const tTopic = $("tTopic"), tLevel = $("tLevel");
    for (const id of P.order) tTopic.add(new Option(P.strands[id].name, id));
    for (const g of MML.gameInfo.order) $("tDest").add(new Option(MML.gameInfo[g].name, g));
    const fillLevels = () => { tLevel.innerHTML = ""; P.strands[tTopic.value].levels.forEach((lv, i) => tLevel.add(new Option(`${i + 1}: ${lv.name}`, i + 1))); };
    const build = () => {
      const q = new URLSearchParams({ topic: tTopic.value, level: tLevel.value, set: "1" });
      if (!$("tFree").checked) q.set("lock", "1");
      const dest = $("tDest").value;
      if (dest !== "hub") q.set("game", dest);
      $("tUrl").value = new URL((dest === "hub" ? "index.html" : "play.html") + "?" + q, location.href).href;
    };
    tTopic.onchange = () => { fillLevels(); build(); };
    [tLevel, $("tDest"), $("tFree")].forEach((el) => (el.onchange = build));
    $("tCopy").onclick = async () => {
      try { await navigator.clipboard.writeText($("tUrl").value); } catch (e) { $("tUrl").select(); document.execCommand("copy"); }
      toast("Link copied");
    };
    fillLevels(); build();
  }
})();
