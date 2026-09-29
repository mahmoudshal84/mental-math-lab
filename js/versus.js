/* Mental Math Lab: Versus (Race to 5 and Blast Battle)
   BLAST BATTLE: 2 to 4 players, everyone for themselves. The same 20 problems fall on every
   screen at the same moments (built from a shared seed and start time). The first player to type
   an answer and press Enter blasts that problem and gets the point. Most points wins.

   RACE TO 5:
   Two teams of 1 to 3 players race to clear the same board of problems: 5 per player.
   Typed answers clear whichever problem they match, and anyone on a team can clear any
   problem on that team's board. First team to clear its board wins the round; first to
   win 2 rounds wins the match. Coins: 1 per problem you clear. No XP, stars, or leaderboards.

   Match data lives in the Realtime Database at rooms/{CODE}:
     host, mode ("race" or "blast"), topic, level, created, state ("lobby" or "playing")
     players/{uid}: name, avatar, team ("a" or "b"), on (connected), joined
     game: round, seed, start (when the round starts), size (players per team),
           wins {a, b}, result {r1: "a", ...}, winner, forfeit
     boards/r{round}/{team}/t{index}: uid of the player who cleared that problem (Race to 5)
     blasts/b{index}: uid of the player who blasted that problem (Blast Battle; game has id, seed, start, n, over) */
