/* Mental Math Lab: leaderboards
   Three boards side by side: grade XP, grade Arcade record, school Arcade record.
   Each shows the top 10, with the student's own spot pinned underneath if they're lower. */
(async function () {
  const B = MML.backend, AV = MML.avatar, GI = MML.gameInfo;
  const $ = (id) => document.getElementById(id);
  let user = null, myAvatar = null;
  try { user = await B.init(); } catch (e) { }
  if (!user) { location.href = "index.html"; return; }
  MML.siteLock.start(user);
  if (user.isAdmin) {
    $("gradePick").hidden = false;
    $("nav").innerHTML = '<a href="admin.html">Back to admin</a>';
  } else {
    try { const p = await B.loadProgress(user.uid); myAvatar = p.avatar; AV.applySite(p.avatar.site); } catch (e) { }
    if (MML.help) MML.help.mount($("nav"));
  }

  let period = "week", game = "lane", xpScope = "grade"; // xpScope: the XP board shows the grade or the whole school
  let grade = user.isAdmin ? 6 : user.profile.grade;
  $("gradeSel").onchange = (e) => { grade = +e.target.value; render(); };

  // When the weekly boards reset (Monday, local time)
  const days = (8 - (new Date().getDay() || 7)) % 7 || 7;
  const resetText = () => (period === "week" ? `This week's boards reset Monday${days === 1 ? " (tomorrow)" : ` (in ${days} days)`}.` : "All-time boards never reset.");

  // Buttons are built once; clicking one just updates which is selected (so the page never jumps)
  function tabs(boxId, items, get, pick, cls) {
    const box = $(boxId); box.innerHTML = "";
    for (const [id, name] of items) {
      const b = document.createElement("button");
      b.type = "button"; b.className = cls; b.setAttribute("role", "tab"); b.dataset.id = id; b.textContent = name;
      b.onclick = () => { if (get() === id) return; pick(id); renderControls(); render(); };
      box.appendChild(b);
    }
  }
  tabs("periodTabs", [["week", "This week"], ["all", "All time"]], () => period, (v) => (period = v), "seg-btn");
  tabs("gameTabs", GI.order.map((g) => [g, GI[g].name]), () => game, (v) => (game = v), "chip-btn");
  function renderControls() {
    for (const b of $("periodTabs").children) b.setAttribute("aria-selected", b.dataset.id === period);
    for (const b of $("gameTabs").children) b.setAttribute("aria-selected", b.dataset.id === game);
    $("resetNote").textContent = resetText();
  }

  const fmt = (field, v) => (field === "xp" ? `${v.toLocaleString("en-US")} XP` : v.toLocaleString("en-US"));
  function boardsFor() {
    const g = "g" + grade, week = period === "week", name = GI[game].name;
    return [
      { kind: "xp", title: xpScope === "school" ? "School XP" : `Grade ${grade} XP`,
        sub: (week ? "XP from stars earned this week" : "All XP earned from stars") + (xpScope === "school" ? ", all grades" : ""),
        scope: xpScope === "school" ? "school" : g, field: "xp", showGrade: xpScope === "school", toggle: true,
        none: week ? "Earn a new star this week to get on this board." : "Earn a star to get on this board." },
      { kind: "grade", title: `Grade ${grade} record`, tag: name, sub: `Best Arcade score, grade mix${week ? ", this week" : ""}`,
        scope: g, field: game, none: `Play ${name} Arcade (grade mix)${week ? " this week" : ""} to get on this board.` },
      { kind: "school", title: "School record", tag: name, sub: `Best Arcade score, school mix, all grades${week ? ", this week" : ""}`,
        scope: "school", field: game, showGrade: true, none: `Play ${name} Arcade (school mix)${week ? " this week" : ""} to get on this board.` },
    ];
  }

  let renderId = 0;
  async function render() {
    const id = ++renderId, box = $("boards"), defs = boardsFor();
    if (!box.children.length) box.innerHTML = '<p class="lb-loading">Loading the leaderboards…</p>';
    box.classList.add("is-loading"); box.setAttribute("aria-busy", "true");
    // Remember which switch button has focus, so it can be focused again after the swap
    const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.focusKey : null;
    const results = await Promise.all(defs.map((def) =>
      B.getBoard({ period, scope: def.scope, field: def.field }).then((res) => ({ res }), (err) => ({ err }))));
    if (id !== renderId) return; // a newer click already replaced this one
    box.replaceChildren(...defs.map((def, i) => card(def, results[i])));
    box.classList.remove("is-loading"); box.setAttribute("aria-busy", "false");
    if (focusKey) { const f = box.querySelector(`[data-focus-key="${focusKey}"]`); if (f) f.focus({ preventScroll: true }); }
  }

  function card(def, { res, err }) {
    const el = document.createElement("section");
    el.className = `lb-board lb-${def.kind}`;
    const head = document.createElement("header");
    const h = document.createElement("h2"); h.textContent = def.title;
    head.appendChild(h);
    if (def.toggle) {
      // Corner switch: this grade's XP or the whole school's
      const sw = document.createElement("div");
      sw.className = "lb-switch"; sw.setAttribute("role", "tablist"); sw.setAttribute("aria-label", "Show XP for");
      for (const [v, label] of [["grade", `Grade ${grade}`], ["school", "School"]]) {
        const b = document.createElement("button");
        b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", xpScope === v); b.textContent = label;
        b.dataset.focusKey = "xp-" + v;
        b.onclick = () => {
          if (xpScope === v) return;
          xpScope = v;
          for (const x of sw.children) x.setAttribute("aria-selected", x === b); // show the change right away
          render();
        };
        sw.appendChild(b);
      }
      head.appendChild(sw);
    }
    if (def.tag) { const t = document.createElement("span"); t.className = "lb-tag"; t.textContent = def.tag; head.appendChild(t); }
    const sub = document.createElement("p"); sub.className = "lb-sub"; sub.textContent = def.sub;
    head.appendChild(sub);
    const ol = document.createElement("ol"); ol.className = "lb-list";
    el.append(head, ol);
    const note = (text) => { const li = document.createElement("li"); li.className = "lb-empty"; li.textContent = text; ol.appendChild(li); };
    if (err) { note(err.message); return el; }
    if (!res.top.length) note("Nobody yet. Be the first!");
    for (const e of res.top) ol.appendChild(row(Object.assign({}, e, { value: e[def.field] }), def, e.rank, !user.isAdmin && e.uid === user.uid));
    if (user.isAdmin) return el;
    const foot = document.createElement("div"); foot.className = "lb-you";
    if (res.me && !res.me.inTop) {
      const youList = document.createElement("ol"); youList.className = "lb-list";
      youList.appendChild(row({ name: user.profile.displayName, grade: user.profile.grade, value: res.me.value, avatar: myAvatar }, def, res.me.rank, true));
      const n = document.createElement("p"); n.textContent = "Keep going to climb into the top 10!";
      foot.append(youList, n);
    } else if (!res.me) { const n = document.createElement("p"); n.textContent = def.none; foot.appendChild(n); }
    else return el;
    el.appendChild(foot);
    return el;
  }

  function row(e, def, rank, me) {
    const li = document.createElement("li");
    if (me) li.classList.add("me");
    const rk = document.createElement("span"); rk.className = "rk" + (rank <= 3 ? ` medal m${rank}` : ""); rk.textContent = rank;
    rk.setAttribute("aria-label", `Rank ${rank}`);
    const nm = document.createElement("span"); nm.className = "nm";
    nm.textContent = me ? `${e.name} (you)` : e.name;
    if (def.showGrade && e.grade) { const gchip = document.createElement("small"); gchip.textContent = `Gr ${e.grade}`; nm.append(" ", gchip); }
    const vl = document.createElement("span"); vl.className = "vl"; vl.textContent = fmt(def.field, e.value);
    li.append(rk, AV.miniCanvas(e.avatar || AV.defaults(), 34), nm, vl);
    return li;
  }

  renderControls(); render();
})();
