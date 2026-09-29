/* Mental Math Lab: hub page (login + student home) */
(async function () {
  const B = MML.backend, P = MML.problems, PR = MML.progress, AV = MML.avatar;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const views = ["loadingView", "loginView", "teacherView", "hubView"];
  const show = (id) => views.forEach((v) => ($(v).hidden = v !== id));

  let user = null;
  try { user = await B.init(); } catch (e) { user = null; }
  if (!user) return showLogin();
  if (user.isAdmin) return showTeacher();
  return showHub();

  function showLogin() {
    AV.applySite("lab");
    show("loginView");
    $("demoHint").hidden = !B.demo;
    $("lUser").focus();
    $("loginForm").onsubmit = async (e) => {
      e.preventDefault();
      $("lErr").textContent = "";
      $("lBtn").disabled = true; $("lBtn").textContent = "Logging in…";
      try {
        user = await B.studentLogin($("lUser").value, $("lPass").value);
        if (user.isAdmin) showTeacher(); else await showHub();
      } catch (err) {
        $("lErr").textContent = err.message;
      }
      $("lBtn").disabled = false; $("lBtn").textContent = "Log in";
    };
  }

  function showTeacher() {
    show("teacherView");
    $("tLogout").onclick = async () => { await B.logout(); location.href = "index.html"; };
  }

  async function showHub() {
    show("loadingView");
    let prog;
    try { prog = await B.loadProgress(user.uid); }
    catch (e) { $("loadingView").innerHTML = `<p>${e.message}</p>`; return; }
    show("hubView");

    const lastKey = "mml-last-" + user.uid;
    const last = (() => { try { return JSON.parse(localStorage.getItem(lastKey)) || {}; } catch (e) { return {}; } })();

    // Teacher links carry ?topic=...&level=...&set=1 (and &lock=1 to hide the topic picker)
    let teacher = params.get("set") === "1" && P.strands[params.get("topic")];
    const locked = teacher && params.get("lock") === "1";
    let topic = teacher ? params.get("topic") : P.strands[last.topic] ? last.topic : "facts";
    let level = teacher ? parseInt(params.get("level"), 10) || 1 : last.level || 1;

    const maxLevel = (id) => P.strands[id].levels.length;
    const unlocked = (id) => PR.unlocked(prog, id);
    const starText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
    function clampLevel() { level = Math.max(1, Math.min(level, teacher ? maxLevel(topic) : unlocked(topic))); }

    // Header
    $("hello").textContent = `Hi, ${user.profile.displayName}`;
    const gchip = document.createElement("span");
    gchip.className = "grade-chip"; gchip.textContent = `Grade ${user.profile.grade}`;
    $("hello").append(" ", gchip);
    AV.applySite(prog.avatar.site);

    // Lock screen, and Arcade open/closed
    MML.siteLock.start(user, {
      onSettings(s) {
        $("arcClosed").hidden = s.arcadeOpen; $("arcActions").hidden = !s.arcadeOpen;
        $("vsClosed").hidden = s.versusOpen; $("vsBtn").hidden = !s.versusOpen;
      },
    });
    renderTrophies();
    showFriendRequests();
    $("coins").textContent = prog.coins;
    const vr = prog.versus;
    $("vsRecord").innerHTML = vr.race.played + vr.blast.played
      ? `Your record: <b>Race to 5</b> ${PR.versusText(prog, "race")}. <b>Blast Battle</b> ${PR.versusText(prog, "blast")}.`
      : "Your record: no matches yet.";
    $("starCount").textContent = PR.totalStars(prog);
    $("xp").textContent = prog.xp;
    $("logout").onclick = async () => { await B.logout(); location.href = "index.html"; };
    MML.help.mount(document.querySelector("#hubView .nav"));

    const GI = MML.gameInfo;
    const supports = (g, t) => !GI[g].supports || GI[g].supports.includes(t);
    const gameStars = (g, t, n) => prog.stars[PR.starKey(g, t, n)] || 0;
    const bestStars = (t, n) => Math.max(0, ...GI.order.map((g) => gameStars(g, t, n)));

    // Arcade: pick a game, then grade mix or school mix
    let arcGame = GI[localStorage.getItem("mml-arc-" + user.uid)] ? localStorage.getItem("mml-arc-" + user.uid) : "lane";
    function renderArcade() {
      const tabs = $("arcTabs"); tabs.innerHTML = "";
      for (const g of GI.order) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "tab"; b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", g === arcGame); b.textContent = GI[g].name;
        b.onclick = () => { arcGame = g; try { localStorage.setItem("mml-arc-" + user.uid, g); } catch (e) { } renderArcade(); };
        tabs.appendChild(b);
      }
      $("arcGrade").firstChild.textContent = `Grade ${user.profile.grade} mix`;
      $("arcGrade").href = `play.html?game=${arcGame}&mode=arcade&mix=grade`;
      $("arcSchool").href = `play.html?game=${arcGame}&mode=arcade&mix=school`;
      const g = PR.weekArcade(prog, arcGame, "grade"), s = PR.weekArcade(prog, arcGame, "school");
      $("arcGradeBest").textContent = g ? `Your best this week: ${g}` : "No score yet this week";
      $("arcSchoolBest").textContent = s ? `Your best this week: ${s}` : "No score yet this week";
    }
    renderArcade();

    function renderTopics() {
      const box = $("topics");
      box.innerHTML = "";
      for (const id of P.order) {
        const s = P.strands[id];
        const b = document.createElement("button");
        b.type = "button"; b.className = "topic";
        b.setAttribute("aria-pressed", id === topic);
        const games = GI.order.filter((g) => supports(g, id));
        const got = games.reduce((n, g) => n + s.levels.reduce((m, _, i) => m + gameStars(g, id, i + 1), 0), 0);
        b.innerHTML = `<strong>${s.name}</strong><span>${s.blurb}</span><small>★ ${got} of ${games.length * s.levels.length * 3} stars in ${games.length} games</small>`;
        b.onclick = () => { topic = id; level = unlocked(id); update(); };
        box.appendChild(b);
      }
    }
    function renderLevels() {
      const box = $("levels");
      box.innerHTML = "";
      P.strands[topic].levels.forEach((lv, i) => {
        const n = i + 1, open = teacher || n <= unlocked(topic);
        const st = bestStars(topic, n);
        const b = document.createElement("button");
        b.type = "button"; b.className = "level"; b.disabled = !open;
        b.setAttribute("aria-pressed", n === level);
        b.innerHTML = `<b>${open ? n : "🔒 " + n}</b>${lv.name}${open ? `<span class="stars" aria-label="Best: ${st} of 3 stars">${starText(st)}</span>` : ""}`;
        b.onclick = () => { level = n; update(); };
        box.appendChild(b);
      });
      const u = unlocked(topic);
      $("unlockHint").textContent = `Each level is one round of questions (${MML.roundText()}). You start with 3 stars. Your first miss is free, then each miss empties a star. Each game has its own stars. ` +
        (u >= maxLevel(topic) ? "Every level in this topic is open." : `A star on level ${u} in any game unlocks level ${u + 1}.`);
    }
    function link(game, mode) {
      const q = new URLSearchParams({ game, topic, level });
      if (teacher) q.set("set", "1");
      if (mode) q.set("mode", mode);
      return "play.html?" + q;
    }
    function renderGames() {
      const grid = $("gameGrid"); grid.innerHTML = "";
      for (const g of GI.order) {
        const ok = supports(g, topic), card = document.createElement("div");
        card.className = "gcard" + (ok ? "" : " off");
        const cv = document.createElement("canvas"); cv.setAttribute("aria-hidden", "true");
        const h = document.createElement("h3"); h.textContent = GI[g].name;
        const p = document.createElement("p"); p.textContent = GI[g].blurb;
        const st = document.createElement("p");
        if (ok) { const n = gameStars(g, topic, level); st.innerHTML = `<span class="stars" aria-label="${n} of 3 stars">${starText(n)}</span> on this level (${GI[g].round} questions)`; }
        else st.textContent = `Not available for ${P.strands[topic].name}. Try ${GI[g].supports.map((t) => P.strands[t].name).join(", ")}.`;
        const acts = document.createElement("div"); acts.className = "actions";
        acts.innerHTML = `<a class="btn btn-primary" href="${link(g)}">Play</a>`;
        card.append(cv, h, p, st, acts);
        grid.appendChild(card);
        drawCard(g, cv);
      }
    }
    function update() {
      clampLevel();
      if (!teacher) { try { localStorage.setItem(lastKey, JSON.stringify({ topic, level })); } catch (e) { } }
      renderTopics(); renderLevels(); renderGames();
    }

    if (teacher) {
      clampLevel();
      $("teacherBanner").hidden = false;
      $("tbTopic").textContent = `${P.strands[topic].name}, level ${level}: ${P.strands[topic].levels[level - 1].name}`;
      $("topicPick").hidden = true;
      if (locked) $("tbChange").hidden = true;
      $("tbChange").onclick = () => {
        teacher = false;
        $("teacherBanner").hidden = true; $("topicPick").hidden = false;
        history.replaceState(null, "", location.pathname);
        update();
      };
    }
    update();

    // Boss trophies: one card per boss (topic), using the student drawing if the teacher uploaded one.
    // Each card shows this student's own damage: the total across their battles and their best single battle.
    // Friends: add this student to the name list, then show how many friend requests are waiting
    async function showFriendRequests() {
      await B.people.sync(user, prog.avatar);
      try {
        const n = (await B.friends.list(user)).filter((f) => f.status === "pending" && f.to === user.uid).length;
        $("friendBadge").textContent = n; $("friendBadge").hidden = !n;
        $("friendsLink").setAttribute("aria-label", n ? `Friends, ${n} new request${n > 1 ? "s" : ""}` : "Friends");
      } catch (e) { }
    }
    async function renderTrophies() {
      const list = prog.bosses || [], grid = $("trophies");
      const winsAll = list.filter((b) => b.won).length;
      $("trophyHint").textContent = winsAll
        ? `Your class has beaten ${winsAll} boss${winsAll === 1 ? "" : "es"} in battles you joined. Beat each boss on every level to fill in its circles.`
        : "Join a Class Boss Battle and help take the boss down to earn its trophy. Each boss can be beaten on every level.";
      const art = await MML.loadBossArt();
      grid.innerHTML = "";
      const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
      const animated = [];
      for (const t of P.order) {
        const boss = MML.bosses[t], n = P.strands[t].levels.length, drawing = art[t];
        const fights = list.filter((b) => b.topic === t), wins = fights.filter((b) => b.won);
        const el = document.createElement("div");
        el.className = "trophy" + (wins.length ? " won" : "");
        const cv = document.createElement("canvas"); cv.setAttribute("aria-hidden", "true");
        const w = 140, hh = 110, dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr; cv.height = hh * dpr;
        const c = cv.getContext("2d"); c.scale(dpr, dpr);
        if (drawing) animated.push({ c, w, hh, cb: drawing, dim: !wins.length });
        else { if (!wins.length) c.globalAlpha = 0.3; MML.drawBoss(c, t, w / 2, hh * 0.64, 68, 0.6, 0, 0); }
        const name = document.createElement("b"); name.textContent = boss.name;
        const by = drawing && drawing.artist ? document.createElement("small") : null;
        if (by) { by.className = "artist"; by.textContent = `Drawn by ${drawing.artist}`; }
        const pips = document.createElement("div"); pips.className = "pips";
        const beatenLevels = [];
        for (let lv = 1; lv <= n; lv++) {
          const k = wins.filter((b) => b.level === lv).length, p = document.createElement("span");
          p.className = k ? "on" : ""; p.textContent = lv;
          p.title = k ? `Level ${lv}: beaten ${plural(k, "time")}` : `Level ${lv}: not beaten yet`;
          if (k) beatenLevels.push(lv);
          pips.appendChild(p);
        }
        const status = document.createElement("small");
        status.textContent = wins.length ? `Levels beaten: ${beatenLevels.join(", ")}`
          : fights.length ? `Fought ${plural(fights.length, "time")}, not beaten yet` : "Not beaten yet";
        let dmg = null;
        if (fights.length) {
          const total = fights.reduce((s, b) => s + (b.dmg || 0), 0), best = Math.max(...fights.map((b) => b.dmg || 0));
          dmg = document.createElement("small"); dmg.className = "dmg";
          dmg.textContent = fights.length > 1 ? `Your damage: ${total} (best battle: ${best})` : `Your damage: ${total}`;
        }
        el.append(cv, name, ...[by, pips, status, dmg].filter(Boolean));
        el.setAttribute("aria-label", `${boss.name}: ${status.textContent}${dmg ? ". " + dmg.textContent : ""}`);
        grid.appendChild(el);
      }
      if (animated.length) {
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const tick = (now) => {
          for (const a of animated) {
            a.c.clearRect(0, 0, a.w, a.hh);
            a.c.globalAlpha = a.dim ? 0.35 : 1;
            MML.drawCustomBoss(a.c, a.cb, a.w / 2, a.hh / 2 + 4, 96, reduced ? 0 : now / 1000, 0, 0);
            a.c.globalAlpha = 1;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }

      const log = $("battleLog"); log.innerHTML = "";
      const recent = list.slice(-5).reverse();
      $("logTitle").hidden = recent.length === 0;
      for (const b of recent) {
        const li = document.createElement("li");
        const when = new Date(b.at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const nm = (MML.bosses[b.topic] || MML.bosses.facts).name;
        li.className = b.won ? "won" : "";
        li.textContent = `${when}: ${b.won ? `Beat ${nm}` : `${nm} got away`}, level ${b.level}. You dealt ${b.dmg} damage.`;
        log.appendChild(li);
      }
    }

    // Small still pictures of each game, using the student's own ship and background
    function drawCard(g, cv) {
      const w = 300, h = 120, dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = w * dpr; cv.height = h * dpr;
      const c = cv.getContext("2d"); c.scale(dpr, dpr);
      const av = prog.avatar, ink = "#151a45", paper = "#f6f7ff";
      AV.drawBackground(c, av.theme, w, h, 0, true);
      const card = (x, y, cw, ch, text, fill = paper, size = 16) => {
        c.fillStyle = ink; c.fillRect(x + 3, y + 3, cw, ch);
        c.fillStyle = fill; c.fillRect(x, y, cw, ch);
        c.fillStyle = ink; c.font = `700 ${size}px Lexend, system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(text, x + cw / 2, y + ch / 2 + 1);
      };
      const ship = (x, y, s, rot = 0) => { c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); AV.drawShip(c, av, { flame: 12 }); c.restore(); };
      if (g === "lane") {
        AV.drawRoad(c, av.theme, 60, 180, h, 0, 1);
        ["54", "56", "48"].forEach((t, i) => card(66 + i * 60, 22, 48, 28, t, i === 1 ? "#2ee6a6" : paper));
        ship(150, 72, 0.6);
      } else if (g === "blast") {
        card(30, 14, 70, 26, "7 × 8"); card(190, 40, 76, 26, "−3 + 9");
        c.fillStyle = "#ff4f8b"; c.fillRect(0, 104, w, 2);
        c.strokeStyle = "#ffd23f"; c.lineWidth = 3; c.beginPath(); c.moveTo(150, 84); c.lineTo(228, 54); c.stroke();
        ship(150, 70, 0.45, 0.9);
      } else if (g === "total") {
        card(90, 18, 120, 50, "× 3", paper, 26);
        for (let i = 0; i < 4; i++) { c.fillStyle = i < 2 ? "#2438d0" : "#d8dcf5"; c.beginPath(); c.arc(126 + i * 16, 82, 5, 0, Math.PI * 2); c.fill(); }
        ship(40, 60, 0.45);
      } else if (g === "line") {
        c.strokeStyle = paper; c.lineWidth = 3; c.beginPath(); c.moveTo(24, 80); c.lineTo(276, 80); c.stroke();
        for (let i = 0; i <= 10; i++) { c.beginPath(); c.moveTo(24 + i * 25.2, 72); c.lineTo(24 + i * 25.2, 88); c.stroke(); }
        card(110, 12, 80, 26, "√50");
        ship(200, 74, 0.45, Math.PI);
      } else if (g === "target") {
        c.fillStyle = "#ffd23f"; c.font = "400 34px Bungee, Lexend, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("24", 150, 34);
        ["8", "3", "5", "2"].forEach((t, i) => card(66 + i * 44, 66, 34, 34, t, "#ffd23f", 18));
      }
    }
  }
})();