(async function () {
  const B = MML.backend, P = MML.problems, PR = MML.progress, AV = MML.avatar, L = B.live;
  const $ = (id) => document.getElementById(id);
  const PER_PLAYER = 5, WIN_ROUNDS = 2, MAX_TEAM = 3;
  const FREEZE_MS = 1500, COUNTDOWN_MS = 3000, BETWEEN_MS = 2500, FORFEIT_MS = 15000;
  const CODE_LETTERS = "BCDFGHJKLMNPQRSTVWXZ"; // no vowels, so codes never spell words
  const TEAM_NAME = { a: "Mint team", b: "Pink team" };
  const other = (t) => (t === "a" ? "b" : "a");
  const BLAST_N = 20, BLAST_MAX = 4, SPAWN_MS = 2600;
  const COLORS = ["#2ee6a6", "#ff4f8b", "#ffd23f", "#3dd6ff"]; // Blast Battle player colors, in join order
  const MODE_NAME = { race: "Race to 5", blast: "Blast Battle" };
  const modeOf = (r) => (r && r.mode === "blast" ? "blast" : "race");
  const maxPlayers = (r) => (modeOf(r) === "blast" ? BLAST_MAX : MAX_TEAM * 2);

  let code = null, room = null, unwatch = null, mode = null;
  let timers = [];
  // This match
  let board = { seed: null, list: [] }, pending = new Set(), frozenUntil = 0;
  let unbanked = 0, matchClears = 0, matchCoins = 0, lastRound = 0, endShown = false;
  let offSince = { a: 0, b: 0 }, botNext = {};
  let blast = { seed: null, list: [], els: [], seen: {}, ended: false, raf: 0 }, blastPending = new Set();

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

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.hidden = true), 2200);
  }
  function view(name) {
    $("menuView").hidden = name !== "menu";
    $("lobbyView").hidden = name !== "lobby";
    $("gameView").hidden = name !== "game";
    $("blastView").hidden = name !== "blast";
    const playing = name === "game" || name === "blast";
    $("wrap").hidden = playing;
    document.body.classList.toggle("in-race", playing);
    MML.versusBusy = playing; // hides invite pop-ups mid-match
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
    const lastMode = localStorage.getItem("mml-vs-mode") === "blast" ? "blast" : "race";
    document.querySelector(`input[name=mode][value=${lastMode}]`).checked = true;
    showRecord();
  }
  function showRecord() {
    const v = prog.versus;
    $("myRecord").innerHTML = v.race.played + v.blast.played
      ? `Your record: <b>Race to 5</b> ${PR.versusText(prog, "race")}. <b>Blast Battle</b> ${PR.versusText(prog, "blast")}.`
      : "Your record: no matches yet. Wins and losses show up here.";
  }
  $("createBtn").onclick = async () => {
    const btn = $("createBtn"); btn.disabled = true; $("createErr").textContent = "";
    const topic = $("mTopic").value, level = +$("mLevel").value;
    const gameMode = document.querySelector("input[name=mode]:checked").value === "blast" ? "blast" : "race";
    try { localStorage.setItem("mml-vs-topic", topic); localStorage.setItem("mml-vs-mode", gameMode); } catch (e) { }
    let lastErr = null;
    for (let i = 0; i < 6; i++) {
      const c = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");
      try {
        if (await L.get("rooms/" + c)) continue; // that code is taken
        await L.set("rooms/" + c, { host: user.uid, mode: gameMode, topic, level, created: L.now(), state: "lobby", players: { [user.uid]: meEntry("a") } });
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
      if (ps.length >= maxPlayers(r)) return err("That match is full.");
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
    cancelAnimationFrame(blast.raf);
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
    } else if (modeOf(r) === "blast") {
      if (mode !== "blast") { mode = "blast"; setLeaveHandler(); openBlast(); }
      renderBlast();
    } else {
      if (mode !== "game") { mode = "game"; setLeaveHandler(); openGame(); }
      renderGame();
    }
    if (r.state === "playing" && r.game && r.game.id) countPlayed(modeOf(r), r.game.id);
  }

  /* ---------- Win/loss record (saved in progress) ---------- */
  function countPlayed(m, id) {
    if (prog.versus.lastStart === id) return;
    prog.versus.lastStart = id; prog.versus[m].played++;
    B.saveProgress(user, prog).catch(() => { });
  }
  function countWin(m, id) {
    if (!id || prog.versus.lastWin === id) return;
    prog.versus.lastWin = id; prog.versus[m].wins++;
    B.saveProgress(user, prog).catch(() => { });
  }

  function resetMatch() {
    bank();
    board = { seed: null, list: [] }; pending.clear(); frozenUntil = 0;
    matchClears = 0; matchCoins = 0; lastRound = 0; endShown = false; offSince = { a: 0, b: 0 }; botNext = {};
    cancelAnimationFrame(blast.raf);
    blast.els.forEach((e) => e.remove());
    blast = { seed: null, list: [], els: [], seen: {}, ended: false, raf: 0 }; blastPending.clear();
    $("raceOverlay").hidden = true;
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
    const isBlast = modeOf(room) === "blast";
    $("lobbyMode").textContent = MODE_NAME[modeOf(room)];
    $("lobbyNote").textContent = isBlast ? "Share the code, or invite friends. 2 to 4 players, everyone for themselves."
      : "Share the code, or invite friends. Teams need the same number of players, from 1 to 3 each.";
    $("teamsBox").hidden = isBlast; $("ffaBox").hidden = !isBlast;
    if (isBlast) return renderBlastLobby();
    const A = team("a"), Bt = team("b"), isHost = room.host === user.uid;
    for (const [t, box] of [["a", "teamA"], ["b", "teamB"]]) {
      const ul = $(box); ul.innerHTML = "";
      const list = t === "a" ? A : Bt;
      list.forEach((p) => ul.appendChild(playerRow(p)));
      for (let i = list.length; i < MAX_TEAM; i++) { const li = document.createElement("li"); li.className = "open"; li.textContent = "Open spot"; ul.appendChild(li); }
    }
    const mine = myTeam(), otherCount = team(other(mine)).length;
    $("switchBtn").hidden = otherCount >= MAX_TEAM;
    renderSetup(isHost);
    $("switchBtn").textContent = `Switch to ${TEAM_NAME[other(mine)]}`;
    $("botBtn").disabled = players().length >= MAX_TEAM * 2;

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
  // Topic and level: the host picks from levels they've unlocked
  function renderSetup(isHost) {
    $("hostSetup").hidden = !isHost; $("guestSetup").hidden = isHost;
    if (isHost) {
      if (document.activeElement !== $("lTopic") && document.activeElement !== $("lLevel")) {
        fillTopic($("lTopic"), room.topic);
        fillLevel($("lLevel"), room.topic, Math.min(room.level, PR.unlocked(prog, room.topic)));
      }
    } else $("guestSetup").innerHTML = `<b>${P.strands[room.topic].name}</b>, level ${room.level}: ${levelName(room.topic, room.level)}`;
  }
  const colorOf = (uid) => COLORS[Math.max(0, players().findIndex((p) => p.uid === uid)) % COLORS.length];
  function renderBlastLobby() {
    const isHost = room.host === user.uid, ps = players();
    const ul = $("ffaList"); ul.innerHTML = "";
    ps.forEach((p) => { const li = playerRow(p); li.style.setProperty("--pc", colorOf(p.uid)); ul.appendChild(li); });
    for (let i = ps.length; i < BLAST_MAX; i++) { const li = document.createElement("li"); li.className = "open"; li.textContent = "Open spot"; ul.appendChild(li); }
    $("switchBtn").hidden = true;
    $("botBtn").disabled = ps.length >= BLAST_MAX;
    renderSetup(isHost);
    const allHere = ps.every((p) => p.on !== false), ready = ps.length >= 2 && allHere;
    $("startBtn").hidden = !isHost;
    $("startBtn").disabled = !ready;
    $("startBtn").textContent = ready ? `Start with ${ps.length} players` : "Start match";
    $("startHint").textContent = ps.length < 2 ? "Waiting for at least one more player…" : !allHere ? "Waiting for everyone to reconnect…"
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
    if (room && room.game && !room.game.winner && !confirm("Leave the match? It counts as a loss on your record, and if your whole team leaves, the other team wins.")) return;
    leave();
  };
  $("startBtn").onclick = async () => {
    $("startBtn").disabled = true;
    const id = code + "-" + Date.now().toString(36); // one id per match, for the win/loss record
    try {
      if (modeOf(room) === "blast") await L.update("rooms/" + code, {
        state: "playing", blasts: null,
        game: { id, seed: newSeed(), start: L.now() + COUNTDOWN_MS + 600, n: BLAST_N },
      });
      else await L.update("rooms/" + code, {
        state: "playing", boards: null,
        game: { id, round: 1, seed: newSeed(), start: L.now() + COUNTDOWN_MS + 600, size: team("a").length, wins: { a: 0, b: 0 } },
      });
    } catch (e) { toast(e.message); $("startBtn").disabled = false; }
  };

  // Pretend players, only in demo mode (for trying Versus without a second computer)
  const BOT_NAMES = ["Ava K.", "Leo M.", "Zoe P.", "Eli R.", "Mia T."];
  $("botBtn").onclick = () => {
    const ps = players(), na = team("a").length, nb = team("b").length;
    const name = BOT_NAMES.find((n) => !ps.some((p) => p.name === n)) || "Pal";
    const pick = (cat) => AV.catalog[cat].items[Math.floor(Math.random() * AV.catalog[cat].items.length)].id;
    L.set(`rooms/${code}/players/bot${Date.now()}`, { name, bot: true, team: modeOf(room) === "blast" ? "a" : nb < na ? "b" : na < nb ? "a" : "b", on: true, joined: L.now(),
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
    if (won) countWin("race", g.id);
    const card = $("raceCard");
    card.className = "race-card end " + (won ? "win" : "lose");
    const why = g.forfeit ? (g.forfeit === mt ? "Your team left the match." : "The other team left the match.") : `${w[mt] || 0} to ${w[other(mt)] || 0}`;
    card.innerHTML = `<h2>${won ? "Your team wins! 🏆" : "The other team wins"}</h2><p class="why"></p>
      <p>You cleared <b>${matchClears}</b> problem${matchClears === 1 ? "" : "s"} and earned <b>${matchClears}</b> coin${matchClears === 1 ? "" : "s"}.</p>
      <p class="note">Race to 5 record: ${PR.versusText(prog, "race")}</p>
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
        const up = { state: "lobby", game: null, boards: null, blasts: null };
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
        if (r.state === "lobby" || (r.game && (r.game.winner || r.game.over))) {
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

  /* ---------- Blast Battle ---------- */
  const nameOf = (uid) => (room && room.players && room.players[uid] ? room.players[uid].name : "Someone");
  // Every screen builds the same falling schedule from the seed and start time
  function blastBoardFor(g) {
    if (blast.seed === g.seed) return blast.list;
    const qs = makeBoard(g.seed, room.topic, room.level, g.n || BLAST_N);
    const rnd = seeded((g.seed ^ 0x5bd1e995) >>> 0);
    let lastLane = -1;
    const list = qs.map((q, i) => {
      let lane; do { lane = Math.floor(rnd() * 4); } while (lane === lastLane);
      lastLane = lane;
      const fall = Math.min(15000, 9000 + Math.max(0, q.prompt.length - 12) * 140); // word problems fall slower
      const spawn = g.start + i * SPAWN_MS;
      return { prompt: q.prompt, answer: q.answer, lane, spawn, land: spawn + fall };
    });
    blast.els.forEach((e) => e.remove());
    const field = $("blastField");
    const els = list.map((q) => {
      const d = document.createElement("div");
      d.className = "rock" + (q.prompt.length > 24 ? " long" : ""); d.hidden = true;
      const pr = document.createElement("span"); pr.textContent = q.prompt;
      const who = document.createElement("small");
      d.append(pr, who); field.appendChild(d);
      return d;
    });
    const seen = {};
    for (const k of Object.keys(room.blasts || {})) seen[k] = { uid: room.blasts[k], at: -1e9 }; // already blasted before we got here
    Object.assign(blast, { seed: g.seed, list, els, seen, ended: false });
    return list;
  }
  function openBlast() {
    view("blast");
    timers.forEach(clearInterval);
    timers = [setInterval(blastTick, 200)];
    $("blastIn").value = ""; $("blastMsg").textContent = "";
    cancelAnimationFrame(blast.raf);
    const loop = () => { blastFrame(); blast.raf = requestAnimationFrame(loop); };
    blast.raf = requestAnimationFrame(loop);
    setTimeout(() => $("blastIn").focus(), 50);
  }
  function blastScores() {
    const count = {};
    for (const uid of Object.values(room.blasts || {})) if (uid) count[uid] = (count[uid] || 0) + 1;
    return players().map((p) => ({ uid: p.uid, name: p.name, on: p.on !== false, score: count[p.uid] || 0, color: colorOf(p.uid) }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }
  function renderBlast() {
    const g = room.game;
    if (!g) return;
    blastBoardFor(g);
    for (const [k, uid] of Object.entries(room.blasts || {})) {
      if (!uid) continue;
      if (!blast.seen[k]) { blast.seen[k] = { uid, at: performance.now() }; laser(uid, +k.slice(1)); }
      else blast.seen[k].uid = uid; // someone else won a close one
    }
    // Scores along the top, ships along the bottom
    const box = $("blastScores"); box.innerHTML = "";
    for (const s of blastScores()) {
      const c = document.createElement("span");
      c.className = "chip" + (s.uid === user.uid ? " me" : "") + (s.on ? "" : " away");
      c.style.setProperty("--pc", s.color);
      c.innerHTML = "<span class='nm'></span><b></b>";
      c.querySelector(".nm").textContent = s.uid === user.uid ? "You" : s.name;
      c.querySelector("b").textContent = s.score;
      box.appendChild(c);
    }
    const ground = $("blastGround"), ps = players();
    if (ground.dataset.who !== ps.map((p) => p.uid + p.on).join()) {
      ground.dataset.who = ps.map((p) => p.uid + p.on).join();
      ground.innerHTML = "";
      for (const p of ps) {
        const d = document.createElement("div"); d.className = "gship" + (p.on === false ? " away" : "");
        d.style.setProperty("--pc", colorOf(p.uid));
        d.appendChild(AV.miniCanvas(p.avatar || AV.defaults(), 46, { flame: 10 }));
        const n = document.createElement("span"); n.textContent = p.uid === user.uid ? "You" : p.name;
        d.appendChild(n); ground.appendChild(d);
      }
    }
    blastTick();
  }
  // Where each rock is right now (every frame, from the shared clock)
  function rockPos(q, now, field) {
    const W = field.clientWidth, H = field.clientHeight, laneW = W / 4;
    const t = Math.min(1, Math.max(0, (now - q.spawn) / (q.land - q.spawn)));
    return { x: q.lane * laneW + 8, y: -10 + t * (H - 96 - 70), w: laneW - 16 };
  }
  function blastFrame() {
    if (!room || !room.game || mode !== "blast" || !blast.list.length) return;
    const now = L.now(), field = $("blastField"), blasts = room.blasts || {}, pnow = performance.now();
    blast.list.forEach((q, i) => {
      const el = blast.els[i], k = "b" + i, seen = blast.seen[k];
      const by = blasts[k] || (seen && seen.uid) || null;
      if (now < q.spawn) { el.hidden = true; return; }
      if (by) {
        const age = pnow - (seen ? seen.at : -1e9);
        if (age > 800) { el.hidden = true; return; }
        if (!el.classList.contains("boom")) {
          const p = rockPos(q, now, field);
          el.style.transform = `translate(${p.x}px, ${p.y}px)`;
          el.classList.add("boom");
        }
        el.style.setProperty("--pc", colorOf(by));
        el.querySelector("small").textContent = "+1 " + (by === user.uid ? "You" : nameOf(by));
        el.hidden = false;
        return;
      }
      if (now >= q.land) {
        if (now - q.land > 800) { el.hidden = true; return; }
        el.classList.add("landed");
      }
      el.classList.remove("boom");
      const p = rockPos(q, now, field);
      el.style.width = p.w + "px";
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      el.hidden = false;
    });
  }
  function laser(uid, i) {
    const field = $("blastField"), q = blast.list[i];
    if (!q || mode !== "blast") return;
    const ps = players(), slot = Math.max(0, ps.findIndex((p) => p.uid === uid));
    const W = field.clientWidth, H = field.clientHeight, p = rockPos(q, L.now(), field);
    const svg = $("lasers"), ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", ((slot + 0.5) / ps.length) * W); ln.setAttribute("y1", H - 60);
    ln.setAttribute("x2", p.x + p.w / 2); ln.setAttribute("y2", p.y + 30);
    ln.setAttribute("stroke", colorOf(uid)); ln.setAttribute("stroke-width", "5"); ln.setAttribute("stroke-linecap", "round");
    svg.appendChild(ln);
    setTimeout(() => ln.remove(), 280);
  }
  function blastTick() {
    if (!room || !room.game || mode !== "blast" || !blast.list.length) return;
    const g = room.game, now = L.now(), input = $("blastIn"), ov = $("raceOverlay"), card = $("raceCard");
    const blasts = room.blasts || {}, list = blast.list;
    const resolved = list.filter((q, i) => blasts["b" + i] || now >= q.land).length;
    const frozen = Date.now() < frozenUntil;
    $("blastLeft").textContent = now < g.start ? "Blast Battle" : `${list.length - resolved} left`;

    if (!blast.ended && (g.over || (now >= g.start && resolved >= list.length))) {
      blast.ended = true;
      if (!g.over) L.update(`rooms/${code}/game`, { over: true }).catch(() => { });
    }
    if (blast.ended) {
      input.disabled = true;
      if (!endShown) { endShown = true; setTimeout(showBlastEnd, 900); } // let the last rock finish
      else refreshEndButtons();
      return;
    }
    if (now < g.start) {
      input.disabled = true; ov.hidden = false;
      card.className = "race-card count";
      card.innerHTML = `<p>Blast Battle</p><strong>${Math.min(3, Math.ceil((g.start - now) / 1000))}</strong>`;
    } else {
      ov.hidden = true;
      if (input.disabled && !frozen) { input.disabled = false; input.focus(); $("blastMsg").textContent = ""; }
      else if (frozen) input.disabled = true;
    }
    $("blastForm").classList.toggle("frozen", frozen);
    if (B.demo) botBlast(now);
  }
  $("blastForm").onsubmit = async (e) => {
    e.preventDefault();
    const input = $("blastIn"), val = input.value.trim(), msg = $("blastMsg");
    const g = room && room.game, now = L.now();
    if (!val || !g || blast.ended || now < g.start || Date.now() < frozenUntil) return;
    input.value = "";
    const blasts = room.blasts || {}, list = blast.list;
    const gone = (i) => blasts["b" + i] || blastPending.has(i);
    // Aim for the lowest matching problem on the screen
    const idx = list.map((q, i) => i)
      .filter((i) => !gone(i) && now >= list[i].spawn && now < list[i].land)
      .sort((a, b) => list[a].land - list[b].land)
      .find((i) => P.matches(val, list[i].answer));
    if (idx === undefined) {
      const late = list.findIndex((q, i) => gone(i) && now < q.land + 3000 && P.matches(val, q.answer));
      if (late >= 0) {
        const by = blasts["b" + late];
        msg.textContent = by && by !== user.uid ? `${nameOf(by)} blasted that one first!` : "Already blasted!"; msg.className = "race-msg";
        return;
      }
      frozenUntil = Date.now() + FREEZE_MS;
      msg.textContent = `"${val}" doesn't match anything. Wait a moment…`; msg.className = "race-msg bad";
      input.disabled = true;
      return;
    }
    msg.textContent = ""; msg.className = "race-msg";
    blastPending.add(idx);
    if (!blast.seen["b" + idx]) { blast.seen["b" + idx] = { uid: user.uid, at: performance.now() }; laser(user.uid, idx); }
    let r = { committed: false, value: null };
    try { r = await L.txn(`rooms/${code}/blasts/b${idx}`, (cur) => (cur ? undefined : user.uid)); } catch (err) { }
    blastPending.delete(idx);
    if (r.committed) { matchClears++; unbanked++; }
    else {
      msg.textContent = r.value && r.value !== user.uid ? `Too close! ${nameOf(r.value)} got it first.` : "That one got away.";
      if (!r.value) delete blast.seen["b" + idx];
      else blast.seen["b" + idx].uid = r.value;
    }
    if (room && mode === "blast") renderBlast();
    input.focus();
  };
  $("blastLeave").onclick = () => {
    if (!blast.ended && !confirm("Leave the match? It counts as a loss on your record.")) return;
    leave();
  };
  function showBlastEnd() {
    if (!room || mode !== "blast") return;
    bank();
    const scores = blastScores(), top = scores.length ? scores[0].score : 0;
    const winners = scores.filter((s) => s.score === top && top > 0);
    const mine = scores.find((s) => s.uid === user.uid) || { score: 0 };
    const won = top > 0 && mine.score === top;
    if (won) countWin("blast", room.game.id);
    const title = won ? (winners.length > 1 ? "You tied for first! 🏆" : "You win! 🏆")
      : !winners.length ? "Nobody blasted anything" : winners.length > 1 ? "It's a tie for first" : `${winners[0].name} wins!`;
    const card = $("raceCard");
    card.className = "race-card end " + (won ? "win" : "lose");
    card.innerHTML = `<h2></h2><ol class="standings"></ol>
      <p>You blasted <b>${matchClears}</b> problem${matchClears === 1 ? "" : "s"} and earned <b>${matchClears}</b> coin${matchClears === 1 ? "" : "s"}.</p>
      <p class="note">Blast Battle record: ${PR.versusText(prog, "blast")}</p>
      <div class="actions" id="endActs"></div><p class="note" id="endNote"></p>`;
    card.querySelector("h2").textContent = title;
    const ol = card.querySelector(".standings");
    for (const s of scores) {
      const li = document.createElement("li"); li.style.setProperty("--pc", s.color);
      if (s.uid === user.uid) li.className = "me";
      const place = document.createElement("i"); place.textContent = 1 + scores.filter((o) => o.score > s.score).length + "."; // ties share a place
      li.appendChild(place);
      const nm = document.createElement("span"); nm.textContent = s.uid === user.uid ? `${s.name} (you)` : s.name;
      const b = document.createElement("b"); b.textContent = s.score;
      li.append(nm, b); ol.appendChild(li);
    }
    $("raceOverlay").hidden = false;
    refreshEndButtons();
  }
  function botBlast(now) {
    if (room.host !== user.uid || now < room.game.start) return;
    const blasts = room.blasts || {}, list = blast.list;
    for (const p of players().filter((x) => x.bot)) {
      if (!botNext[p.uid]) botNext[p.uid] = now + 2500 + Math.random() * 2500;
      if (now < botNext[p.uid]) continue;
      botNext[p.uid] = now + 2500 + Math.random() * 3500;
      const live = list.map((q, i) => i).filter((i) => !blasts["b" + i] && !blastPending.has(i) && now >= list[i].spawn + 1500 && now < list[i].land);
      if (!live.length) continue;
      const i = live[Math.floor(Math.random() * live.length)];
      L.txn(`rooms/${code}/blasts/b${i}`, (cur) => (cur ? undefined : p.uid));
    }
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
  MML.versusDebug = () => ({ code, mode, board: board.list.map((q) => q.answer), rocks: blast.list.map((q) => ({ answer: q.answer, spawn: q.spawn, land: q.land })),
    now: L.now(), room: room && JSON.parse(JSON.stringify(room)) });

  // Start here: a room code in the address (from an invite or a refresh) joins that match
  const start = new URLSearchParams(location.search).get("room");
  if (start) { view("menu"); join(start); }
  else showMenu();
})();
