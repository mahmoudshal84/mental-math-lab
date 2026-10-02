/* Mental Math Lab: boss drawings (one per topic) */
window.MML = window.MML || {};
MML.bosses = {
  facts: { name: "The Times Titan", body: "#ff8a3d", dark: "#b8520f", symbol: "×", horns: true },
  integers: { name: "Captain Negative", body: "#3dd6ff", dark: "#1a7fa3", symbol: "−", horns: false, hat: true },
  fdp: { name: "The Fraction Golem", body: "#b6f23a", dark: "#6d9612", symbol: "%", horns: false, rocks: true },
  ratios: { name: "The Ratio Raptor", body: "#ff4f8b", dark: "#a8144a", symbol: ":", horns: true, spikes: true },
  exponents: { name: "The Power Hydra", body: "#b69cff", dark: "#6a4bc2", symbol: "x²", horns: false, heads: true },
    equations: { name: "Mister X", body: "#2ee6a6", dark: "#11966a", symbol: "x", horns: true },
  geometry: { name: "The Shape Shifter", body: "#ffd23f", dark: "#b38f00", symbol: "△", horns: false, spikes: true },
  data: { name: "The Data Dragon", body: "#e08cff", dark: "#9a3fb8", symbol: "?", horns: true },
};
MML.drawBoss = function (ctx, kind, cx, cy, size, t, hurt, mad) {
  const b = MML.bosses[kind] || MML.bosses.facts, INK = "#151a45";
  const wob = (a) => 1 + Math.sin(t * 3 + a * 3) * 0.035;
  const r = size / 2;
  ctx.save(); ctx.translate(cx, cy + Math.sin(t * 2) * r * 0.03);
  if (hurt > 0) ctx.translate((Math.random() - 0.5) * 10 * hurt, (Math.random() - 0.5) * 6 * hurt);
  // extra heads for the hydra
  if (b.heads) for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * r * 0.95, -r * 0.45); ctx.rotate(s * 0.3 + Math.sin(t * 2 + s) * 0.1);
    ctx.fillStyle = b.body; ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.32, r * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(r * 0.08 * s, -r * 0.04, r * 0.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(r * 0.1 * s, -r * 0.03, r * 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // horns
  if (b.horns) for (const s of [-1, 1]) {
    ctx.fillStyle = "#f6f7ff"; ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(s * r * 0.35, -r * 0.75); ctx.quadraticCurveTo(s * r * 0.75, -r * 1.25, s * r * 0.8, -r * 1.3);
    ctx.quadraticCurveTo(s * r * 0.55, -r * 0.95, s * r * 0.6, -r * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // body
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2, rr = r * wob(a) * (b.spikes && i % 4 === 0 ? 1.12 : 1);
    const x = Math.cos(a) * rr * 1.05, y = Math.sin(a) * rr * 0.92;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = hurt > 0.5 ? "#ffffff" : b.body; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  // belly
  ctx.fillStyle = b.dark; ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.55, r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  if (b.rocks) { ctx.fillStyle = b.dark; for (const [x, y, s] of [[-0.6, -0.2, 0.12], [0.55, 0.1, 0.1], [-0.2, 0.55, 0.08], [0.3, -0.55, 0.09]]) { ctx.beginPath(); ctx.arc(x * r, y * r, s * r, 0, Math.PI * 2); ctx.fill(); } }
  // symbol on the belly
  ctx.fillStyle = INK; ctx.font = `700 ${Math.round(r * 0.5)}px Bungee, Lexend, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(b.symbol, 0, r * 0.38);
  // eyes
  const look = Math.sin(t * 0.9) * r * 0.05;
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(s * r * 0.32, -r * 0.25, r * 0.19, r * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(s * r * 0.32 + look, -r * 0.2, r * 0.08, 0, Math.PI * 2); ctx.fill();
    // brows (angrier when mad)
    ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(s * r * 0.15, -r * (0.5 - mad * 0.05)); ctx.lineTo(s * r * 0.48, -r * (0.56 + mad * 0.1)); ctx.stroke();
  }
  // mouth with teeth
  ctx.fillStyle = INK; ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r * 0.3, r * (0.08 + mad * 0.06 + (hurt > 0 ? 0.08 : 0)), 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.1 - r * 0.04, r * 0.0); ctx.lineTo(i * r * 0.1, r * 0.08); ctx.lineTo(i * r * 0.1 + r * 0.04, r * 0.0); ctx.fill(); }
  if (b.hat) {
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.72); ctx.lineTo(r * 0.6, -r * 0.72); ctx.lineTo(0, -r * 1.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f6f7ff"; ctx.font = `700 ${Math.round(r * 0.22)}px Lexend, sans-serif`; ctx.fillText("−", 0, -r * 0.92);
  }
  ctx.restore();
};

/* ---------- Boss drawings (a student's drawing can replace any boss's built-in art) ---------- */
const toImages = (srcs) => Promise.all((srcs || []).map((src) => new Promise((res) => {
  const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
}))).then((a) => a.filter(Boolean));
MML.customBossCache = {};
// Full-size drawing for one boss (used in battles): { topic, artist, frames: [Image] } or null
MML.loadCustomBoss = function (topic) {
  if (!topic) return Promise.resolve(null);
  if (!MML.customBossCache[topic]) {
    MML.customBossCache[topic] = MML.backend.bosses.get(topic).then(async (doc) => {
      if (!doc) return null;
      const frames = await toImages(doc.frames);
      return frames.length ? { topic, artist: doc.artist || "", frames } : null;
    }).catch(() => null);
  }
  return MML.customBossCache[topic];
};
// Small copies of every boss drawing (used on the trophy shelf and admin page): { topic: { artist, frames } }
MML.loadBossArt = function (fresh) {
  if (fresh || !MML.bossArtCache) {
    MML.bossArtCache = MML.backend.bosses.art().then(async (all) => {
      const out = {};
      for (const [t, d] of Object.entries(all || {})) {
        const frames = await toImages(d && d.frames);
        if (frames.length) out[t] = { topic: t, artist: d.artist || "", frames };
      }
      return out;
    }).catch(() => ({}));
  }
  return MML.bossArtCache;
};
// Poses play 1 → 2 → 3 → 2 so a waving hand goes back and forth
MML.customFrame = function (n, t, speed = 0.28) {
  const seq = n >= 3 ? [0, 1, 2, 1] : n === 2 ? [0, 1] : [0];
  const i = Math.floor(Math.max(0, t) / speed) % seq.length;
  return seq[i] || 0;
};
MML.drawCustomBoss = function (ctx, cb, cx, cy, size, t, hurt, mad) {
  if (!cb || !cb.frames.length) return;
  const im = cb.frames[MML.customFrame(cb.frames.length, t)];
  const s = size / Math.max(im.naturalWidth, im.naturalHeight) * 1.15;
  const w = im.naturalWidth * s, h = im.naturalHeight * s;
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t * 2) * size * 0.025);
  if (hurt > 0) ctx.translate((Math.random() - 0.5) * 12 * hurt, (Math.random() - 0.5) * 6 * hurt);
  if (mad > 0) ctx.rotate(Math.sin(t * 25) * 0.04 * mad);
  const squash = 1 + Math.sin(t * 2) * 0.015;
  ctx.scale(1 / squash, squash);
  if (hurt > 0.4) ctx.filter = "brightness(1.9)";
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.filter = "none";
  ctx.restore();
};
