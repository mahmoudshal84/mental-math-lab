/* Mental Math Lab: Versus (Race to 5)
   Two teams of 1 to 3 players race to clear the same board of problems: 5 per player.
   Typed answers clear whichever problem they match, and anyone on a team can clear any
   problem on that team's board. First team to clear its board wins the round; first to
   win 2 rounds wins the match. Coins: 1 per problem you clear. No XP, stars, or leaderboards.

   Match data lives in the Realtime Database at rooms/{CODE}:
     host, topic, level, created, state ("lobby" or "playing")
     players/{uid}: name, avatar, team ("a" or "b"), on (connected), joined
     game: round, seed, start (when the round starts), size (players per team),
           wins {a, b}, result {r1: "a", ...}, winner, forfeit
     boards/r{round}/{team}/t{index}: uid of the player who cleared that problem */
(async function () {
  const B = MML.backend, P = MML.problems, PR = MML.progress, AV = MML.avatar, L = B.live;
  const $ = (id) => document.getElementById(id);
  const PER_PLAYER = 5, WIN_ROUNDS = 2, MAX_TEAM = 3;
  const FREEZE_MS = 1500, COUNTDOWN_MS = 3000, BETWEEN_MS = 2500, FORFEIT_MS = 15000;
  const CODE_LETTERS = "BCDFGHJKLMNPQRSTVWXZ"; // no vowels, so codes never spell words
  const TEAM_NAME = { a: "Mint team", b: "Pink team" };
  const other = (t) => (t === "a" ? "b" : "a");

  const user = await B.requireStudent();
  let prog;
  try { prog = await B.loadProgress(user.uid); }
  catch (e) { $("loading").textContent = e.message; return; }
  AV.applySite(prog.avatar.site);
  MML.help.mount(document.querySelector(".nav"));
  MML.siteLock.start(user, { versus: true, onLock: () => { if (code) leave(true); return code ? "Your match ended." : ""; } });
  try { await L.ready(); }
  catch (e) { $("loading").textContent = e.message; return; }
  $("loading").hidden = true;

  let code = null, room = null, unwatch = null, mode = null;
  let timers = [];
  // This match
  let board = { seed: null, list: [] }, pending = new Set(), frozenUntil = 0;
  let unbanked = 0, matchClears = 0, matchCoins = 0, lastRound = 0, endShown = false;
  let offSince = { a: 0, b: 0 }, botNext = {};

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.hidden = true), 2200);
  }
  function view(name) {
    $("menuView").hidden = name !== "menu";
    $("lobbyView").hidden = name !== "lobby";
    $("gameView").hidden = name !== "game";
    $("wrap").hidden = name === "game";
    document.body.classList.toggle("in-race", name === "game");
    MML.versusBusy = name === "game"; // hides invite pop-ups mid-race
  }
  const players = () => Object.entries((room && room.players) || {}).map(([uid, p]) => Object.assign({ uid }, p)).sort((a, b) => (a.joined || 0) - (b.joined || 0));
  const team = (t) => players().filter((p) => p.team === t);
  const me = () => room && room.players && room.players[user.uid];
  const myTeam = () => (me() ? me().team : "a");
  const newSeed = () => 1 + Math.floor(Math.random() * 2147483000);
  const meEntry = (t) => ({ name: user.profile.displayName, avatar: AV.clean(prog.avatar), team: t, on: true, joined: L.now() });
  const levelName = (t, n) => P.strands[t].levels[n - 1].name;

  /* ---------- The board: every screen builds the same problems from the round's seed ---------- */
  function seeded(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function makeBoard(seed, topic, level, n) {
    const real = Math.random, list = [];
    Math.random = seeded(seed);
    try {
      for (let pass = 0; pass < 3 && list.length < n; pass++) {
        for (let tries = 0; list.length < n && tries < n * 60; tries++) {
          const q = P.generate(topic, level);
          if (!P.typable(q.answer) || list.some((x) => x.prompt === q.prompt)) continue;
          // Different answers when possible, so one answer only ever fits one problem
          if (pass === 0 && list.some((x) => P.matches(q.answer, x.answer))) continue;
          list.push({ prompt: q.prompt, answer: q.answer });
        }
      }
    } finally { Math.random = real; }
    return list;
  }
  function boardFor(g) {
    if (board.seed !== g.seed) { board = { seed: g.seed, list: makeBoard(g.seed, room.topic, room.level, g.size * PER_PLAYER) }; pending.clear(); }
    return board.list;
  }
  const clearedBy = (g, t) => (room.boards && room.boards["r" + g.round] && room.boards["r" + g.round][t]) || {};
  const countOf = (obj) => Object.values(obj).filter(Boolean).length;

  /* ---------- Menu ---------- */
  function fillTopic(sel, value) {
    sel.innerHTML = "";
    for (const id of P.order) sel.appendChild(new Option(P.strands[id].name, id, false, id === value));
  }
  function fillLevel(sel, topic, value) {
    sel.innerHTML = "";
    const top = PR.unlocked(prog, topic);
    for (let n = 1; n <= top; n++) sel.appendChild(new Option(`${n}: ${levelName(topic, n)}`, n, false, n === value));
  }
  function showMenu(msg) {
    cleanup();
    view("menu");
    history.replaceState(null, "", "versus.html");
    $("joinErr").textContent = msg || "";
    const lastTopic = localStorage.getItem("mml-vs-topic") || "facts";
    fillTopic($("mTopic"), P.strands[lastTopic] ? lastTopic : "facts");
    fillLevel($("mLevel"), $("mTopic").value, PR.unlocked(prog, $("mTopic").value));
    $("mTopic").onchange = () => fillLevel($("mLevel"), $("mTopic").value, PR.unlocked(prog, $("mTopic").value));
  }
  $("createBtn").onclick = async () => {
    const btn = $("createBtn"); btn.disabled = true; $("createErr").textContent = "";
    const topic = $("mTopic").value, level = +$("mLevel").value;
    try { localStorage.setItem("mml-vs-topic", topic); } catch (e) { }
    let lastErr = null;
    for (let i = 0; i < 6; i++) {
      const c = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");
      try {
        if (await L.get("rooms/" + c)) continue; // that code is taken
        await L.set("rooms/" + c, { host: user.uid, topic, level, created: L.now(), state: "lobby", players: { [user.uid]: meEntry("a") } });
        btn.disabled = false;
        return enter(c);
      } catch (e) { lastErr = e; }
    }
    $("createErr").textContent = lastErr ? lastErr.message : "Couldn't make a room. Try again.";
    btn.disabled = false;
  };
  $("joinForm").onsubmit = (e) => { e.preventDefault(); join($("joinCode").value); };

  async function join(raw) {
    const c = String(raw || "").toUpperCase().replace(/[^A-Z]/g, "");
    const err = (m) => { showMenu(m); $("joinCode").value = c; };
    if (c.length !== 4) return err("Room codes have 4 letters.");
    $("joinBtn").disabled = true;
    try {
      const r = await L.get("rooms/" + c);
      if (!r || !r.players) return err(`There's no match with the code ${c}. Check the letters.`);
      if (r.players[user.uid]) return enter(c); // coming back (for example, after a refresh)
      if (r.state !== "lobby") return err("That match has already started. Ask them to start a new one.");
      const ps = Object.values(r.players);
      if (ps.length >= MAX_TEAM * 2) return err("That match is full.");
      const na = ps.filter((p) => p.team === "a").length, nb = ps.length - na;
      await L.set(`rooms/${c}/players/${user.uid}`, meEntry(na <= nb ? "a" : "b"));
      return enter(c);
    } catch (e) { err(e.message); }
    finally { $("joinBtn").disabled = false; }
  }

  async function enter(c) {
    code = c; MML.versusRoom = c;
    history.replaceState(null, "", "versus.html?room=" + c);
    try { await L.update(`rooms/${c}/players/${user.uid}`, { on: true }); } catch (e) { }
    mode = null;
    unwatch = await L.watch("rooms/" + c, onRoom);
  }
  // If this browser disconnects: in the lobby, leave the room; during a match, show as away
  async function setLeaveHandler() {
    const path = `rooms/${code}/players/${user.uid}`;
    try {
      await L.cancelLeave(path);
      if (room.state === "lobby") await L.onLeave(path, null);
      else await L.onLeave(path + "/on", false);
    } catch (e) { }
  }

  function cleanup() {
    if (unwatch) { try { unwatch(); } catch (e) { } }
    unwatch = null; code = null; room = null; mode = null; MML.versusRoom = "";
    timers.forEach(clearInterval); timers = [];
    $("raceOverlay").hidden = true;
  }

  async function onRoom(r, err) {
    if (err) { toast(err.message); return; }
    room = r;
    if (!r || !r.players || !r.players[user.uid]) {
      const wasHere = !!mode;
      bank();
      showMenu(wasHere ? (r ? "You're no longer in that match." : "That match has ended.") : `There's no match with that code.`);
      return;
    }
    // If the host left, the player who joined first takes over
    const hostHere = r.players[r.host] && r.players[r.host].on !== false;
    if (!hostHere) {
      const next = players().find((p) => p.on !== false && !p.bot);
      if (next && next.uid === user.uid) L.set(`rooms/${code}/host`, user.uid).catch(() => { });
    }
    if (r.state === "lobby") {
      if (mode !== "lobby") { mode = "lobby"; resetMatch(); timers.forEach(clearInterval); timers = []; setLeaveHandler(); openLobby(); }
      renderLobby();
    } else {
      if (mode !== "game") { mode = "game"; setLeaveHandler(); openGame(); }
      renderGame();
    }
  }

  function resetMatch() {
    bank();
    board = { seed: null, list: [] }; pending.clear(); frozenUntil = 0;
    matchClears = 0; matchCoins = 0; lastRound = 0; endShown = false; offSince = { a: 0, b: 0 }; botNext = {};
  }

  /* ---------- Lobby ---------- */
  function openLobby() {
    view("lobby");
    $("botBtn").hidden = !B.demo;
    loadInvites();
    timers.push(setInterval(() => { if (!document.hidden) loadInvites(); }, 60000));
  }
  function playerRow(p) {
    const li = document.createElement("li");
    if (p.on === false) li.className = "away";
    li.appendChild(AV.miniCanvas(p.avatar || AV.defaults(), 34));
    const nm = document.createElement("span");
    nm.textContent = p.name + (p.uid === user.uid ? " (you)" : "");
    li.appendChild(nm);
    if (p.uid === room.host) { const h = document.createElement("small"); h.textContent = "host"; li.appendChild(h); }
    return li;
  }
  function renderLobby() {
    $("roomCode").textContent = code;
    const A = team("a"), Bt = team("b"), isHost = room.host === user.uid;
    for (const [t, box] of [["a", "teamA"], ["b", "teamB"]]) {
      const ul = $(box); ul.innerHTML = "";
      const list = t === "a" ? A : Bt;
      list.forEach((p) => ul.appendChild(playerRow(p)));
      for (let i = list.length; i < MAX_TEAM; i++) { const li = document.createElement("li"); li.className = "open"; li.textContent = "Open spot"; ul.appendChild(li); }
    }
    const mine = myTeam(), otherCount = team(other(mine)).length;
    $("switchBtn").hidden = otherCount >= MAX_TEAM;
    $("switchBtn").textContent = `Switch to ${TEAM_NAME[other(mine)]}`;
    $("botBtn").disabled = players().length >= MAX_TEAM * 2;

    // Topic and level: the host picks from levels they've unlocked
    $("hostSetup").hidden = !isHost; $("guestSetup").hidden = isHost;
    if (isHost) {
      if (document.activeElement !== $("lTopic") && document.activeElement !== $("lLevel")) {
        fillTopic($("lTopic"), room.topic);
        fillLevel($("lLevel"), room.topic, Math.min(room.level, PR.unlocked(prog, room.topic)));
      }
    } else $("guestSetup").innerHTML = `<b>${P.strands[room.topic].name}</b>, level ${room.level}: ${levelName(room.topic, room.level)}`;

    const allHere = players().every((p) => p.on !== false);
    const ready = A.length >= 1 && A.length === Bt.length && allHere;
    $("startBtn").hidden = !isHost;
    $("startBtn").disabled = !ready;
    $("startBtn").textContent = ready ? `Start ${A.length} vs ${Bt.length}` : "Start match";
    $("startHint").textContent = !A.length || !Bt.length ? "Waiting for players on both teams…"
      : A.length !== Bt.length ? `Teams need the same number of players (now ${A.length} vs ${Bt.length}).`
      : !allHere ? "Waiting for everyone to reconnect…"
      : isHost ? "Ready when you are!" : "Waiting for the host to start…";
  }
  $("lTopic").onchange = () => {
    const t = $("lTopic").value;
    L.update("rooms/" + code, { topic: t, level: PR.unlocked(prog, t) }).catch((e) => toast(e.message));
  };
  $("lLevel").onchange = () => L.update("rooms/" + code, { level: +$("lLevel").value }).catch((e) => toast(e.message));
  $("switchBtn").onclick = () => L.update(`rooms/${code}/players/${user.uid}`, { team: other(myTeam()) }).catch((e) => toast(e.message));
  $("leaveBtn").onclick = () => leave();
  $("raceLeave").onclick = () => {
    if (room && room.game && !room.game.winner && !confirm("Leave the match? If your whole team leaves, the other team wins.")) return;
    leave();
  };
  $("startBtn").onclick = async () => {
    $("startBtn").disabled = true;
    try {
      await L.update("rooms/" + code, {
        state: "playing", boards: null,
        game: { round: 1, seed: newSeed(), start: L.now() + COUNTDOWN_MS + 600, size: team("a").length, wins: { a: 0, b: 0 } },
      });
    } catch (e) { toast(e.message); $("startBtn").disabled = false; }
  };

  // Pretend players, only in demo mode (for trying Versus without a second computer)
  const BOT_NAMES = ["Ava K.", "Leo M.", "Zoe P.", "Eli R.", "Mia T."];
  $("botBtn").onclick = () => {
    const ps = players(), na = team("a").length, nb = team("b").length;
    const name = BOT_NAMES.find((n) => !ps.some((p) => p.name === n)) || "Pal";
    const pick = (cat) => AV.catalog[cat].items[Math.floor(Math.random() * AV.catalog[cat].items.length)].id;
    L.set(`rooms/${code}/players/bot${Date.now()}`, { name, bot: true, team: nb < na ? "b" : na < nb ? "a" : "b", on: true, joined: L.now(),
      avatar: AV.clean({ shape: pick("shape"), color: pick("color"), decal: pick("decal") }) });
  };

  async function loadInvites() {
    const ul = $("inviteList");
    try {
      const fr = (await B.friends.list(user)).filter((f) => f.status === "accepted");
      const people = await B.people.get(fr.map((f) => f.other));
      const list = fr.map((f) => people[f.other]).filter(Boolean).sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
      ul.innerHTML = "";
      if (!list.length) { ul.innerHTML = `<li class="note">Add friends on the <a href="friends.html">Friends</a> page to invite them here. Or just share the room code.</li>`; return; }
      for (const p of list) {
        const li = document.createElement("li");
        if (!p.online) li.className = "off";
        li.appendChild(AV.miniCanvas(p.avatar, 34));
        const nm = document.createElement("span"); nm.innerHTML = `<b></b><small>${p.online ? "Online now" : "Offline"}</small>`;
        nm.querySelector("b").textContent = p.name;
        const b = document.createElement("button"); b.type = "button"; b.className = "mini";
        const inRoom = room && room.players && room.players[p.uid];
        b.textContent = inRoom ? "Here" : "Invite"; b.disabled = !!inRoom;
        b.onclick = async () => {
          b.disabled = true;
          try { await B.invites.send(user, p.uid, code); b.textContent = "Invited"; toast(`Invited ${p.name}`); }
          catch (e) { toast(e.message); b.disabled = false; }
        };
        li.append(nm, b);
        ul.appendChild(li);
      }
    } catch (e) { ul.innerHTML = ""; const li = document.createElement("li"); li.className = "note"; li.textContent = e.message; ul.appendChild(li); }
  }

  /* ---------- The race ---------- */
  function openGame() {
    view("game");
    const tick = () => raceTick();
    timers.forEach(clearInterval);
    timers = [setInterval(tick, 150)];
    $("raceIn").value = ""; $("raceMsg").textContent = "";
    setTimeout(() => $("raceIn").focus(), 50);
  }
  function tile(q, i, by, isPending, mine) {
    const d = document.createElement("div");
    d.className = "tile" + (by ? " done" : "") + (isPending ? " pending" : "");
    const pr = document.createElement("span"); pr.className = "pr"; pr.textContent = q.prompt;
    d.appendChild(pr);
    if (by) {
      const ans = document.createElement("span"); ans.className = "ans"; ans.textContent = q.answer; d.appendChild(ans);
      if (mine) { const who = document.createElement("small"); who.textContent = by === user.uid ? "You" : (room.players[by] ? room.players[by].name : ""); d.appendChild(who); }
    }
    if (q.prompt.length > 24) d.classList.add("long");
    return d;
  }
  function renderGame() {
    const g = room.game;
    if (!g) return;
    const list = boardFor(g), mt = myTeam(), ot = other(mt);
    const mineDone = clearedBy(g, mt), theirsDone = clearedBy(g, ot);

    // Coins are saved when a round ends
    if (g.round !== lastRound) { if (lastRound) bank(); lastRound = g.round; }
    if (g.winner) bank();

    const tm = $("tilesMine"), tt = $("tilesTheirs");
    tm.innerHTML = ""; tt.innerHTML = "";
    list.forEach((q, i) => {
      const k = "t" + i;
      tm.appendChild(tile(q, i, mineDone[k] || (pending.has(g.round + ":" + i) ? user.uid : null), pending.has(g.round + ":" + i) && !mineDone[k], true));
      tt.appendChild(tile(q, i, theirsDone[k], false, false));
    });
    tm.dataset.n = tt.dataset.n = list.length;
    const cm = countOf(mineDone), ct = countOf(theirsDone);
    $("countMine").textContent = `${cm} of ${list.length}`;
    $("countTheirs").textContent = `${ct} of ${list.length}`;
    $("namesMine").textContent = team(mt).map((p) => p.name + (p.on === false ? " (away)" : "")).join(", ");
    $("namesTheirs").textContent = team(ot).map((p) => p.name + (p.on === false ? " (away)" : "")).join(", ");
    $("gameView").classList.toggle("team-b", mt === "b");

    // Race track: each team's lead ship moves toward the finish
    const lead = (t) => (team(t)[0] && team(t)[0].avatar) || AV.defaults();
    for (const [id, t, n] of [["shipMine", mt, cm], ["shipTheirs", ot, ct]]) {
      const el = $(id);
      if (!el.firstChild || el.dataset.team !== t) { el.innerHTML = ""; el.appendChild(AV.miniCanvas(lead(t), 34, { flame: 10 })); el.dataset.team = t; }
      el.style.left = `calc(${(n / list.length) * 100}% - ${(n / list.length) * 34}px)`;
    }
    const w = g.wins || {};
    $("raceRound").textContent = g.winner ? "Match over" : `Round ${g.round}`;
    $("raceScore").innerHTML = `<span class="sc mine">${w[mt] || 0}</span><span class="dash">to</span><span class="sc theirs">${w[ot] || 0}</span>`;
    $("raceScore").setAttribute("aria-label", `Your team ${w[mt] || 0}, other team ${w[ot] || 0}. First to ${WIN_ROUNDS} wins.`);

    // Whoever sees a full board first records the round
    const res = g.result && g.result["r" + g.round];
    if (!g.winner && !res) for (const t of ["a", "b"]) if (countOf(clearedBy(g, t)) >= list.length) { finishRound(t, g.round); break; }
    raceTick();
  }

  function finishRound(t, round) {
    L.txn(`rooms/${code}/game`, (g) => {
      if (!g || g.round !== round || g.winner || (g.result && g.result["r" + round])) return undefined;
      g.result = Object.assign({}, g.result, { ["r" + round]: t });
      g.wins = Object.assign({ a: 0, b: 0 }, g.wins);
      g.wins[t]++;
      if (g.wins[t] >= WIN_ROUNDS) g.winner = t;
      else { g.round = round + 1; g.seed = newSeed(); g.start = L.now() + BETWEEN_MS + COUNTDOWN_MS; }
      return g;
    }).catch(() => { });
  }

  function raceTick() {
    if (!room || !room.game || mode !== "game") return;
    const g = room.game, now = L.now(), mt = myTeam();
    const input = $("raceIn"), ov = $("raceOverlay"), card = $("raceCard");
    const frozen = Date.now() < frozenUntil;

    if (g.winner) {
      input.disabled = true;
      if (!endShown) { endShown = true; showEnd(); }
      else refreshEndButtons();
      return;
    }
    if (now < g.start) {
      input.disabled = true;
      const secs = Math.ceil((g.start - now) / 1000), prev = g.round > 1 && g.result && g.result["r" + (g.round - 1)];
      ov.hidden = false;
      if (prev && g.start - now > COUNTDOWN_MS) {
        card.className = "race-card result " + (prev === mt ? "win" : "lose");
        card.innerHTML = `<h2>${prev === mt ? "Your team wins round " + (g.round - 1) + "!" : "The other team wins round " + (g.round - 1)}</h2><p>Next round coming up.</p>`;
      } else {
        card.className = "race-card count";
        card.innerHTML = `<p>Round ${g.round}</p><strong>${Math.min(3, secs)}</strong>`;
      }
    } else {
      ov.hidden = true;
      if (input.disabled && !frozen) { input.disabled = false; input.focus(); $("raceMsg").textContent = ""; }
      else if (frozen) input.disabled = true;
    }
    $("raceForm").classList.toggle("frozen", frozen);

    // Forfeit: if everyone on a team has been gone for 15 seconds, the other team wins
    for (const t of ["a", "b"]) {
      const members = team(t), gone = !members.length || members.every((p) => p.on === false);
      if (!gone) { offSince[t] = 0; continue; }
      offSince[t] = offSince[t] || Date.now();
      if (Date.now() - offSince[t] > FORFEIT_MS) {
        L.txn(`rooms/${code}/game`, (gg) => (!gg || gg.winner ? undefined : Object.assign(gg, { winner: other(t), forfeit: t }))).catch(() => { });
        offSince[t] = Date.now();
      }
    }
    if (B.demo) botTick(g, now);
  }

  $("raceForm").onsubmit = async (e) => {
    e.preventDefault();
    const input = $("raceIn"), val = input.value.trim(), msg = $("raceMsg");
    const g = room && room.game;
    if (!val || !g || g.winner || L.now() < g.start || Date.now() < frozenUntil) return;
    input.value = "";
    const list = boardFor(g), mt = myTeam(), done = clearedBy(g, mt), round = g.round;
    const open = (i) => !done["t" + i] && !pending.has(round + ":" + i);
    const idx = list.findIndex((q, i) => open(i) && P.matches(val, q.answer));
    if (idx < 0) {
      if (list.some((q, i) => !open(i) && P.matches(val, q.answer))) { msg.textContent = "Your team already cleared that one."; msg.className = "race-msg"; return; }
      frozenUntil = Date.now() + FREEZE_MS;
      msg.textContent = `"${val}" isn't on your board. Wait a moment…`; msg.className = "race-msg bad";
      input.disabled = true;
      return;
    }
    msg.textContent = ""; msg.className = "race-msg";
    const key = round + ":" + idx;
    pending.add(key); renderGame();
    let r = { committed: false };
    try { r = await L.txn(`rooms/${code}/boards/r${round}/${mt}/t${idx}`, (cur) => (cur ? undefined : user.uid)); } catch (err) { }
    pending.delete(key);
    if (r.committed) { matchClears++; unbanked++; }
    else { msg.textContent = "A teammate got that one first!"; }
    if (room) renderGame();
    input.focus();
  };

  function bank() {
    if (!unbanked) return;
    const n = unbanked; unbanked = 0;
    prog.coins += n; matchCoins += n;
    B.saveProgress(user, prog).catch(() => { unbanked += n; prog.coins -= n; matchCoins -= n; });
  }

  function showEnd() {
    const g = room.game, mt = myTeam(), won = g.winner === mt, w = g.wins || {};
    bank();
    const card = $("raceCard");
    card.className = "race-card end " + (won ? "win" : "lose");
    const why = g.forfeit ? (g.forfeit === mt ? "Your team left the match." : "The other team left the match.") : `${w[mt] || 0} to ${w[other(mt)] || 0}`;
    card.innerHTML = `<h2>${won ? "Your team wins! 🏆" : "The other team wins"}</h2><p class="why"></p>
      <p>You cleared <b>${matchClears}</b> problem${matchClears === 1 ? "" : "s"} and earned <b>${matchClears}</b> coin${matchClears === 1 ? "" : "s"}.</p>
      <div class="actions" id="endActs"></div><p class="note" id="endNote"></p>`;
    card.querySelector(".why").textContent = why;
    $("raceOverlay").hidden = false;
    refreshEndButtons();
  }
  function refreshEndButtons() {
    const acts = $("endActs"); if (!acts) return;
    const isHost = room.host === user.uid, key = isHost ? "host" : "guest";
    if (acts.dataset.k === key) return;
    acts.dataset.k = key; acts.innerHTML = "";
    if (isHost) {
      const again = document.createElement("button"); again.type = "button"; again.className = "btn btn-primary"; again.textContent = "Back to the lobby";
      again.onclick = async () => {
        again.disabled = true;
        const up = { state: "lobby", game: null, boards: null };
        for (const p of players()) if (p.on === false && !p.bot) up["players/" + p.uid] = null; // players who left are cleared out
        try { await L.update("rooms/" + code, up); } catch (e) { toast(e.message); again.disabled = false; }
      };
      acts.appendChild(again);
    }
    const out = document.createElement("button"); out.type = "button"; out.className = "btn btn-ghost"; out.textContent = "Leave";
    out.onclick = () => leave();
    acts.appendChild(out);
    $("endNote").textContent = isHost ? "Everyone who's still here goes back to the lobby for another match." : "Waiting for the host. You can stay for another match.";
  }

  async function leave(quiet) {
    bank();
    const c = code, r = room;
    cleanup();
    if (c && r) {
      const path = `rooms/${c}/players/${user.uid}`;
      try {
        await L.cancelLeave(path);
        if (r.state === "lobby" || (r.game && r.game.winner)) {
          const others = Object.entries(r.players || {}).filter(([uid, p]) => uid !== user.uid && !p.bot && p.on !== false);
          if (!others.length) { try { await L.remove("rooms/" + c); } catch (e) { await L.remove(path); } } // last one out closes the room
          else {
            if (r.host === user.uid) await L.set(`rooms/${c}/host`, others[0][0]);
            await L.remove(path);
          }
        } else await L.update(path, { on: false });
      } catch (e) { }
    }
    if (!quiet) showMenu();
  }

  // Demo only: pretend players clear a problem every few seconds
  function botTick(g, now) {
    if (room.host !== user.uid || now < g.start || g.winner) return;
    const list = boardFor(g);
    for (const p of players().filter((x) => x.bot)) {
      const k = p.uid + ":" + g.round;
      if (!botNext[k]) botNext[k] = now + 2500 + Math.random() * 3500;
      if (now < botNext[k]) continue;
      botNext[k] = now + 3000 + Math.random() * 3500;
      const done = clearedBy(g, p.team);
      const open = list.map((_, i) => i).filter((i) => !done["t" + i] && !pending.has(g.round + ":" + i));
      if (!open.length) continue;
      const i = open[Math.floor(Math.random() * open.length)];
      L.txn(`rooms/${code}/boards/r${g.round}/${p.team}/t${i}`, (cur) => (cur ? undefined : p.uid));
    }
  }

  // Read-only peek for testing, like the games' debug() hooks
  MML.versusDebug = () => ({ code, mode, board: board.list.map((q) => q.answer), room: room && JSON.parse(JSON.stringify(room)) });

  // Start here: a room code in the address (from an invite or a refresh) joins that match
  const start = new URLSearchParams(location.search).get("room");
  if (start) { view("menu"); join(start); }
  else showMenu();
})();
