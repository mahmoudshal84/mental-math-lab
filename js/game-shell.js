/* Mental Math Lab: shared game engine
   Every game (js/game-*.js) registers itself in MML.games and gets a toolkit ("S")
   for questions, scoring, lives, feedback, and saving. This file runs the page. */
(async function () {
  const P = MML.problems, PR = MML.progress, AV = MML.avatar, B = MML.backend, GI = MML.gameInfo;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { ink: "#151a45", sun: "#ffd23f", pink: "#ff4f8b", mint: "#2ee6a6", paper: "#f6f7ff" };
  const FONT = "Lexend, 'Segoe UI', system-ui, sans-serif";

  const gameId = MML.games[params.get("game")] ? params.get("game") : "lane";
  const def = MML.games[gameId], info = GI[gameId];
  document.title = `${info.name} · Mental Math Lab`;

  /* ---------- Log in and load progress ---------- */
  const user = await B.requireStudent();
  let prog;
  try { prog = await B.loadProgress(user.uid); }
  catch (e) { $("loadMsg").textContent = e.message; return; }

  /* ---------- Mode, topic, and level from the link ---------- */
  // Two modes: a 20-question level round, or endless Arcade
  const mode = params.get("mode") === "arcade" ? "arcade" : "levels";
  const arcade = mode === "arcade";
  const mix = params.get("mix") === "school" ? "school" : "grade";
  let topic = P.strands[params.get("topic")] ? params.get("topic") : "facts";
  if (info.supports && !info.supports.includes(topic)) topic = info.supports[0];
  const strand = P.strands[topic];
  const teacher = params.get("set") === "1";
  let level = parseInt(params.get("level"), 10) || PR.unlocked(prog, topic);
  level = Math.max(1, Math.min(level, teacher ? strand.levels.length : PR.unlocked(prog, topic)));
  const label = arcade
    ? `${info.name} Arcade: ${mix === "school" ? "School mix" : `Grade ${user.profile.grade} mix`}`
    : `${strand.name}, level ${level}: ${strand.levels[level - 1].name}`;
  const ROUND = info.round || 20, LIVES = def.lives || 3, SHIELD_EVERY = 8;

  const backQ = new URLSearchParams();
  if (teacher) {
    backQ.set("topic", topic); backQ.set("level", level); backQ.set("set", "1");
    if (params.get("lock") === "1") backQ.set("lock", "1");
  }
  $("backLink").href = $("endBack").href = "index.html" + (teacher ? "?" + backQ : "");

  /* ---------- Canvas ---------- */
  const cv = $("stage"), ctx = cv.getContext("2d");
  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  resize();

  /* ---------- Sound ---------- */
  let soundOn = localStorage.getItem("mml-sound") === "on", actx = null;
  function beep(f, d, type = "triangle", vol = 0.07, slide = 1) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d);
    } catch (e) { }
  }
  const sfx = {
    right: () => { beep(660, 0.1); setTimeout(() => beep(990, 0.14), 70); },
    wrong: () => beep(240, 0.35, "sawtooth", 0.05, 0.5),
    shield: () => { beep(520, 0.1); setTimeout(() => beep(780, 0.1), 80); setTimeout(() => beep(1040, 0.18), 160); },
    move: () => beep(420, 0.04, "sine", 0.03),
    boom: () => beep(120, 0.3, "square", 0.05, 0.4),
    tick: () => beep(880, 0.03, "sine", 0.02),
  };
  const renderSound = () => ($("soundBtn").textContent = soundOn ? "Sound: on" : "Sound: off");
  $("soundBtn").onclick = (e) => {
    soundOn = !soundOn;
    try { localStorage.setItem("mml-sound", soundOn ? "on" : "off"); } catch (err) { }
    renderSound(); e.currentTarget.blur(); game.focus && game.focus();
  };
  renderSound();

  /* ---------- Run state ---------- */
  let R = { state: "ready" };
  let fx = { particles: [], floaters: [] };
  let clock = 0;
  function newRun() {
    R = { state: "playing", hearts: LIVES, shield: false, score: 0, streak: 0, bestStreak: 0,
      answered: 0, correct: 0, coins: 0, count: 0, missed: [], recent: [], wrongAt: 0, onClose: null, endTimer: null };
    fx = { particles: [], floaters: [] };
    hud();
  }
  const mult = () => (R.streak >= 10 ? 3 : R.streak >= 5 ? 2 : 1);

  /* ---------- Level stars ---------- */
  const starsLeft = () => PR.starsFor((R.answered || 0) - (R.correct || 0));
  function starNote() {
    const wrong = R.answered - R.correct, left = starsLeft();
    if (wrong <= PR.FREE_MISSES) return "That was your free miss. You still have 3 stars.";
    if (left > 0) return `You have ${left} star${left === 1 ? "" : "s"} left.`;
    return "No stars left this round. Finish it for practice, then try again to earn stars.";
  }

  /* ---------- Toolkit handed to each game ---------- */
  const S = {
    user, prog, params, mode, arcade, mix, topic, level, strand, reduced, C, FONT, sfx,
    canvas: cv, ctx,
    get W() { return W; }, get H() { return H; },
    get state() { return R.state; },
    get time() { return clock; },
    get count() { return R.count || 0; },
    get streak() { return R.streak || 0; },
    theme: () => prog.avatar.theme,
    avatar: () => prog.avatar,
    mult: () => (R.streak ? mult() : 1),
    ui: $("gameUi"),

    /* A question in the shared format, from the chosen topic/level (or the arcade mix) */
    nextQuestion(filter = () => true) {
      R.count++;
      let q;
      for (let i = 0; i < 25; i++) {
        if (arcade) {
          const [s, l] = S.mixPick(P.mixes[mix === "school" ? "school" : user.profile.grade] || P.mixes.school);
          q = Object.assign(P.generate(s, l), { strand: s, level: l });
        } else q = Object.assign(PR.nextProblem(prog, topic, level, R.recent), { strand: topic, level });
        if (filter(q) && !R.recent.includes(q.prompt)) break;
      }
      R.recent.push(q.prompt); if (R.recent.length > 8) R.recent.shift();
      return q;
    },
    /* Arcade: the pool of problem types grows as the run goes on */
    mixPick(list) {
      const pool = list.slice(0, Math.min(list.length, 3 + Math.floor((R.count || 0) / 5)));
      return pool[Math.floor(Math.random() * pool.length)];
    },
    /* Games with their own content ask for a [topic, level] this way */
    content() { R.count++; return arcade ? S.mixPick(def.mixes[mix === "school" ? "school" : user.profile.grade] || def.mixes.school) : [topic, level]; },

    /* Record an answer. q needs prompt, answer, strand, level (tip optional).
       opts.review=false keeps it off the review list; opts.missed=false keeps it off "Review these". */
    record(q, ok, opts = {}) {
      PR.record(prog, q.strand || topic, q.level || level, q, ok, { review: opts.review });
      R.answered++;
      if (ok) {
        R.correct++; R.streak++; R.bestStreak = Math.max(R.bestStreak, R.streak);
        if (R.streak === 5) S.float("Double points!", W / 2, H * 0.45, C.pink);
        if (R.streak === 10) S.float("Triple points!", W / 2, H * 0.45, C.pink);
        if (arcade && R.streak % SHIELD_EVERY === 0 && !R.shield) {
          R.shield = true; S.float("Shield!", W / 2, H * 0.38, C.mint); setTimeout(sfx.shield, 200);
        }
      } else {
        R.streak = 0;
        if (opts.missed !== false && !R.missed.some((m) => m.prompt === q.prompt)) R.missed.push(q);
        if (!arcade) {
          const wrong = R.answered - R.correct;
          if (wrong === PR.FREE_MISSES) S.float("Free miss used", W / 2, 110, C.sun);
          else if (wrong <= 3 + PR.FREE_MISSES) S.float(starsLeft() ? "Lost a star" : "Out of stars", W / 2, 110, C.pink);
        }
      }
      // Last question of a level round: finish after the player sees the result
      if (!arcade && R.answered >= ROUND && !R.complete) {
        R.complete = true;
        if (ok) S.endSoon(1100);
        else setTimeout(() => { if (R.state === "playing") S.endSoon(2200); }, 0); // a "Not quite" card ends it when closed
      }
      hud();
      return mult();
    },
    addScore(n) { R.score += Math.round(n); hud(); },
    addCoins(n) { R.coins += n; },
    /* Lose a life (or the shield). Returns { alive, saved } */
    loseLife() {
      if (!arcade) return { alive: true, saved: false }; // level rounds have no lives; misses cost stars instead
      if (R.shield) { R.shield = false; hud(); return { alive: true, saved: true }; }
      R.hearts--; hud();
      return { alive: R.hearts > 0, saved: false };
    },
    alive: () => !arcade || R.hearts > 0,

    /* Big "Not quite" card. The game waits until the student clicks Keep going (the next question isn't shown yet). */
    miss(q, picked, opts = {}) {
      S.record(q, false, opts);
      const life = S.loseLife();
      sfx.wrong();
      R.state = "wrong"; R.wrongAt = performance.now(); R.onClose = opts.onClose || null;
      const fix = $("wrongFix");
      fix.innerHTML = "";
      fix.append((opts.fixPrefix != null ? opts.fixPrefix : q.prompt + " = "));
      const s = document.createElement("span"); s.className = "ans"; s.textContent = opts.fixAnswer || q.answer;
      fix.append(s);
      let msg = picked || "";
      if (!arcade) msg += " " + starNote();
      else if (life.saved) msg += " Your shield saved a life.";
      else msg += R.hearts > 0 ? ` ${R.hearts} ${R.hearts === 1 ? "life" : "lives"} left.` : " That was your last life.";
      $("wrongTitle").textContent = opts.title || "Not quite";
      $("wrongPicked").textContent = msg.trim();
      $("wrongTip").textContent = q.tip || "";
      $("wrongTip").hidden = !q.tip;
      $("wrongBtn").textContent = S.alive() && !R.complete ? "Keep going" : "See results";
      $("wrongScreen").hidden = false;
      $("wrongBtn").focus();
    },
    /* Small note at the bottom that doesn't stop the game */
    note(fixText, tip, ms = 4000) {
      $("tipFix").textContent = fixText; $("tipText").textContent = tip || "";
      $("tipPanel").hidden = false;
      clearTimeout(S.note.t); S.note.t = setTimeout(() => ($("tipPanel").hidden = true), ms);
    },
    /* End the run after a short delay (so the player sees what happened) */
    endSoon(ms = 1200) { if (!R.endTimer) R.endTimer = setTimeout(endRun, ms); R.state = "ending"; },
    end: () => endRun(),

    problem(text, opts = {}) {
      const el = $("problem");
      el.textContent = text;
      el.className = "problem" + (text.length > 16 ? " long" : "") + (opts.review ? " review" : "") + (opts.solved ? " solved" : "");
      el.hidden = false;
    },
    hideProblem() { $("problem").hidden = true; },
    hint(html) { const h = $("hint"); h.innerHTML = html; h.hidden = !html; h.style.opacity = 1; },
    fadeHint() { $("hint").style.opacity = 0; },

    float(text, x, y, color = C.sun) { fx.floaters.push({ text, x, y, life: 1.1, color }); },
    burst(x, y, color, n = 16) {
      if (reduced) n = Math.ceil(n / 4);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 220;
        fx.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.7, max: 0.7, color, size: 3 + Math.random() * 5 });
      }
    },
    /* Helpers for drawing */
    background(scroll) { AV.drawBackground(ctx, prog.avatar.theme, W, H, scroll, reduced); },
    ship(x, y, scale = 1, o = {}) {
      ctx.save(); ctx.translate(x, y); if (o.rotate) ctx.rotate(o.rotate); ctx.scale(scale, scale);
      AV.drawShip(ctx, prog.avatar, Object.assign({ time: clock, shield: R.shield, hot: S.mult() > 1 }, o));
      ctx.restore();
    },
    roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    },
    fitFont(text, maxW, size, weight = 700) {
      for (; size > 12; size -= 2) { ctx.font = `${weight} ${size}px ${FONT}`; if (ctx.measureText(text).width <= maxW) break; }
      return size;
    },
  };

  const game = def.create(S);

  /* ---------- HUD ---------- */
  function hud() {
    const h = $("hearts");
    h.innerHTML = "";
    if (arcade) {
      for (let i = 0; i < LIVES; i++) {
        const s = document.createElement("span");
        s.textContent = "♥"; s.style.color = i < (R.hearts ?? LIVES) ? C.pink : "rgba(246,247,255,.25)";
        h.appendChild(s);
      }
      h.setAttribute("aria-label", `${R.hearts ?? LIVES} lives`);
    } else {
      // Level rounds: 3 stars that empty as misses add up
      const left = starsLeft();
      h.className = "chip hearts round-stars";
      for (let i = 0; i < 3; i++) {
        const s = document.createElement("span");
        s.textContent = i < left ? "★" : "☆"; s.className = i < left ? "on" : "off";
        h.appendChild(s);
      }
      h.setAttribute("aria-label", `${left} of 3 stars left`);
      h.title = "Your first miss is free. After that, each miss empties a star.";
    }
    $("shield").hidden = !R.shield;
    const a = R.answered || 0, c = R.correct || 0;
    const count = $("answered");
    count.textContent = arcade ? `Answered ${a}, ${c} right` : `Question ${Math.min(a + (R.complete ? 0 : 1), ROUND)} of ${ROUND}, ${c} right`;
    const bar = $("roundBar");
    if (bar) { bar.hidden = arcade; bar.firstElementChild.style.width = (Math.min(a, ROUND) / ROUND) * 100 + "%"; }
    const m = R.streak ? mult() : 1;
    $("mult").hidden = m === 1;
    $("mult").textContent = `×${m} points`;
    $("score").textContent = `Score ${R.score || 0}`;
  }

  /* ---------- Screens ---------- */
  function afterWrong() {
    if (R.state !== "wrong" || performance.now() - R.wrongAt < 700) return;
    $("wrongScreen").hidden = true;
    if (!S.alive() || R.complete) return endRun();
    R.state = "playing"; blur();
    const f = R.onClose; R.onClose = null;
    if (f) f();
    game.focus && game.focus();
  }
  function start() {
    if (R.state !== "ready" && R.state !== "over") return;
    $("startScreen").hidden = true; $("endScreen").hidden = true;
    newRun(); blur();
    game.start();
    game.focus && game.focus();
  }

  function endRun() {
    if (R.state === "over" || R.state === "ready") return;
    clearTimeout(R.endTimer);
    R.state = "over";
    game.onEnd && game.onEnd();
    S.hideProblem();
    ["wrongScreen", "tipPanel"].forEach((id) => ($(id).hidden = true));

    let title = arcade ? "Run over" : "Round ended early";
    const starsEl = $("endStars"), noteEl = $("endNote"), unlockEl = $("endUnlock");
    starsEl.hidden = noteEl.hidden = unlockEl.hidden = true;
    $("endBoards").hidden = !arcade;

    if (arcade) {
      const r = PR.finishArcade(prog, gameId, mix, R.score, R.coins);
      if (r.allTimeBest) title = "New all-time best!";
      else if (r.weekBest) title = "New best this week!";
      noteEl.textContent = `Your best this week: ${r.week}. All-time best: ${r.ever}.`;
      noteEl.hidden = false;
      $("sScoreLabel").textContent = "Score";
    } else {
      const r = PR.finishLevel(prog, gameId, topic, level, { answered: R.answered, correct: R.correct, coins: R.coins, complete: !!R.complete });
      starsEl.innerHTML = [0, 1, 2].map((i) => `<span class="${i < r.stars ? "" : "off"}">★</span>`).join("");
      starsEl.setAttribute("aria-label", `${r.stars} of 3 stars`);
      starsEl.hidden = false;
      const missed = R.answered - R.correct;
      if (!R.complete) noteEl.textContent = `You answered ${R.answered} of ${ROUND}. Finish the whole round to earn stars.`;
      else if (!r.stars) noteEl.textContent = `You missed ${missed}, so no stars this time. Finish with ${3 + PR.FREE_MISSES} misses or fewer to earn a star${level < strand.levels.length ? " and unlock the next level" : ""}.`;
      else if (r.xpGained) noteEl.textContent = `You missed ${missed}. +${r.xpGained} XP for new stars on this level.`;
      else if (r.prev) noteEl.textContent = `You missed ${missed}. You already have ${r.prev} star${r.prev > 1 ? "s" : ""} here. Beat it for more XP.`;
      else noteEl.textContent = `You missed ${missed}.`;
      noteEl.hidden = false;
      if (r.unlockedLevel) {
        const q = new URLSearchParams({ game: gameId, topic, level: r.unlockedLevel });
        unlockEl.innerHTML = "";
        unlockEl.append(`Level ${r.unlockedLevel} unlocked: ${strand.levels[r.unlockedLevel - 1].name}. `);
        const a = document.createElement("a"); a.href = "play.html?" + q; a.textContent = "Play it now";
        unlockEl.append(a); unlockEl.hidden = false;
      }
      const bestKey = `${gameId}:${topic}:${level}`, oldBest = prog.bests[bestKey] || 0;
      if (R.complete) title = r.stars ? "Level complete!" : "Round complete";
      if (R.score > oldBest && R.answered > 0) { prog.bests[bestKey] = R.score; if (!R.complete) title = "New best score!"; else noteEl.textContent += " New best score!"; }
      $("sScoreLabel").textContent = oldBest && R.score <= oldBest ? `Score (best ${oldBest})` : "Score";
    }

    $("endTitle").textContent = title;
    $("endTopic").textContent = label;
    $("sScore").textContent = R.score;
    $("sAcc").textContent = R.answered ? `${R.correct} / ${R.answered}` : "0";
    $("sStreak").textContent = R.bestStreak;
    $("sCoins").textContent = R.coins;
    const list = $("missedList"); list.innerHTML = "";
    for (const m of R.missed.slice(0, 8)) {
      const li = document.createElement("li");
      const a = document.createElement("span"); a.textContent = m.prompt;
      const b = document.createElement("b"); b.textContent = m.answer;
      li.append(a, b); list.appendChild(li);
    }
    $("missedBox").hidden = R.missed.length === 0;
    $("endScreen").hidden = false;
    $("againBtn").focus();
    save();
  }
  async function save() {
    const msg = $("saveMsg"), again = $("againBtn"), retry = $("retrySave");
    msg.textContent = "Saving…"; again.disabled = true; retry.hidden = true;
    try { await B.saveProgress(user, prog, { boards: true }); msg.textContent = "Saved."; }
    catch (e) { msg.textContent = `Couldn't save: ${e.message}`; retry.hidden = false; }
    again.disabled = false;
  }
  function blur() { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); }

  $("startBtn").onclick = start;
  $("againBtn").onclick = start;
  $("retrySave").onclick = save;
  $("wrongBtn").onclick = afterWrong;
  $("endBtn").onclick = (e) => { e.currentTarget.blur(); endRun(); };
  $("startTitle").textContent = info.name;
  $("startTopic").textContent = label;
  const rules = $("startRules");
  for (const r of def.rules(S)) { const li = document.createElement("li"); li.innerHTML = r; rules.appendChild(li); }
  const li = document.createElement("li");
  li.textContent = arcade
    ? "Arcade gets harder the longer you last. Your best score goes on the leaderboard."
    : `Each round is ${ROUND} questions. You start with 3 stars. Your first miss is free, then each miss empties a star. Finish with at least 1 star to unlock the next level.`;
  rules.appendChild(li);
  $("startLives").textContent = arcade
    ? `You have ${LIVES} lives. Get ${SHIELD_EVERY} right in a row to earn a shield that saves one.`
    : "No lives in a level round: you always get to finish all the questions.";
  // There is no pause. Leaving the tab doesn't stop the game (see "catch up" in the loop below).
  addEventListener("beforeunload", (e) => { if (["playing", "wrong"].includes(R.state)) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Keys: the engine handles screens, the game handles play ---------- */
  addEventListener("keydown", (e) => {
    const k = e.key, typing = e.target && e.target.tagName === "INPUT";
    if (!typing && [" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) e.preventDefault();
    const confirm = k === " " || k === "Enter";
    if (R.state === "ready") { if (confirm && !e.repeat && !$("startScreen").hidden) { e.preventDefault(); start(); } return; }
    if (R.state === "over" || R.state === "ending") return;
    if (R.state === "wrong") { if (confirm && !e.repeat) { e.preventDefault(); afterWrong(); } return; }
    game.onKey && game.onKey(e);
  });
  addEventListener("keyup", (e) => { if (R.state === "playing" && game.onKeyUp) game.onKeyUp(e); });

  /* ---------- Loop ---------- */
  let last = performance.now();
  function frame(now) {
    const raw = Math.max(0, (now - last) / 1000);
    last = now;
    let dt = Math.min(0.05, raw);
    // No pausing: browsers freeze hidden tabs, so when the student comes back the game
    // catches up on all the time they were away (problems keep falling, timers keep running).
    if (R.state === "playing" && raw > 0.25) {
      let left = Math.min(raw, 180);
      while (left > 0 && R.state === "playing") { const step = Math.min(0.05, left); clock += step; game.update(step); left -= step; }
      if (raw > 2 && $("tipPanel").hidden) S.note("The game kept going while you were away.", "There's no pausing, so stay on this tab until the round is over.", 4500);
      dt = 0;
    }
    clock += dt;
    if (R.state === "playing" && dt > 0) game.update(dt);
    else if (game.idle) game.idle(dt);
    for (const p of fx.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; }
    fx.particles = fx.particles.filter((p) => p.life > 0);
    for (const f of fx.floaters) { f.life -= dt; f.y -= 50 * dt; }
    fx.floaters = fx.floaters.filter((f) => f.life > 0);

    game.draw(ctx);
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `700 26px ${FONT}`;
    ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.lineJoin = "round";
    for (const f of fx.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  // If the teacher closes the site (or Arcade, during an Arcade run), end the run and save it
  MML.siteLock.start(user, {
    arcade,
    onLock() {
      if (["playing", "wrong", "ending"].includes(R.state)) { endRun(); return "Your last run was saved."; }
      return "";
    },
  });

  hud();
  $("loadScreen").hidden = true;
  $("startScreen").hidden = false;
  $("startBtn").focus();
  requestAnimationFrame(frame);
  window.mmlGame = { get run() { return R; }, get game() { return game; }, S };
})();
