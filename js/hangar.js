/* Mental Math Lab: Hangar (spend coins on ship parts and backgrounds) */
(async function () {
  const B = MML.backend, AV = MML.avatar;
  const $ = (id) => document.getElementById(id);
  const user = await B.requireStudent();
  MML.siteLock.start(user);
  MML.help.mount(document.querySelector(".nav"));
  let prog;
  try { prog = await B.loadProgress(user.uid); }
  catch (e) { $("loading").textContent = e.message; return; }
  $("loading").hidden = true; $("main").hidden = false;
  AV.applySite(prog.avatar.site);

  let cat = "shape";
  let trying = null; // { cat, id } for an item being tried on but not owned
  const owns = (c, id) => prog.owned.includes(c + ":" + id);
  const looks = () => (trying ? Object.assign({}, prog.avatar, { [trying.cat]: trying.id }) : prog.avatar);

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.hidden = true), 1800);
  }
  async function save(msg) {
    try { await B.saveProgress(user, prog, { boards: true }); toast(msg); }
    catch (e) { toast("Couldn't save: " + e.message); }
  }

  function renderTabs() {
    const box = $("tabs"); box.innerHTML = "";
    for (const c of AV.CATS) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tab"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", c === cat); b.textContent = AV.catalog[c].label;
      b.onclick = () => { cat = c; renderTabs(); renderItems(); };
      box.appendChild(b);
    }
  }
  function renderItems() {
    const box = $("items"); box.innerHTML = "";
    for (const it of AV.catalog[cat].items) {
      const have = owns(cat, it.id), on = prog.avatar[cat] === it.id;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "item" + (on ? " equipped" : "");
      const av = Object.assign({}, prog.avatar, { [cat]: it.id });
      if (cat === "site") {
        const sw = document.createElement("span");
        sw.className = "site-swatch"; sw.dataset.site = it.id; sw.setAttribute("aria-hidden", "true");
        b.appendChild(sw);
      } else b.appendChild(AV.miniCanvas(av, 84, { theme: cat === "theme" ? it.id : prog.avatar.theme, flame: 14 }));
      const name = document.createElement("b"); name.textContent = it.name;
      const tag = document.createElement("span");
      tag.className = have ? "" : "price";
      tag.textContent = on ? "Equipped" : have ? "Owned" : `${it.price} coins`;
      b.append(name, tag);
      b.onclick = () => choose(it, have);
      box.appendChild(b);
    }
    $("coins").textContent = prog.coins;
  }
  function choose(it, have) {
    if (have) {
      trying = null;
      if (prog.avatar[cat] !== it.id) { prog.avatar[cat] = it.id; save(`${it.name} equipped`); }
    } else trying = { cat, id: it.id, item: it };
    // Website backgrounds preview on this page right away
    AV.applySite(trying && trying.cat === "site" ? trying.id : prog.avatar.site);
    renderItems(); renderTry();
  }
  function renderTry() {
    const buy = $("buyBtn"), cancel = $("cancelBtn");
    if (!trying) {
      $("tryName").textContent = "Your ship";
      $("tryInfo").textContent = "Pick something to try it on. Things you own switch on right away.";
      buy.hidden = cancel.hidden = true;
      return;
    }
    const it = trying.item, short = it.price - prog.coins;
    $("tryName").textContent = trying.cat === "site" ? `Trying on: ${it.name} (look around the page!)` : `Trying on: ${it.name}`;
    $("tryInfo").textContent = short > 0 ? `You need ${short} more coins. Answer questions in any game to earn them.` : `Costs ${it.price} of your ${prog.coins} coins.`;
    buy.hidden = false; cancel.hidden = false;
    buy.disabled = short > 0;
    buy.textContent = short > 0 ? `Need ${short} more coins` : `Buy for ${it.price} coins`;
  }
  $("cancelBtn").onclick = () => { trying = null; AV.applySite(prog.avatar.site); renderTry(); };
  $("buyBtn").onclick = async () => {
    if (!trying || prog.coins < trying.item.price) return;
    const { cat: c, id, item } = trying;
    prog.coins -= item.price;
    prog.owned.push(c + ":" + id);
    prog.avatar[c] = id;
    trying = null;
    renderItems(); renderTry();
    await save(`You bought ${item.name}!`);
  };

  // Animated preview
  const cv = $("preview"), ctx = cv.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t = 0;
  function frame() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = w * dpr; cv.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    t += 1 / 60;
    const av = looks(), roadW = Math.min(w - 40, 260);
    AV.drawBackground(ctx, av.theme, w, h, t * 80, reduced);
    AV.drawRoad(ctx, av.theme, (w - roadW) / 2, roadW, h, reduced ? 0 : t * 80, 1);
    ctx.save();
    ctx.translate(w / 2 + (reduced ? 0 : Math.sin(t * 1.4) * 10), h * 0.3);
    ctx.scale(2, 2);
    AV.drawShip(ctx, av, { flame: 22 + (reduced ? 0 : Math.sin(t * 25) * 5), time: t });
    ctx.restore();
    requestAnimationFrame(frame);
  }
  renderTabs(); renderItems(); renderTry();
  requestAnimationFrame(frame);
})();
