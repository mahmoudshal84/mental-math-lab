/* Mental Math Lab: avatars and backgrounds
   Everything students can buy with coins lives here. To change a price or
   add an item, edit the catalog below. Items with price 0 are free. */
window.MML = window.MML || {};
(function (MML) {
  const INK = "#151a45";

  const catalog = {
    shape: { label: "Ship", items: [
      { id: "dart", name: "Dart", price: 0 },
      { id: "delta", name: "Delta", price: 60 },
      { id: "needle", name: "Needle", price: 120 },
      { id: "twin", name: "Twin fin", price: 200 },
      { id: "saucer", name: "Saucer", price: 350 }] },
    color: { label: "Color", items: [
      { id: "sun", name: "Sunbeam", price: 0, fill: "#ffd23f" },
      { id: "mint", name: "Mint", price: 25, fill: "#2ee6a6" },
      { id: "pink", name: "Bubblegum", price: 25, fill: "#ff4f8b" },
      { id: "snow", name: "Snow", price: 25, fill: "#f6f7ff" },
      { id: "orange", name: "Tangerine", price: 40, fill: "#ff8a3d" },
      { id: "ice", name: "Ice", price: 40, fill: "#3dd6ff" },
      { id: "lilac", name: "Lilac", price: 40, fill: "#b69cff" },
      { id: "lime", name: "Lime", price: 60, fill: "#b6f23a" },
      { id: "red", name: "Rocket red", price: 60, fill: "#ff3b3b" },
      { id: "chrome", name: "Chrome", price: 300, grad: ["#ffffff", "#9aa3c7", "#e9ecff", "#6c75a0"] },
      { id: "gold", name: "Gold", price: 500, grad: ["#fff3a6", "#e0a800", "#ffe066", "#b37a00"] }] },
    decal: { label: "Decoration", items: [
      { id: "none", name: "Dot", price: 0 }, // the standard look: a dot in the middle of the ship
      { id: "stripe", name: "Racing stripe", price: 40 },
      { id: "dots", name: "Dots", price: 60 },
      { id: "checker", name: "Checkers", price: 90 },
      { id: "heart", name: "Heart", price: 90 },
      { id: "star", name: "Star", price: 120 },
      { id: "bolt", name: "Lightning", price: 120 },
      { id: "eyes", name: "Googly eyes", price: 150 },
      { id: "flames", name: "Hot rod", price: 180 },
      { id: "crown", name: "Crown", price: 400 }] },
    trail: { label: "Trail", items: [
      { id: "pink", name: "Pink", price: 0, fill: "#ff4f8b" },
      { id: "sun", name: "Yellow", price: 30, fill: "#ffd23f" },
      { id: "mint", name: "Mint", price: 30, fill: "#2ee6a6" },
      { id: "ice", name: "Blue", price: 30, fill: "#3dd6ff" },
      { id: "white", name: "White", price: 30, fill: "#f6f7ff" },
      { id: "rainbow", name: "Rainbow", price: 300, rainbow: true }] },
    site: { label: "Website", items: [
      { id: "lab", name: "Graph paper", price: 0 },
      { id: "midnight", name: "Midnight", price: 80 },
      { id: "ocean", name: "Deep ocean", price: 100 },
      { id: "chalk", name: "Chalkboard", price: 120 },
      { id: "plum", name: "Plum", price: 120 },
      { id: "sunset", name: "Sunset", price: 200 },
      { id: "neon", name: "Neon grid", price: 250 },
      { id: "galaxy", name: "Galaxy", price: 350 },
      { id: "candy", name: "Candy pop", price: 150 },
      { id: "tropical", name: "Tropical", price: 150 },
      { id: "aurora", name: "Aurora", price: 250 },
      { id: "lava", name: "Lava lamp", price: 250 },
      { id: "sunburst", name: "Sunburst", price: 300 },
      { id: "rainbow", name: "Rainbow", price: 450 }] },
    theme: { label: "Game background", items: [
      { id: "cobalt", name: "Graph paper", price: 0, bg: "#2438d0", road: "#1a2aa8", grid: "rgba(255,255,255,.06)", lane: "rgba(246,247,255,.3)", edge: "#f6f7ff" },
      { id: "midnight", name: "Midnight", price: 80, bg: "#0f1433", road: "#1a2150", grid: "rgba(255,255,255,.035)", lane: "rgba(246,247,255,.25)", edge: "#3dd6ff", stars: true },
      { id: "mintlab", name: "Mint lab", price: 100, bg: "#0f9e74", road: "#0b7a5a", grid: "rgba(255,255,255,.08)", lane: "rgba(255,255,255,.35)", edge: "#f6f7ff" },
      { id: "sunset", name: "Sunset", price: 150, bg: ["#ff8a3d", "#ff4f8b", "#6b2bd1"], road: "rgba(40,16,80,.5)", grid: "rgba(255,255,255,.08)", lane: "rgba(255,255,255,.35)", edge: "#ffd23f" },
      { id: "neon", name: "Neon", price: 250, bg: "#12001f", road: "#1d0633", grid: "rgba(255,79,139,.16)", lane: "rgba(61,214,255,.6)", edge: "#ff4f8b" },
      { id: "space", name: "Deep space", price: 300, bg: ["#05060f", "#1b0f3b"], road: "rgba(255,255,255,.05)", grid: "rgba(0,0,0,0)", lane: "rgba(246,247,255,.22)", edge: "#b69cff", stars: true }] },
  };
  const CATS = ["shape", "color", "decal", "trail", "theme", "site"];
  const item = (cat, id) => catalog[cat].items.find((i) => i.id === id) || catalog[cat].items[0];
  const defaults = () => ({ shape: "dart", color: "sun", decal: "none", trail: "pink", theme: "cobalt", site: "lab" });

  /* Website background: set on <body data-site="..."> (styles in css/style.css).
     Remembered in this browser so the next page shows it right away. */
  function applySite(id) {
    const it = catalog.site.items.find((i) => i.id === id) ? id : "lab";
    if (document.body && document.body.hasAttribute("data-themed")) document.body.dataset.site = it;
    try { localStorage.setItem("mml-site", it); } catch (e) { }
  }
  try {
    if (document.body && document.body.hasAttribute("data-themed")) document.body.dataset.site = localStorage.getItem("mml-site") || "lab";
  } catch (e) { }
  const freeIds = () => CATS.flatMap((c) => catalog[c].items.filter((i) => i.price === 0).map((i) => c + ":" + i.id));
  function clean(av) {
    const d = defaults(), out = {};
    for (const c of CATS) out[c] = av && catalog[c].items.some((i) => i.id === av[c]) ? av[c] : d[c];
    return out;
  }

  /* ---------- Ship drawing (nose at 0,0; about 56 tall; caller translates/scales) ---------- */
  const PATHS = {
    dart: (c) => { c.moveTo(0, 0); c.lineTo(28, 54); c.lineTo(0, 44); c.lineTo(-28, 54); c.closePath(); },
    delta: (c) => { c.moveTo(0, 0); c.lineTo(34, 48); c.lineTo(12, 44); c.lineTo(0, 52); c.lineTo(-12, 44); c.lineTo(-34, 48); c.closePath(); },
    needle: (c) => { c.moveTo(0, -8); c.lineTo(9, 28); c.lineTo(20, 56); c.lineTo(0, 48); c.lineTo(-20, 56); c.lineTo(-9, 28); c.closePath(); },
    twin: (c) => { c.moveTo(0, 2); c.lineTo(12, 22); c.lineTo(24, 14); c.lineTo(26, 56); c.lineTo(0, 44); c.lineTo(-26, 56); c.lineTo(-24, 14); c.lineTo(-12, 22); c.closePath(); },
    saucer: (c) => { c.ellipse(0, 36, 32, 12, 0, 0, Math.PI * 2); },
  };
  const FLAME_Y = { dart: 46, delta: 48, needle: 50, twin: 46, saucer: 46 };

  function trailColor(av, time) {
    const t = item("trail", av.trail);
    return t.rainbow ? `hsl(${Math.floor((time * 220) % 360)}, 100%, 62%)` : t.fill;
  }
  function bodyFill(ctx, av) {
    const c = item("color", av.color);
    if (!c.grad) return c.fill;
    const g = ctx.createLinearGradient(-30, 0, 30, 56);
    c.grad.forEach((col, i) => g.addColorStop(i / (c.grad.length - 1), col));
    return g;
  }
  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function drawShip(ctx, avIn, o = {}) {
    const av = clean(avIn);
    const time = o.time || 0, flame = o.flame == null ? 18 : o.flame;
    const fy = FLAME_Y[av.shape];
    // flame
    if (flame > 0) {
      ctx.fillStyle = trailColor(av, time);
      ctx.beginPath(); ctx.moveTo(-11, fy); ctx.lineTo(0, fy + flame); ctx.lineTo(11, fy); ctx.closePath(); ctx.fill();
      if (o.hot) {
        ctx.fillStyle = "#fff6c2";
        ctx.beginPath(); ctx.moveTo(-5, fy); ctx.lineTo(0, fy + flame * 0.55); ctx.lineTo(5, fy); ctx.closePath(); ctx.fill();
      }
    }
    if (o.shield) {
      ctx.strokeStyle = "#2ee6a6"; ctx.lineWidth = 3; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(0, 30, 44, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // body
    ctx.lineJoin = "round";
    ctx.beginPath(); PATHS[av.shape](ctx);
    ctx.fillStyle = bodyFill(ctx, av); ctx.fill();
    // decal clipped to the body
    ctx.save();
    ctx.beginPath(); PATHS[av.shape](ctx); ctx.clip();
    ctx.fillStyle = INK; ctx.globalAlpha = 0.85;
    switch (av.decal) {
      case "stripe": ctx.fillRect(-4, -12, 8, 72); break;
      case "dots": [[-10, 42], [10, 42], [0, 20], [0, 38]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); }); break;
      case "checker": for (let r = 0; r < 5; r++) for (let c = -5; c < 5; c++) if (((r + c) & 1) === 0) ctx.fillRect(c * 8, 20 + r * 8, 8, 8); break;
      case "heart": ctx.fillStyle = "#ff4f8b"; ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(0, 44);
        ctx.bezierCurveTo(-16, 32, -8, 22, 0, 30); ctx.bezierCurveTo(8, 22, 16, 32, 0, 44); ctx.fill(); break;
      case "star": ctx.fillStyle = "#f6f7ff"; ctx.globalAlpha = 1; star(ctx, 0, 34, 10); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); break;
      case "bolt": ctx.beginPath(); ctx.moveTo(4, 14); ctx.lineTo(-7, 34); ctx.lineTo(1, 34); ctx.lineTo(-4, 50); ctx.lineTo(8, 28); ctx.lineTo(0, 28); ctx.closePath(); ctx.fill(); break;
      case "flames": ctx.globalAlpha = 1; ctx.fillStyle = "#ff3b3b";
        ctx.beginPath(); ctx.moveTo(-34, 60);
        for (let x = -34; x <= 34; x += 12) { ctx.quadraticCurveTo(x + 2, 30, x + 6, 42); ctx.quadraticCurveTo(x + 9, 34, x + 12, 60); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#ff8a3d"; ctx.fillRect(-40, 52, 80, 10); break;
    }
    ctx.restore();
    // outline
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); PATHS[av.shape](ctx); ctx.stroke();
    // cockpit / dome / eyes
    if (av.shape === "saucer") {
      ctx.fillStyle = "rgba(246,247,255,.75)";
      ctx.beginPath(); ctx.arc(0, 30, 13, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (av.decal === "eyes") {
      const ey = av.shape === "saucer" ? 22 : 30;
      for (const x of [-8, 8]) {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, ey, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + Math.sin(time * 3 + x) * 2, ey + 1.5, 3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (av.decal === "none" && av.shape !== "saucer") {
      // The center dot is the standard decoration, so any other decoration replaces it
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 28, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (av.decal === "crown") {
      const top = av.shape === "saucer" ? 12 : av.shape === "needle" ? -10 : -4;
      ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, top); ctx.lineTo(-10, top - 12); ctx.lineTo(-5, top - 6); ctx.lineTo(0, top - 14);
      ctx.lineTo(5, top - 6); ctx.lineTo(10, top - 12); ctx.lineTo(10, top); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  /* ---------- Backgrounds ---------- */
  const hash = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };
  function drawBackground(ctx, themeId, W, H, scroll, reduced) {
    const t = item("theme", themeId);
    if (Array.isArray(t.bg)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      t.bg.forEach((c, i) => g.addColorStop(i / (t.bg.length - 1), c));
      ctx.fillStyle = g;
    } else ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, W, H);
    if (t.stars) {
      ctx.fillStyle = "#f6f7ff";
      for (let i = 0; i < 90; i++) {
        const speed = 0.15 + hash(i + 7) * 0.5;
        const x = hash(i) * W, y = (((hash(i + 99) * H + (reduced ? 0 : scroll * speed)) % H) + H) % H;
        ctx.globalAlpha = 0.3 + hash(i + 3) * 0.7;
        const s = hash(i + 5) > 0.85 ? 2.5 : 1.5;
        ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1;
    }
    const gs = 40, off = reduced ? 0 : (scroll * 0.35) % gs;
    ctx.strokeStyle = t.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = (W / 2) % gs; x < W; x += gs) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let y = off - gs; y < H; y += gs) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();
    return t;
  }
  function drawRoad(ctx, themeId, roadX, roadW, H, scroll, lane) {
    const t = item("theme", themeId), laneW = roadW / 3;
    ctx.fillStyle = t.road; ctx.fillRect(roadX, 0, roadW, H);
    if (lane != null) { ctx.fillStyle = "rgba(255,210,63,.07)"; ctx.fillRect(roadX + laneW * lane, 0, laneW, H); }
    ctx.fillStyle = t.edge; ctx.fillRect(roadX - 4, 0, 4, H); ctx.fillRect(roadX + roadW, 0, 4, H);
    ctx.strokeStyle = t.lane; ctx.lineWidth = 3; ctx.setLineDash([18, 16]);
    ctx.lineDashOffset = -(scroll % 34);
    ctx.beginPath();
    for (const i of [1, 2]) { ctx.moveTo(roadX + laneW * i, 0); ctx.lineTo(roadX + laneW * i, H); }
    ctx.stroke(); ctx.setLineDash([]);
  }

  /* Small ship on its own little canvas, for leaderboards and shop tiles */
  function miniCanvas(av, size = 44, opts = {}) {
    const c = document.createElement("canvas");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * dpr; c.height = size * dpr;
    c.style.width = size + "px"; c.style.height = size + "px";
    c.setAttribute("aria-hidden", "true");
    const x = c.getContext("2d");
    x.scale(dpr, dpr);
    if (opts.theme) { drawBackground(x, opts.theme, size, size, 0, true); }
    const s = size / 90;
    x.translate(size / 2, size * 0.2); x.scale(s, s);
    drawShip(x, av, { flame: opts.flame == null ? 12 : opts.flame });
    return c;
  }

  MML.avatar = { catalog, CATS, item, defaults, freeIds, clean, drawShip, drawBackground, drawRoad, miniCanvas, applySite };
})(window.MML);
