/* Mental Math Lab: Class Boss Battle
   Everyone answers questions at the same time. Right answers hurt the boss; wrong answers heal it a little.
   boss.html?screen=1 shows the big-screen view for the projector. */
(async function () {
  const B = MML.backend, P = MML.problems, PR = MML.progress, AV = MML.avatar;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  let user = null;
  try { user = await B.init(); } catch (e) { }
  if (!user) { location.href = "index.html"; return; }
  MML.siteLock.start(user);
  const board = user.isAdmin || params.get("screen") === "1";
  if (user.isAdmin) { $("backLink").href = "admin.html"; $("backLink").textContent = "Back to admin"; }
  if (board) document.body.classList.add("screen");

  let prog = null;
  if (!user.isAdmin) {
    try { prog = await B.loadProgress(user.uid); } catch (e) { return wait("Couldn't load your progress", e.message); }
    MML.avatar.applySite(prog.avatar.site);
  }

  let battle = null, key = null, joined = false, ended = false;
  let q = null, locked = false, streak = 0, answered = 0, correct = 0, coins = 0, myDmg = 0, sinceSave = 0;
  let hurt = 0, mad = 0, clock = 0, floaters = [];
  let custom = null, customTopic = null, customChecked = false; // this boss's student drawing, if the teacher uploaded one
  const bossName = () => (battle && battle.bossName) || (MML.bosses[battle && battle.topic] || MML.bosses.facts).name;

  /* ---------- Watch the live battle ---------- */
  try {
    await B.battle.watch((b, err) => {
      if (err) return wait("Can't reach the battle", err.message);
      battle = b;
      if (b && b.topic && b.topic !== customTopic) {
        customTopic = b.topic; custom = null; customChecked = false;
        MML.loadCustomBoss(b.topic).then((cb) => { if (customTopic === b.topic) { custom = cb; customChecked = true; render(); } });
      }
      const status = statusOf(b);
      if (b && b.startedAt !== key) { key = b.startedAt; joined = false; ended = false; streak = answered = correct = coins = myDmg = sinceSave = 0; q = null; }
      if (status === "none") return wait("No boss battle right now", "When your teacher starts one, it will show up here by itself. Keep this page open.");
      render();
      if (status === "live") {
        $("waitBox").hidden = true;
        if (!board) {
          if (!joined) { joined = true; B.battle.join(user, prog.avatar).catch(() => { }); }
          $("qBox").hidden = false;
          if (!q) nextQ();
        }
      } else finish(status);
    });
  } catch (e) { return wait("Boss battles aren't set up yet", e.message); }

  function statusOf(b) {
    if (!b || !b.startedAt) return "none";
    if (b.hp <= 0) return "won";
    if (!b.active || Date.now() > b.endsAt) return "over";
    return "live";
  }
  function wait(title, text) {
    $("qBox").hidden = true; $("waitBox").hidden = false;
    $("waitTitle").textContent = title; $("waitText").textContent = text;
  }

  /* ---------- Side panel, health bar, timer ---------- */
  function render() {
    if (!battle) return;
    $("bossName").textContent = bossName();
    const credit = $("bossCredit");
    credit.textContent = custom && custom.artist ? `Drawn by ${custom.artist}` : "";
    credit.hidden = !credit.textContent;
    const pct = Math.max(0, (battle.hp / battle.maxHp) * 100);
    $("hpfill").style.width = pct + "%";
    $("hptext").textContent = `${Math.max(0, Math.ceil(battle.hp)).toLocaleString("en-US")} / ${battle.maxHp.toLocaleString("en-US")}`;
    $("hpbar").setAttribute("aria-valuenow", Math.round(pct));
    const players = Object.entries(battle.players || {}).map(([uid, p]) => Object.assign({ uid }, p)).sort((a, b) => (b.damage || 0) - (a.damage || 0));
    const list = $("dmgList"); list.innerHTML = "";
    for (const p of players.slice(0, board ? 10 : 5)) {
      const li = document.createElement("li");
      if (!user.isAdmin && p.uid === user.uid) li.className = "me";
      const nm = document.createElement("span"); nm.textContent = p.name;
      const vl = document.createElement("b"); vl.textContent = p.damage || 0;
      li.append(AV.miniCanvas(p.avatar || AV.defaults(), 34), nm, vl);
      list.appendChild(li);
    }
    if (!players.length) list.innerHTML = "<li class='empty'>No hits yet</li>";
    $("playerCount").textContent = `${players.length} player${players.length === 1 ? "" : "s"} in the battle`;
    if (board && !$("joinNote")) {
      const n = document.createElement("p"); n.id = "joinNote"; n.className = "join-note";
      n.textContent = "To join: log in to Mental Math Lab and click Join the battle.";
      $("playerCount").after(n);
    }
    if (!board) {
      $("youBox").hidden = false;
      $("youDmg").textContent = myDmg;
      $("youCount").textContent = `Answered ${answered}, ${correct} right. Coins: +${coins}`;
    }
  }
  setInterval(() => {
    if (!battle || !battle.startedAt) { $("bossTime").textContent = ""; return; }
    const left = Math.max(0, battle.endsAt - Date.now());
    $("bossTime").textContent = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")} left`;
    if (statusOf(battle) === "over" && !ended) finish("over");
  }, 250);

  /* ---------- Questions ---------- */
  function nextQ() {
    if (statusOf(battle) !== "live") return;
    q = P.generate(battle.topic, battle.level);
    const wrong = q.wrong.slice(0, 5).sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [q.answer, ...wrong].sort(() => Math.random() - 0.5);
    q.choices = choices;
    locked = false;
    $("qPrompt").textContent = q.prompt;
    $("qFb").textContent = ""; $("qFb").className = "boss-fb";
    const box = $("qChoices"); box.innerHTML = "";
    choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "choice";
      b.innerHTML = `<kbd>${i + 1}</kbd> `; b.append(c);
      b.onclick = () => answer(i);
      box.appendChild(b);
    });
  }
  function answer(i) {
    if (locked || !q || statusOf(battle) !== "live") return;
    locked = true;
    const ok = q.choices[i] === q.answer, btns = $("qChoices").children;
    btns[q.choices.indexOf(q.answer)].classList.add("right");
    if (!ok) btns[i].classList.add("wrong");
    PR.record(prog, battle.topic, battle.level, q, ok);
    answered++; sinceSave++;
    if (ok) {
      streak++; correct++;
      const m = streak >= 10 ? 3 : streak >= 5 ? 2 : 1, dmg = 10 * m;
      myDmg += dmg; coins += m; prog.coins += m; hurt = 1;
      floaters.push({ text: `−${dmg}`, x: 0.5 + (Math.random() - 0.5) * 0.3, y: 0.4, life: 1 });
      B.battle.hit(user, dmg).catch((e) => showFb(e.message, "bad"));
      showFb(m > 1 ? `Hit! ${dmg} damage (×${m} streak)` : `Hit! ${dmg} damage`, "good");
      setTimeout(nextQ, 450);
    } else {
      streak = 0; mad = 1;
      B.battle.heal(user, 5, battle.maxHp).catch(() => { });
      showFb(`The boss healed 5. ${q.prompt} = ${q.answer}. ${q.tip}`, "bad");
      setTimeout(nextQ, 2600);
    }
    render();
    if (sinceSave >= 10) { sinceSave = 0; B.saveProgress(user, prog, { boards: true }).catch(() => { }); }
  }
  function showFb(text, cls) { $("qFb").textContent = text; $("qFb").className = "boss-fb " + cls; }
  addEventListener("keydown", (e) => { if (/^[1-4]$/.test(e.key) && !$("qBox").hidden) answer(+e.key - 1); });

  /* ---------- End of battle ---------- */
  async function finish(status) {
    if (ended) return;
    ended = true; q = null;
    $("qBox").hidden = true;
    const boss = bossName();
    const won = status === "won";
    let text = won ? `Your class beat ${boss}!` : `${boss} got away this time.`;
    if (!board) {
      let bonus = 0;
      if (won && correct >= 5) { bonus = 50; prog.coins += 50; coins += 50; }
      text += ` You dealt ${myDmg} damage and earned ${coins} coin${coins === 1 ? "" : "s"}${bonus ? " (including a 50 coin victory bonus)" : ""}.`;
      if (won && correct < 5 && answered > 0) text += " Get at least 5 right next time to earn the victory bonus.";
      // Remember this battle for the trophy shelf (only if this student actually played in it)
      if (answered > 0 && !prog.bosses.some((x) => x.id === battle.startedAt)) {
        prog.bosses.push({ id: battle.startedAt, topic: battle.topic, level: battle.level, won, dmg: myDmg, at: Date.now() });
        if (prog.bosses.length > 60) prog.bosses.splice(0, prog.bosses.length - 60);
        if (won) text += " It's on your boss trophy shelf now!";
      }
      if (answered > 0) { try { await B.saveProgress(user, prog, { boards: true }); } catch (e) { text += " Couldn't save: " + e.message; } }
    }
    $("waitBox").hidden = false;
    $("waitTitle").textContent = won ? "Victory!" : "Battle over";
    $("waitText").textContent = text;
    render();
  }

  /* ---------- Drawing ---------- */
  const cv = $("bossCanvas"), ctx = cv.getContext("2d");
  let last = performance.now();
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; clock += dt;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = w * dpr; cv.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    AV.drawBackground(ctx, prog ? prog.avatar.theme : "midnight", w, h, clock * 20, false);
    hurt = Math.max(0, hurt - dt * 3); mad = Math.max(0, mad - dt * 0.8);
    const kind = battle && battle.topic ? battle.topic : "facts";
    const defeated = battle && battle.hp <= 0;
    ctx.globalAlpha = defeated ? 0.35 : 1;
    const bx = w / 2, by = board ? h * 0.52 : h * 0.44, bs = Math.min(w, h) * (board ? 0.62 : 0.56);
    // Wait briefly for a drawing to load before falling back to the built-in art
    if (custom) MML.drawCustomBoss(ctx, custom, bx, by, bs * 1.1, clock, hurt, mad);
    else if (!customTopic || customChecked || clock > 3) MML.drawBoss(ctx, kind, bx, by, bs, clock, hurt, mad);
    ctx.globalAlpha = 1;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "700 34px Lexend, sans-serif"; ctx.lineWidth = 6; ctx.strokeStyle = "#151a45";
    for (const f of floaters) {
      f.life -= dt; f.y -= dt * 0.15;
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.strokeText(f.text, f.x * w, f.y * h); ctx.fillStyle = "#ffd23f"; ctx.fillText(f.text, f.x * w, f.y * h);
    }
    ctx.globalAlpha = 1;
    floaters = floaters.filter((f) => f.life > 0);
    if (!board && prog) {
      ctx.save(); ctx.translate(w / 2, h - 20); ctx.rotate(0); ctx.scale(0.7, 0.7);
      ctx.translate(0, -60); AV.drawShip(ctx, prog.avatar, { flame: 12 + Math.sin(clock * 20) * 3, time: clock, hot: streak >= 5 });
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
