/* Mental Math Lab: MAP Practice questions
   A run is 42 questions from all 8 topics (5 each, plus 1 extra for Geometry and
   Data & probability), in 7 stages that get harder.
   A question looks like:
   { topic, stage, v, label, prompt, figure, answer, choices: [4], steps: [...] }
   "steps" is the worked explanation shown after a miss. A twin question comes from the
   same generator (same topic, stage, and variant "v") with new numbers. */
window.MML = window.MML || {};
(function (MML) {
  const MINUS = "−";
  const TOTAL = 42, STAGES = 7, PER_STAGE = 6;
  const ORDER = ["facts", "integers", "fdp", "ratios", "exponents", "equations", "geometry", "data"];
  const LABELS = {
    facts: "Quick facts", integers: "Integers", fdp: "Fractions & percents", ratios: "Ratios",
    exponents: "Exponents & roots", equations: "Equations", geometry: "Geometry", data: "Data & probability",
  };
  const EXTRA = ["geometry", "data"]; // these two get 6 questions instead of 5

  /* ---------- Small helpers ---------- */
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const r2 = (n) => Math.round(n * 100) / 100;
  const r4 = (n) => Math.round(n * 10000) / 10000;
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  function num(n) {
    n = r4(n);
    if (Object.is(n, -0)) n = 0;
    const a = Math.abs(n), parts = String(a).split(".");
    return (n < 0 ? MINUS : "") + Number(parts[0]).toLocaleString("en-US") + (parts[1] ? "." + parts[1] : "");
  }
  // Money: whole dollars as "$40", or always two decimals with cents = true
  function money(n, cents) {
    n = r2(n);
    const a = Math.abs(n);
    const s = !cents && Number.isInteger(a) ? a.toLocaleString("en-US")
      : a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? MINUS : "") + "$" + s;
  }
  function frac(n, d) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d); n /= g; d /= g;
    return d === 1 ? num(n) : (n < 0 ? MINUS : "") + Math.abs(n) + "/" + d;
  }
  const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
  const sup = (n) => String(n).split("").map((c) => SUP[c] || c).join("");
  const par = (n) => (n < 0 ? `(${num(n)})` : num(n));
  const coef = (k, v = "x") => (k === 1 ? v : k === -1 ? MINUS + v : num(k) + v);
  const signed = (k) => (k < 0 ? ` ${MINUS} ${num(-k)}` : ` + ${num(k)}`);
  const units = (n) => `${num(n)} unit${n === 1 ? "" : "s"}`;
  const NAMES = ["Maya", "Leo", "Ava", "Eli", "Zoe", "Noah", "Mia", "Sam", "Jordan", "Kai", "Ruby", "Omar", "Lena", "Diego", "Priya", "Tess"];
  const name = () => pick(NAMES);
  const factors = (n) => { const f = []; for (let i = 1; i <= n; i++) if (n % i === 0) f.push(i); return f.join(", "); };
  const multiples = (a, upTo) => { const m = []; for (let k = a; k <= upTo; k += a) m.push(k); return m.join(", "); };

  // Builds a question. "wrong" is a list of tempting wrong answers, most common mistakes first.
  const Q = (prompt, answer, wrong, steps, extra) => Object.assign({ prompt, answer: String(answer), wrong: wrong.map((w) => (w == null ? null : String(w))), steps, figure: "" }, extra || {});

  /* Reads a choice as a number when it is one: "−$21", "3/4", "25%", "12 square feet" */
  function numeric(s) {
    const t = String(s).replace(/−/g, "-").replace(/,/g, "").trim();
    const m = t.match(/^(-?)\$?(\d+(?:\.\d+)?)(?:\/(\d+))?\s*(?:%|°F|°|[a-z][a-z ]*)?$/i);
    if (!m) return null;
    let v = parseFloat(m[2]);
    if (m[3]) v /= +m[3];
    if (m[1]) v = -v;
    return Math.round(v * 1e6) / 1e6;
  }
  // Nearby numbers in the same format as the answer, used if a question is short on wrong answers
  function neighbors(answer) {
    const m = String(answer).match(/^(−?)(\$?)([\d,]+(?:\.\d+)?)(\s.*|%|°F|°)?$/);
    if (!m) return [];
    const v = (m[1] ? -1 : 1) * parseFloat(m[3].replace(/,/g, "")), dp = (m[3].split(".")[1] || "").length;
    const out = [];
    for (const d of [1, -1, 2, -2, 10, -10]) {
      const x = v + d;
      const body = m[2] ? money(x, dp === 2) : dp ? (x < 0 ? MINUS : "") + Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp }) : num(x);
      out.push(body + (m[4] || ""));
    }
    return out;
  }
  // Picks 3 wrong answers (no repeats, nothing equal to the answer) and puts the 4 choices in order
  function finalize(q) {
    const bad = (s) => !s || /NaN|Infinity|undefined|null/.test(s);
    if (bad(q.answer) || q.steps.some((s) => bad(s)) || /NaN|Infinity|undefined/.test(q.prompt + q.figure)) return null;
    let choices;
    if (q.fixed) {
      choices = q.fixed.slice();
    } else {
      const ansV = numeric(q.answer), seenV = new Set(ansV === null ? [] : [ansV]), picked = [];
      const take = (w) => {
        if (picked.length === 3 || bad(w) || w === q.answer || picked.includes(w)) return;
        const v = numeric(w);
        if (v !== null) { if (seenV.has(v)) return; seenV.add(v); }
        picked.push(w);
      };
      q.wrong.forEach(take);
      if (picked.length < 3 && q.fill !== false) neighbors(q.answer).forEach(take);
      if (picked.length < 3) return null;
      choices = [q.answer, ...picked];
      const vals = choices.map(numeric);
      if (vals.every((v) => v !== null)) choices.sort((a, b) => numeric(a) - numeric(b));
      else choices = shuffle(choices);
    }
    delete q.wrong; delete q.fixed; delete q.fill;
    q.choices = choices;
    return q;
  }

  /* ---------- Figures (SVG) ---------- */
  const INK = "#151a45", FILL = "#dfe4ff", BLUE = "#2438d0", PINK = "#ff4f8b", GRID = "#c9cef0";
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const txt = (x, y, s, o = {}) => `<text x="${r2(x)}" y="${r2(y)}" font-size="${o.size || 17}" font-weight="${o.w || 600}" text-anchor="${o.a || "middle"}" dominant-baseline="middle" fill="${o.fill || INK}">${esc(s)}</text>`;
  const line = (x1, y1, x2, y2, o = {}) => `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${o.c || INK}" stroke-width="${o.w || 3}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""} stroke-linecap="round"/>`;
  const poly = (pts, o = {}) => `<polygon points="${pts.map((p) => r2(p[0]) + "," + r2(p[1])).join(" ")}" fill="${o.fill || FILL}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" font-family="Lexend, system-ui, sans-serif">${body}</svg>`;
  const rightMark = (x, y, dx, dy, s = 14) => `<polyline points="${x + dx * s},${y} ${x + dx * s},${y + dy * s} ${x},${y + dy * s}" fill="none" stroke="${INK}" stroke-width="2"/>`;

  function figRect(L, W, u) {
    const s = Math.min(240 / L, 140 / W), w = L * s, h = W * s, x = (360 - w) / 2, y = (210 - h) / 2;
    return svg(360, 240, `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${FILL}" stroke="${INK}" stroke-width="3"/>` +
      txt(180, y + h + 22, `${L} ${u}`) + txt(x - 10, y + h / 2, `${W} ${u}`, { a: "end" }),
      `A rectangle ${L} ${u} long and ${W} ${u} wide`);
  }
  function figTriangle(b, h, u) {
    const ax = 50 + 260 * (0.3 + Math.random() * 0.4), hp = Math.max(70, Math.min(150, (260 * h) / b)), ay = 190 - hp;
    return svg(360, 230, poly([[50, 190], [310, 190], [ax, ay]]) + line(ax, ay, ax, 190, { w: 2, dash: "6 5", c: BLUE }) +
      rightMark(ax, 190, 1, -1, 12) + txt(180, 214, `${b} ${u}`) + txt(ax + 10, (ay + 190) / 2, `${h} ${u}`, { a: "start", fill: BLUE }),
      `A triangle with a base of ${b} ${u} and a height of ${h} ${u}`);
  }
  function figL(W, H, w, h, u) {
    const s = Math.min(250 / W, 160 / H), x0 = (380 - W * s) / 2, y0 = 44, X = (v) => x0 + v * s, Y = (v) => y0 + v * s;
    const pts = [[X(0), Y(0)], [X(W - w), Y(0)], [X(W - w), Y(h)], [X(W), Y(h)], [X(W), Y(H)], [X(0), Y(H)]];
    return svg(380, 250, poly(pts) + txt(X((W - w) / 2), Y(0) - 16, `${W - w} ${u}`) + txt(X(0) - 10, Y(H / 2), `${H} ${u}`, { a: "end" }) +
      txt(X(W / 2), Y(H) + 20, `${W} ${u}`) + txt(X(W) + 10, Y((h + H) / 2), `${H - h} ${u}`, { a: "start" }),
      `An L-shaped figure. Bottom ${W} ${u}, left side ${H} ${u}, top ${W - w} ${u}, right side ${H - h} ${u}`);
  }
  function figPrism(l, w, h, u) {
    const fw = Math.min(190, 70 + l * 11), fh = Math.min(120, 40 + h * 8), d = Math.min(64, 22 + w * 6);
    const x = 50, yb = 220, yt = yb - fh, dx = d, dy = -d * 0.62;
    const front = [[x, yt], [x + fw, yt], [x + fw, yb], [x, yb]];
    const top = [[x, yt], [x + dx, yt + dy], [x + fw + dx, yt + dy], [x + fw, yt]];
    const side = [[x + fw, yt], [x + fw + dx, yt + dy], [x + fw + dx, yb + dy], [x + fw, yb]];
    return svg(380, 250, poly(top, { fill: "#eef0ff" }) + poly(side, { fill: "#c7cefa" }) + poly(front) +
      txt(x + fw / 2, yb + 18, `${l} ${u}`) + txt(x - 10, (yt + yb) / 2, `${h} ${u}`, { a: "end" }) +
      txt(x + fw + dx / 2 + 12, yb + dy / 2 + 6, `${w} ${u}`, { a: "start" }),
      `A rectangular prism ${l} ${u} long, ${w} ${u} wide, and ${h} ${u} tall`);
  }
  function figCircle(kind, val, u) {
    const seg = kind === "r" ? line(150, 120, 240, 120) : line(60, 120, 240, 120);
    return svg(300, 240, `<circle cx="150" cy="120" r="90" fill="${FILL}" stroke="${INK}" stroke-width="3"/>` + seg +
      `<circle cx="150" cy="120" r="4" fill="${INK}"/>` + txt(kind === "r" ? 195 : 150, 104, `${val} ${u}`),
      `A circle with a ${kind === "r" ? "radius" : "diameter"} of ${val} ${u}`);
  }
  function figRight(a, b, la, lb, lc) {
    const s = Math.min(230 / a, 150 / b), w = a * s, h = b * s, x = 80, y = 200;
    return svg(360, 240, poly([[x, y], [x + w, y], [x, y - h]]) + rightMark(x, y, 1, -1) +
      txt(x + w / 2, y + 22, la) + txt(x - 12, y - h / 2, lb, { a: "end" }) + txt(x + w / 2 + 14, y - h / 2 - 12, lc, { a: "start" }),
      `A right triangle. Bottom leg ${la}, side leg ${lb}, hypotenuse ${lc}`);
  }
  function figTriAngles(A, B, la, lb, lc) {
    const rad = (d) => (d * Math.PI) / 180, C = 180 - A - B, L = Math.sin(rad(B)) / Math.sin(rad(C));
    const P = [[0, 0], [1, 0], [L * Math.cos(rad(A)), L * Math.sin(rad(A))]];
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), maxY = Math.max(...ys);
    const s = Math.min(280 / (maxX - minX), 160 / maxY);
    const pts = P.map((p) => [40 + (p[0] - minX) * s, 200 - p[1] * s]);
    const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
    // Narrow angles push their label further inside, so it doesn't sit on an edge
    const lab = (p, t, ang) => { const dx = cx - p[0], dy = cy - p[1], d = Math.hypot(dx, dy) || 1, k = Math.min(d * 0.62, Math.max(30, 21 / Math.sin(rad(ang) / 2))); return txt(p[0] + (dx / d) * k, p[1] + (dy / d) * k, t, { size: 16 }); };
    return svg(360, 230, poly(pts) + lab(pts[0], la, A) + lab(pts[1], lb, B) + lab(pts[2], lc, C), `A triangle with angles ${la}, ${lb}, and ${lc}`);
  }
  function figLine(a) {
    const O = [180, 170], rad = (d) => (d * Math.PI) / 180, pt = (deg, r) => [O[0] + r * Math.cos(rad(deg)), O[1] - r * Math.sin(rad(deg))];
    const end = pt(a, 140), arc = (from, to, r, c) => { const p1 = pt(from, r), p2 = pt(to, r); return `<path d="M${r2(p1[0])},${r2(p1[1])} A${r},${r} 0 0 0 ${r2(p2[0])},${r2(p2[1])}" fill="none" stroke="${c}" stroke-width="2.5"/>`; };
    const la = pt(a / 2, 62), lx = pt((a + 180) / 2, 62);
    return svg(360, 200, line(30, 170, 330, 170) + line(O[0], O[1], end[0], end[1]) + arc(0, a, 32, BLUE) + arc(a, 180, 40, PINK) +
      `<circle cx="180" cy="170" r="4" fill="${INK}"/>` + txt(la[0], la[1], `${a}°`, { fill: BLUE }) + txt(lx[0], lx[1], "x", { fill: PINK }),
      `A straight line with a ray from it. One angle is ${a} degrees and the other angle is x`);
  }
  function figGrid(points) {
    const c = 24, o = 170, X = (v) => o + v * c, Y = (v) => o - v * c;
    let g = "";
    for (let i = -6; i <= 6; i++) g += line(X(i), Y(-6), X(i), Y(6), { c: GRID, w: 1 }) + line(X(-6), Y(i), X(6), Y(i), { c: GRID, w: 1 });
    g += line(X(-6.6), o, X(6.6), o, { w: 2 }) + line(o, Y(-6.6), o, Y(6.6), { w: 2 });
    for (const v of [-6, -4, -2, 2, 4, 6]) g += txt(X(v), o + 14, num(v), { size: 11, w: 400 }) + txt(o - 8, Y(v), num(v), { size: 11, w: 400, a: "end" });
    g += txt(X(6.6) + 4, o - 10, "x", { size: 14, a: "start" }) + txt(o + 10, Y(6.6), "y", { size: 14, a: "start" });
    for (const p of points) {
      g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="6" fill="${PINK}" stroke="${INK}" stroke-width="2"/>`;
      g += txt(X(p.x) + (p.x >= 0 ? 10 : -10), Y(p.y) - 12, p.label, { size: 15, a: p.x >= 0 ? "start" : "end", w: 700 });
    }
    return svg(340, 340, g, "A coordinate grid with " + points.map((p) => `point ${p.label} at (${num(p.x)}, ${num(p.y)})`).join(" and "));
  }
  function figBar(title, cats, vals, step) {
    const top = Math.ceil(Math.max(...vals) / (step * 2)) * step * 2, x0 = 64, x1 = 384, y0 = 214, y1 = 44, Y = (v) => y0 - ((y0 - y1) * v) / top;
    let g = txt(224, 18, title, { size: 16, w: 700 });
    for (let v = 0; v <= top; v += step) g += line(x0, Y(v), x1, Y(v), { c: GRID, w: 1 }) + txt(x0 - 8, Y(v), String(v), { size: 12, w: 400, a: "end" });
    const bw = (x1 - x0) / cats.length;
    cats.forEach((c, i) => {
      const bx = x0 + i * bw + bw * 0.18, w = bw * 0.64;
      g += `<rect x="${r2(bx)}" y="${r2(Y(vals[i]))}" width="${r2(w)}" height="${r2(y0 - Y(vals[i]))}" fill="${i % 2 ? BLUE : PINK}" stroke="${INK}" stroke-width="2"/>`;
      g += txt(bx + w / 2, y0 + 16, c, { size: 13 });
    });
    g += line(x0, y0, x1, y0, { w: 2 }) + line(x0, y0, x0, y1 - 6, { w: 2 });
    g += `<text x="16" y="${(y0 + y1) / 2}" font-size="13" font-weight="600" fill="${INK}" text-anchor="middle" transform="rotate(-90 16 ${(y0 + y1) / 2})">Number of students</text>`;
    return svg(400, 250, g, `Bar graph: ${title}. ` + cats.map((c, i) => `${c} ${vals[i]}`).join(", "));
  }
  function figDot(counts, title) {
    const X = (v) => 50 + v * 50;
    let g = line(30, 170, 370, 170, { w: 2 });
    counts.forEach((n, v) => {
      g += line(X(v), 164, X(v), 176, { w: 2 }) + txt(X(v), 190, String(v), { size: 14 });
      for (let k = 0; k < n; k++) g += `<circle cx="${X(v)}" cy="${150 - k * 21}" r="8" fill="${BLUE}" stroke="${INK}" stroke-width="1.5"/>`;
    });
    g += txt(200, 214, title, { size: 14, w: 400 });
    return svg(400, 226, g, `Dot plot of ${title.toLowerCase()}: ` + counts.map((n, v) => `${n} at ${v}`).join(", "));
  }
  function figBox(f, lo, hi, step, title) {
    const X = (v) => 34 + ((v - lo) * 352) / (hi - lo);
    let g = line(X(lo) - 6, 130, X(hi) + 6, 130, { w: 2 });
    for (let v = lo; v <= hi; v += step) g += line(X(v), 124, X(v), 136, { w: 2 }) + txt(X(v), 150, String(v), { size: 12, w: 400 });
    g += line(X(f[0]), 78, X(f[1]), 78) + line(X(f[3]), 78, X(f[4]), 78);
    g += line(X(f[0]), 64, X(f[0]), 92) + line(X(f[4]), 64, X(f[4]), 92);
    g += `<rect x="${r2(X(f[1]))}" y="52" width="${r2(X(f[3]) - X(f[1]))}" height="52" fill="${FILL}" stroke="${INK}" stroke-width="3"/>`;
    g += line(X(f[2]), 52, X(f[2]), 104, { c: PINK, w: 4 });
    g += txt(210, 20, title, { size: 15, w: 700 });
    return svg(420, 170, g, `Box plot of ${title.toLowerCase()}: minimum ${f[0]}, first quartile ${f[1]}, median ${f[2]}, third quartile ${f[3]}, maximum ${f[4]}`);
  }
  const SPIN = { red: "#ff5a5f", blue: "#3f7bff", green: "#2ecc71", yellow: "#ffd23f" };
  function figSpinner(sections) {
    const c = 130, R = 100, n = sections.length;
    let g = "";
    sections.forEach((col, i) => {
      const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2, am = (a0 + a1) / 2;
      g += `<path d="M${c},${c} L${r2(c + R * Math.cos(a0))},${r2(c + R * Math.sin(a0))} A${R},${R} 0 0 1 ${r2(c + R * Math.cos(a1))},${r2(c + R * Math.sin(a1))} Z" fill="${SPIN[col]}" stroke="${INK}" stroke-width="2.5"/>`;
      g += txt(c + 66 * Math.cos(am), c + 66 * Math.sin(am), col[0].toUpperCase(), { size: 16, w: 700 });
    });
    g += line(c, c, c + 48, c - 48, { w: 4 }) + `<circle cx="${c}" cy="${c}" r="7" fill="${INK}"/>`;
    return svg(260, 260, g, "A spinner with 8 equal sections: " + sections.join(", "));
  }
  function table(rows) {
    return `<table class="map-table">${rows.map((r) => `<tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map((c) => `<td${c === "?" ? ' class="q"' : ""}>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
  }

  /* =====================================================================
     Generators: G[topic][stage] is a list of variants. Stage 1 is a warm-up,
     stage 7 is about as hard as MAP gets for grades 6 to 8.
     ===================================================================== */
  const G = {};

  /* ---------- Quick facts: computation and number sense ---------- */
  G.facts = [null,
    [() => {
      let a; do { a = rand(12, 29); } while (a % 10 === 0);
      const b = rand(6, 9), t = a - (a % 10), o = a % 10, ans = a * b;
      const [group, each] = pick([["boxes of markers", "markers"], ["packs of trading cards", "cards"], ["rows of chairs", "chairs"], ["crates of apples", "apples"]]);
      return Q(`A school has ${a} ${group}. Each one has ${b} ${each}. How many ${each} are there in all?`, num(ans),
        [num(ans + b), num(ans - b), num(t * b + o), num(a + b)],
        [`Multiply: ${a} × ${b}.`, `Break ${a} into ${t} + ${o}. Then ${t} × ${b} = ${t * b} and ${o} × ${b} = ${o * b}.`, `Add the parts: ${t * b} + ${o * b} = ${num(ans)}.`]);
    }],
    [() => {
      let n, c; do { n = rand(95, 260); c = pick([24, 28, 30, 36, 40, 45]); } while (n % c < 3);
      const q = Math.floor(n / c), r = n % c;
      return Q(`${n} students are going on a field trip. Each bus holds ${c} students. How many buses are needed so every student has a seat?`, num(q + 1),
        [num(q), num(r), num(r4(Math.round((n / c) * 10) / 10)), num(q + 2)],
        [`Divide: ${n} ÷ ${c} = ${q} remainder ${r}.`, `${q} buses hold ${q * c} students, so ${r} students would still need a seat.`, `Add one more bus for them: ${q} + 1 = ${q + 1}.`]);
    }, () => {
      let n, c; do { n = rand(95, 260); c = pick([12, 15, 16, 18, 24, 25]); } while (n % c < 3);
      const q = Math.floor(n / c), r = n % c;
      return Q(`A baker makes ${n} cookies and puts ${c} cookies in each bag. How many bags can be completely filled?`, num(q),
        [num(q + 1), num(r), num(r4(Math.round((n / c) * 10) / 10)), num(q - 1)],
        [`Divide: ${n} ÷ ${c} = ${q} remainder ${r}.`, `The ${r} leftover cookies are not enough to fill another bag.`, `So ${q} bags are completely filled.`]);
    }],
    [() => {
      const w = rand(1, 8), c = pick([25, 50, 75, 20, 40, 60, 80, 45, 35]), n = rand(3, 9);
      const price = w + c / 100, total = r2(price * n), item = pick(["notebook", "sandwich", "bottle of juice", "movie ticket", "bag of chips"]);
      return Q(`One ${item} costs ${money(price, true)}. How much do ${n} of them cost?`, money(total, true),
        [money(total * 10, true), money(w * n + c / 100, true), money(total + price, true), money(total - price, true)],
        [`Multiply the dollars: ${w} × ${n} = ${w * n}.`, `Multiply the cents: ${money(c / 100, true)} × ${n} = ${money((c * n) / 100, true)}.`,
          `Add them: ${money(w * n, true)} + ${money((c * n) / 100, true)} = ${money(total, true)}.`]);
    }],
    [() => {
      const b = rand(2, 6), c = rand(2, 6), e = rand(2, 5), d = e * rand(2, 6), a = b * c + rand(2, 14);
      const X = b * c, Y = d / e, ans = a - X + Y, ltr = ((a - b) * c + d) / e;
      return Q(`What is the value of this expression?\n${a} − ${b} × ${c} + ${d} ÷ ${e}`, num(ans),
        [Number.isInteger(ltr) ? num(ltr) : null, num((a - b) * c + Y), num(a - X - Y), num(a + X + Y)],
        [`Multiply and divide first, from left to right: ${b} × ${c} = ${X} and ${d} ÷ ${e} = ${Y}.`, `Now the expression is ${a} − ${X} + ${Y}.`,
          `Add and subtract from left to right: ${a} − ${X} = ${num(a - X)}, then ${num(a - X)} + ${Y} = ${num(ans)}.`]);
    }],
    [() => {
      const a = pick([0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.2, 1.5, 0.25, 0.75]), q = rand(3, 14), D = r4(a * q);
      const places = String(a).split(".")[1].length, k = 10 ** places;
      return Q(`What is ${num(D)} ÷ ${num(a)}?`, num(q), [num(q / 10), num(q * 10), num(r4(D * a)), num(q + 1)],
        [`Make the divisor a whole number: move the decimal point ${places} place${places > 1 ? "s" : ""} to the right in both numbers.`,
          `${num(D)} ÷ ${num(a)} becomes ${num(r4(D * k))} ÷ ${num(a * k)}.`, `${num(r4(D * k))} ÷ ${num(a * k)} = ${q}.`]);
    }],
    [() => {
      const [a, b] = shuffle(pick([[8, 6], [10, 8], [12, 8], [6, 4], [9, 6], [10, 4], [12, 9], [15, 10], [12, 10], [6, 10]]));
      const L = lcm(a, b);
      return Q(`Hot dogs come in packs of ${a}. Buns come in packs of ${b}. What is the least number of hot dogs you can buy to have exactly the same number of hot dogs and buns?`, num(L),
        [num(a * b), num(gcd(a, b)), num(a + b), num(L * 2)],
        [`List multiples of ${a}: ${multiples(a, L)}.`, `List multiples of ${b}: ${multiples(b, L)}.`, `The first number on both lists is ${L}. That's the least common multiple.`]);
    }, () => {
      const [a, b] = pick([[24, 36], [18, 30], [16, 40], [20, 30], [28, 42], [27, 45], [32, 48], [24, 40], [30, 45]]);
      const g = gcd(a, b);
      let small = 1; for (let k = 2; k < g; k++) if (g % k === 0) small = g / k > 1 ? Math.max(small, g / k) : small;
      return Q(`A coach has ${a} water bottles and ${b} granola bars. She wants to make identical snack packs with nothing left over. What is the greatest number of snack packs she can make?`, num(g),
        [small > 1 ? num(small) : null, num(lcm(a, b)), num(a / g), num(b - a)],
        [`Each pack gets the same number of bottles and bars, so the number of packs has to divide both ${a} and ${b}.`,
          `Factors of ${a}: ${factors(a)}.`, `Factors of ${b}: ${factors(b)}.`, `The greatest factor on both lists is ${g}. That's the greatest common factor.`]);
    }],
    [() => {
      const nm = name(), rate = pick([8.5, 9.25, 10.5, 11.75, 12.5, 9.75]), h = rand(4, 9), earned = r2(rate * h);
      const spend = r2(rand(12, Math.floor(earned) - 8) + pick([0, 0.25, 0.5, 0.75, 0.99])), left = r2(earned - spend);
      return Q(`${nm} earns ${money(rate, true)} per hour babysitting and works ${h} hours. Then ${nm} spends ${money(spend, true)} on a gift. How much money does ${nm} have left?`, money(left, true),
        [money(earned, true), money(earned + spend, true), money(left + rate, true), left - rate > 0 ? money(left - rate, true) : null],
        [`Find how much ${nm} earned: ${money(rate, true)} × ${h} = ${money(earned, true)}.`, `Subtract what ${nm} spent: ${money(earned, true)} − ${money(spend, true)} = ${money(left, true)}.`]);
    }],
  ];

  /* ---------- Integers ---------- */
  G.integers = [null,
    [() => {
      const t = -rand(2, 14), up = rand(5, 20), ans = t + up, F = (v) => `${num(v)}°F`;
      return Q(`At 6 a.m. the temperature was ${F(t)}. By noon it had risen ${up} degrees. What was the temperature at noon?`, F(ans),
        [F(t - up), F(-ans), F(-t + up), F(ans + 1), F(ans - 1)],
        [`Rising means adding: ${num(t)} + ${up}.`, `Start at ${num(t)} on a number line and move ${up} to the right.`, `${num(t)} + ${up} = ${num(ans)}, so it was ${F(ans)}.`]);
    }],
    [() => {
      let v; do { v = shuffle(Array.from({ length: 25 }, (_, i) => i - 12)).slice(0, 4); } while (v.filter((x) => x < 0).length < 2);
      const asc = v.slice().sort((a, b) => a - b), list = (a) => a.map(num).join(", ");
      const byAbs = v.slice().sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
      const negFlip = [...v.filter((x) => x < 0).sort((a, b) => b - a), ...v.filter((x) => x >= 0).sort((a, b) => a - b)];
      return Q(`Which list shows these numbers from least to greatest?\n${v.map(num).join(",   ")}`, list(asc),
        [list(byAbs), list(negFlip), list(asc.slice().reverse())],
        [`On a number line, numbers get greater as you move to the right.`, `The negative number farthest from 0 is the least: ${num(asc[0])}.`, `From least to greatest: ${list(asc)}.`], { fill: false });
    }],
    [() => {
      const d = rand(12, 60), h = rand(10, 60);
      return Q(`A diver is ${d} feet below sea level, at ${num(-d)} feet. A bird is flying ${h} feet above sea level. What is the distance between them?`, `${d + h} feet`,
        [`${Math.abs(h - d)} feet`, `${num(-(d + h))} feet`, `${d + h + 10} feet`, `${d * 2} feet`],
        [`The diver is ${d} feet below 0 and the bird is ${h} feet above 0.`, `They are on opposite sides of 0, so add their distances from 0: |${num(-d)}| + |${h}| = ${d} + ${h}.`, `${d} + ${h} = ${d + h} feet.`]);
    }],
    [() => {
      const x = rand(2, 9), n = rand(3, 9), ans = -x * n;
      const [text, unit] = pick([[`The temperature drops ${x} degrees every hour for ${n} hours.`, "hour"],
        [`A hiker goes down a canyon trail, dropping ${x} meters in elevation every minute for ${n} minutes.`, "minute"],
        [`A video game player loses ${x} points every turn for ${n} turns.`, "turn"]]);
      return Q(`${text} Which integer shows the total change?`, num(ans), [num(-ans), num(-(x + n)), num(-(x * n - x)), num(-(x * n + x))],
        [`Each ${unit} the change is ${num(-x)}.`, `For ${n} ${unit}s, multiply: ${n} × (${num(-x)}) = ${num(ans)}.`, `A positive times a negative is negative, so the total change is ${num(ans)}.`]);
    }],
    [() => {
      const a = rand(2, 9), b = rand(2, 9), d = rand(2, 6), c = d * rand(2, 8), ans = -a * b + c / d;
      return Q(`What is the value of this expression?\n(${num(-a)})(${b}) − (${num(-c)}) ÷ ${d}`, num(ans),
        [num(-a * b - c / d), num(a * b + c / d), num(a * b - c / d)],
        [`Multiply and divide before you subtract.`, `(${num(-a)})(${b}) = ${num(-a * b)}, because a negative times a positive is negative.`, `(${num(-c)}) ÷ ${d} = ${num(-c / d)}.`,
          `Now subtract: ${num(-a * b)} − (${num(-c / d)}) = ${num(-a * b)} + ${c / d} = ${num(ans)}.`]);
    }],
    [() => {
      const x = rand(-6, 6), y1 = rand(1, 6), y2 = -rand(1, 6), ans = y1 - y2;
      return Q(`What is the distance between point A (${num(x)}, ${num(y1)}) and point B (${num(x)}, ${num(y2)})?`, units(ans),
        [units(Math.abs(y1 + y2)), units(y1), units(ans + 2), x ? units(Math.abs(2 * x)) : null],
        [`Both points have the same x-coordinate, ${num(x)}, so the distance is straight up and down.`, `A is ${units(y1)} above the x-axis and B is ${units(-y2)} below it.`,
          `Add the distances: ${y1} + ${-y2} = ${units(ans)}.`], { figure: figGrid([{ x, y: y1, label: "A" }, { x, y: y2, label: "B" }]) });
    }, () => {
      const y = rand(-6, 6), x1 = -rand(1, 6), x2 = rand(1, 6), ans = x2 - x1;
      return Q(`What is the distance between point A (${num(x1)}, ${num(y)}) and point B (${num(x2)}, ${num(y)})?`, units(ans),
        [units(Math.abs(x1 + x2)), units(x2), units(ans + 2), y ? units(Math.abs(2 * y)) : null],
        [`Both points have the same y-coordinate, ${num(y)}, so the distance is straight across.`, `A is ${units(-x1)} left of the y-axis and B is ${units(x2)} right of it.`,
          `Add the distances: ${-x1} + ${x2} = ${units(ans)}.`], { figure: figGrid([{ x: x1, y, label: "A" }, { x: x2, y, label: "B" }]) });
    }],
    [() => {
      const s = rand(4, 15) * 10, r = rand(2, 6) * 10, k = pick([2, 3]), fin = -s + r - k * r, M = (v) => `${num(v)} meters`;
      return Q(`A submarine is at ${M(-s)}. It rises ${r} meters. Then it dives ${k === 2 ? "twice" : "three times"} as far as it rose. Where is the submarine now?`, M(fin),
        [M(-s + r + k * r), M(-s - r - k * r), M(-s - k * r), M(-s + r - (k - 1) * r)],
        [`Rising means adding: ${num(-s)} + ${r} = ${num(-s + r)}.`, `It dives ${k} × ${r} = ${k * r} meters. Diving means subtracting: ${num(-s + r)} − ${k * r} = ${num(fin)}.`, `So the submarine is at ${M(fin)}.`]);
    }],
  ];

  /* ---------- Fractions & percents ---------- */
  const FR = [[1, 2], [1, 4], [3, 4], [2, 5], [3, 5], [4, 5], [1, 5], [3, 10], [7, 10], [9, 20], [3, 20], [1, 8], [3, 8], [7, 20], [11, 25]];
  const scaleTo = (d) => (10 % d === 0 ? 10 / d : 100 % d === 0 ? 100 / d : 1000 / d);
  G.fdp = [null,
    [() => {
      const [n, d] = pick(FR), k = scaleTo(d), dec = n / d;
      return Q(`Which decimal is equal to ${n}/${d}?`, num(dec), [`${n}.${d}`, num(Number(`0.${n}${d}`)), num(r4(d / n)), num(r4(dec / 10)), num(r4(dec * 10))],
        [`A fraction is a division: ${n}/${d} means ${n} ÷ ${d}.`, `Make an equivalent fraction with ${d * k} as the denominator: ${n}/${d} = ${n * k}/${d * k}.`, `${n * k}/${d * k} = ${num(dec)}.`]);
    }, () => {
      const [n, d] = pick(FR), k = 100 % d === 0 ? 100 / d : null, pc = r4((n / d) * 100);
      return Q(`Which percent is equal to ${n}/${d}?`, `${num(pc)}%`, [`${n}${d}%`, `${n}%`, `${d}%`, `${num(r4(pc / 10))}%`],
        [`Percent means "out of 100."`, k ? `Make the denominator 100: ${n}/${d} = ${n * k}/100.` : `Divide: ${n} ÷ ${d} = ${num(n / d)}, which is ${num(pc)} hundredths.`, `So ${n}/${d} = ${num(pc)}%.`]);
    }],
    [() => {
      const P = pick([10, 20, 25, 30, 40, 60, 75, 15, 5]), n = 20 * rand(2, 20), ans = (P * n) / 100, ten = n / 10;
      const how = P === 25 ? [`25% is one fourth.`, `${n} ÷ 4 = ${ans}.`]
        : P === 75 ? [`25% is one fourth: ${n} ÷ 4 = ${n / 4}.`, `75% is three fourths: 3 × ${n / 4} = ${ans}.`]
        : P === 5 ? [`10% of ${n} is ${n} ÷ 10 = ${ten}.`, `5% is half of 10%: ${ten} ÷ 2 = ${ans}.`]
        : P === 15 ? [`10% of ${n} is ${n} ÷ 10 = ${ten}.`, `5% is half of that: ${num(ten / 2)}.`, `15% = 10% + 5% = ${ten} + ${num(ten / 2)} = ${ans}.`]
        : [`10% of ${n} is ${n} ÷ 10 = ${ten}.`, `${P}% is ${P / 10} times as much: ${P / 10} × ${ten} = ${ans}.`];
      return Q(`There are ${n} students at a school. ${P}% of them walk to school. How many students walk to school?`, num(ans),
        [num(n - ans), num(ans * 10), num(ans + ten), num(P)], [`${P}% means ${P} out of every 100.`, ...how]);
    }],
    [() => {
      let price, pct; do { price = pick([40, 60, 80, 120, 150, 90, 70, 250, 36, 48]); pct = pick([10, 20, 25, 30, 40, 50]); } while ((price * pct) % 100);
      const d = (price * pct) / 100, sale = price - d, item = pick(["jacket", "pair of headphones", "skateboard", "backpack"]);
      return Q(`A ${item} costs ${money(price)}. It is on sale for ${pct}% off. What is the sale price?`, money(sale),
        [money(d), money(price + d), money(price - pct), money(sale - 5)],
        [`Find the discount: ${pct}% of ${money(price)} is ${money(d)}.`, `Subtract the discount from the price: ${money(price)} − ${money(d)} = ${money(sale)}.`]);
    }],
    [() => {
      let a, b, s; do { [a, b] = pick([[1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [3, 8], [2, 5]]); s = rand(4, 16); } while ((s * a) % b);
      const T = (s * a) / b;
      return Q(`A recipe uses ${a}/${b} cup of rice for each serving. How many servings can you make with ${T} cups of rice?`, num(s),
        [frac(T * a, b), a > 1 ? num(T * b) : null, num(T + b), num(T * a), num(s + b)],
        [`Divide the rice by the size of one serving: ${T} ÷ ${a}/${b}.`, `Dividing by a fraction is the same as multiplying by its reciprocal: ${T} × ${b}/${a}.`,
          a === 1 ? `${T} × ${b} = ${s}.` : `${T} × ${b} = ${T * b}, and ${T * b} ÷ ${a} = ${s}.`]);
    }],
    [() => {
      let base, pct, up; do { base = pick([20, 40, 50, 80, 25, 60, 200, 30]); pct = pick([10, 20, 25, 50, 75, 30, 40, 60]); up = Math.random() < 0.55; } while ((base * pct) % 100);
      const ch = (base * pct) / 100, nw = up ? base + ch : base - ch;
      return Q(`The price of a video game went from ${money(base)} to ${money(nw)}. What is the percent ${up ? "increase" : "decrease"}?`, `${pct}%`,
        [`${num(ch)}%`, `${num(Math.round((ch / nw) * 1000) / 10)}%`, `${100 - pct}%`, `${pct * 2}%`],
        [`Find the amount of change: ${up ? `${money(nw)} − ${money(base)}` : `${money(base)} − ${money(nw)}`} = ${money(ch)}.`,
          `Divide by the original price: ${money(ch)} ÷ ${money(base)} = ${num(ch / base)}.`, `Write it as a percent: ${num(ch / base)} = ${pct}%.`]);
    }],
    [() => {
      let O, p, S; do { O = pick([40, 50, 60, 80, 100, 120, 150, 200, 75]); p = pick([10, 20, 25, 40, 30]); S = (O * (100 - p)) / 100; } while (!Number.isInteger(S));
      const keep = (100 - p) / 100;
      return Q(`After a ${p}% discount, a pair of shoes costs ${money(S)}. What was the original price?`, money(O),
        [money(r2(S + (S * p) / 100), !Number.isInteger(r2(S + (S * p) / 100))), money(S + p), money(r2(S * keep), !Number.isInteger(r2(S * keep))), money(O + 10)],
        [`A ${p}% discount means you pay ${100 - p}% of the original price.`, `So ${num(keep)} × original = ${money(S)}.`, `Divide: ${money(S)} ÷ ${num(keep)} = ${money(O)}.`,
          `Check: ${p}% of ${money(O)} is ${money((O * p) / 100)}, and ${money(O)} − ${money((O * p) / 100)} = ${money(S)}.`]);
    }],
    [() => {
      const P = pick([200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000]), r = pick([2, 3, 4, 5, 6]), t = rand(2, 6), I = (P * r * t) / 100;
      return Q(`${name()} puts ${money(P)} in a savings account that earns ${r}% simple interest each year. How much money is in the account after ${t} years?`, money(P + I),
        [money(I), money(P + (P * r) / 100), money(P + r * t), money(P * r * t)],
        [`Simple interest = starting amount × rate × time.`, `${money(P)} × ${num(r / 100)} × ${t} = ${money(I)} in interest.`, `Add the interest to the starting amount: ${money(P)} + ${money(I)} = ${money(P + I)}.`]);
    }],
  ];

  /* ---------- Ratios and proportional relationships ---------- */
  G.ratios = [null,
    [() => {
      const unit = pick([1.25, 0.75, 2.5, 1.5, 0.6, 3.25, 1.8, 2.4, 0.9]), n = rand(3, 8), T = r2(unit * n);
      return Q(`${n} pounds of apples cost ${money(T, true)}. What is the cost per pound?`, money(unit, true),
        [money(r2(n / T), true), money(r2(T * n), true), money(unit + 0.25, true), money(unit * 2, true)],
        [`"Per pound" means the cost of 1 pound.`, `Divide the total cost by the number of pounds: ${money(T, true)} ÷ ${n} = ${money(unit, true)}.`]);
    }],
    [() => {
      const [a, b] = pick([[2, 3], [3, 5], [4, 7], [5, 2], [3, 4], [2, 5], [5, 3], [4, 3]]), k2 = rand(2, 3);
      let k3; do { k3 = rand(4, 10); } while (k3 === k2);
      const [top, bottom] = pick([["Cups of flour", "Cups of sugar"], ["Laps", "Minutes"], ["Red beads", "Blue beads"], ["Cans of paint", "Walls painted"]]);
      return Q(`The table shows equivalent ratios. What number goes in the box with the question mark?`, num(b * k3),
        [num(b + (a * k3 - a)), num(a * k3), num(b * k3 + b), num(b * (k3 - 1))],
        [`In the first column, the ratio is ${a} : ${b}.`, `${a * k3} = ${a} × ${k3}, so multiply ${b} by ${k3} too.`, `${b} × ${k3} = ${b * k3}.`],
        { figure: table([[top, String(a), String(a * k2), String(a * k3)], [bottom, String(b), String(b * k2), "?"]]) });
    }],
    [() => {
      const item = pick(["bottles of water", "granola bars", "pencils", "juice boxes"]);
      let nA, nB, uA, uB; do { nA = rand(4, 12); nB = rand(4, 12); uA = rand(30, 95); uB = uA + pick([-15, -10, -5, 5, 10, 15]); } while (nA === nB || uB < 20);
      const pA = (nA * uA) / 100, pB = (nB * uB) / 100, best = uA < uB ? "Store A" : "Store B";
      return Q(`Store A sells ${nA} ${item} for ${money(pA, true)}. Store B sells ${nB} ${item} for ${money(pB, true)}. Which store has the better buy?`, best, [],
        [`Find the price of one item at each store.`, `Store A: ${money(pA, true)} ÷ ${nA} = ${money(uA / 100, true)} each.`, `Store B: ${money(pB, true)} ÷ ${nB} = ${money(uB / 100, true)} each.`,
          `${best} charges less for each one, so it has the better buy.`],
        { fixed: ["Store A", "Store B", "They cost the same for each one", "There isn't enough information"] });
    }],
    [() => {
      const s = rand(2, 5), u = rand(6, 25), m = s * u;
      let t; do { t = rand(6, 12); } while (t === s);
      const mi = (v) => `${num(v)} miles`;
      return Q(`On a map, ${s} inches represent ${m} miles. How many miles do ${t} inches represent?`, mi(t * u),
        [mi(t * m), mi(m + t - s), mi(t * s), mi(t * u + u)],
        [`Find the miles for 1 inch: ${m} ÷ ${s} = ${u} miles.`, `Multiply by ${t} inches: ${t} × ${u} = ${num(t * u)} miles.`]);
    }],
    [() => {
      const [a, b] = pick([[3, 5], [2, 7], [4, 5], [3, 4], [5, 3], [2, 3], [5, 7]]), k = rand(3, 9), T = (a + b) * k;
      return Q(`In a club, the ratio of boys to girls is ${a} : ${b}. There are ${T} students in the club. How many are girls?`, num(b * k),
        [num(a * k), num(T - b), num(Math.round(T / b)), num(b * k + k)],
        [`The ratio has ${a} + ${b} = ${a + b} parts in all.`, `Each part is ${T} ÷ ${a + b} = ${k} students.`, `Girls are ${b} parts: ${b} × ${k} = ${b * k}.`]);
    }],
    [() => {
      const k = pick([1.5, 2.5, 3, 4, 0.5, 1.25, 6, 3.5, 0.75]), xs = pick([[2, 4, 6], [2, 5, 8], [4, 8, 12], [3, 6, 9], [4, 6, 10]]), ys = xs.map((x) => r4(x * k));
      return Q(`The table shows a proportional relationship between x and y. Which equation represents it?`, `y = ${num(k)}x`,
        [`y = x${signed(r4(ys[0] - xs[0]))}`, `y = ${coef(ys[0])}`, `y = ${coef(k + 1)}`, `y = x + ${num(k)}`],
        [`In a proportional relationship, y ÷ x is the same for every pair.`, `${num(ys[0])} ÷ ${xs[0]} = ${num(k)}, ${num(ys[1])} ÷ ${xs[1]} = ${num(k)}, and ${num(ys[2])} ÷ ${xs[2]} = ${num(k)}.`,
          `The constant of proportionality is ${num(k)}, so y = ${num(k)}x.`],
        { figure: table([["x", ...xs.map(String)], ["y", ...ys.map(num)]]) });
    }],
    [() => {
      let h, r, t; do { h = pick([2, 2.5, 1.5, 3, 4]); r = pick([40, 50, 60, 30, 48, 56, 64]); t = pick([1.5, 2.5, 3.5, 4.5, 5, 6, 3]); } while (t === h);
      const M = r * h, D = r * t, H = (v) => `${num(v)} hours`;
      return Q(`A car travels ${num(M)} miles in ${num(h)} hours. At the same speed, how many hours will it take to travel ${num(D)} miles?`, H(t),
        [H(t + 0.5), H(t - 0.5), H(t + 1), H(r4(D / M))],
        [`Find the speed: ${num(M)} ÷ ${num(h)} = ${r} miles per hour.`, `Time = distance ÷ speed: ${num(D)} ÷ ${r} = ${num(t)} hours.`]);
    }],
  ];

  /* ---------- Exponents & roots ---------- */
  G.exponents = [null,
    [() => {
      const b = rand(2, 5), e = b <= 3 ? rand(3, 5) : rand(3, 4), v = b ** e;
      const chain = []; let acc = b; for (let i = 2; i <= e; i++) { chain.push(`${num(acc)} × ${b} = ${num(acc * b)}`); acc *= b; }
      return Q(`What is the value of ${b}${sup(e)}?`, num(v), [num(b * e), num(e ** b), num(b ** (e - 1)), num(v + b)],
        [`${b}${sup(e)} means ${b} multiplied by itself ${e} times: ${Array(e).fill(b).join(" × ")}.`, `Multiply step by step: ${chain.join(", then ")}.`]);
    }],
    [() => {
      const a = rand(3, 11), n = rand(a * a + 1, (a + 1) ** 2 - 1), pair = (x) => `${x} and ${x + 1}`;
      return Q(`The square root of ${n}, written √${n}, is between which two whole numbers?`, pair(a),
        [pair(a - 1), pair(a + 1), pair(Math.floor(n / 2)), pair(a + 2)],
        [`Find the perfect squares on each side of ${n}: ${a}² = ${a * a} and ${a + 1}² = ${(a + 1) ** 2}.`, `${a * a} < ${n} < ${(a + 1) ** 2}, so √${n} is between √${a * a} and √${(a + 1) ** 2}.`,
          `That means √${n} is between ${a} and ${a + 1}.`], { fill: false });
    }],
    [() => {
      const a = rand(2, 9), b = rand(2, 5), c = rand(2, 6), ans = a + b * c * c;
      return Q(`What is the value of this expression?\n${a} + ${b} × ${c}²`, num(ans), [num((a + b) * c * c), num(a + (b * c) ** 2), num(a + b * c * 2), num(a + b * c)],
        [`Order of operations: exponents first, then multiply, then add.`, `${c}² = ${c * c}.`, `${b} × ${c * c} = ${b * c * c}.`, `${a} + ${b * c * c} = ${ans}.`]);
    }],
    [() => {
      const B = pick(["x", "y", "a", "n", "3", "5", "2"]), isNum = /\d/.test(B), dot = isNum ? " × " : " · ", m = rand(2, 8), n = rand(2, 6);
      return Q(`Which expression is equal to ${B}${sup(m)}${dot}${B}${sup(n)}?`, `${B}${sup(m + n)}`,
        [`${B}${sup(m * n)}`, isNum ? `${+B * +B}${sup(m + n)}` : `2${B}${sup(m + n)}`, `${B}${sup(Math.abs(m - n) || m + n + 1)}`, `${B}${sup(m + n + 1)}`],
        [`When you multiply powers with the same base, add the exponents.`, `${m} + ${n} = ${m + n}, so ${B}${sup(m)}${dot}${B}${sup(n)} = ${B}${sup(m + n)}.`,
          `Why: ${B}²${dot}${B}³ = (${B}${dot}${B})${dot}(${B}${dot}${B}${dot}${B}), which is 5 ${B}'s multiplied together, or ${B}⁵.`], { fill: false });
    }, () => {
      const B = pick(["x", "y", "a", "n", "3", "5", "2"]), n = rand(2, 5), m = n + rand(2, 6);
      const third = m % n === 0 && m / n !== m - n ? m / n : m - n + 1;
      return Q(`Which expression is equal to ${B}${sup(m)} ÷ ${B}${sup(n)}?`, `${B}${sup(m - n)}`,
        [`${B}${sup(m + n)}`, `${B}${sup(m * n)}`, `${B}${sup(third)}`],
        [`When you divide powers with the same base, subtract the exponents.`, `${m} − ${n} = ${m - n}, so ${B}${sup(m)} ÷ ${B}${sup(n)} = ${B}${sup(m - n)}.`], { fill: false });
    }],
    [() => {
      const d1 = rand(1, 9), d2 = rand(1, 9), a = d1 + d2 / 10, k = rand(3, 7), value = Math.round(a * 10 ** k);
      return Q(`What is ${num(a)} × 10${sup(k)} written in standard form?`, num(value),
        [num(Math.round(a * 10 ** (k - 1))), num(Math.round(a * 10 ** (k + 1))), num(r4(a * k))],
        [`Multiplying by 10${sup(k)} moves the decimal point ${k} places to the right.`, `Start with ${num(a)}, move the decimal point ${k} places, and fill in zeros: ${num(value)}.`]);
    }, () => {
      const d1 = rand(1, 9), d2 = rand(1, 9), a = d1 + d2 / 10, k = rand(4, 8), N = Math.round(a * 10 ** k), sci = (e) => `${num(a)} × 10${sup(e)}`;
      return Q(`How is ${num(N)} written in scientific notation?`, sci(k), [sci(k - 1), sci(k + 1), sci(k + 2)],
        [`Scientific notation is a number from 1 to 10 times a power of 10.`, `Put the decimal point after the first digit: ${num(a)}.`,
          `To get from ${num(a)} back to ${num(N)}, the decimal point moves ${k} places to the right. So ${num(N)} = ${sci(k)}.`], { fill: false });
    }],
    [() => {
      let b, n; do { b = rand(2, 5); n = rand(1, 3); } while (b ** n > 125);
      const P = b ** n;
      return Q(`What is the value of ${b}${sup(-n)}?`, `1/${P}`, [num(-P), num(-b * n), num(P), b * n !== P ? `1/${b * n}` : `1/${P + 1}`],
        [`A negative exponent means "1 over" the same power with a positive exponent: ${b}${sup(-n)} = 1/${b}${sup(n)}.`, `${b}${sup(n)} = ${P}.`, `So ${b}${sup(-n)} = 1/${P}.`]);
    }, () => {
      const b = rand(2, 9), c = rand(2, 9), d = rand(1, 12);
      return Q(`What is the value of this expression?\n${c} × ${b}⁰ + ${d}`, num(c + d), [num(d), num(c * b + d), num(c + b + d), num(c * d)],
        [`Any nonzero number to the 0 power is 1, so ${b}⁰ = 1.`, `${c} × 1 = ${c}.`, `${c} + ${d} = ${c + d}.`]);
    }],
    [() => {
      let q, b, a; do { q = pick([2, 3, 4, 5, 6, 8]); b = pick([1.5, 2, 3]); a = q * b; } while (a >= 10);
      const diff = rand(2, 4), n = rand(2, 5), m = n + diff, ans = q * 10 ** diff;
      return Q(`The population of a large city is about ${num(a)} × 10${sup(m)}. The population of a small town is about ${num(b)} × 10${sup(n)}. About how many times greater is the city's population than the town's?`, num(ans),
        [num(q * 10 ** (diff + 1)), num(q * 10 ** (diff - 1)), num(r4((a - b) * 10 ** diff)), num(q * diff)],
        [`Divide the first parts: ${num(a)} ÷ ${num(b)} = ${q}.`, `Divide the powers of 10 by subtracting exponents: 10${sup(m)} ÷ 10${sup(n)} = 10${sup(diff)}.`, `Multiply: ${q} × 10${sup(diff)} = ${num(ans)}.`]);
    }],
  ];

  /* ---------- Equations, expressions, and functions ---------- */
  const TIMES = { 2: "twice", 3: "three times", 4: "four times", 5: "five times", 6: "six times" };
  G.equations = [null,
    [() => {
      const a = rand(2, 9), b = rand(1, 15), v = rand(2, 9), L = pick(["n", "x", "k"]), ans = a * v + b;
      return Q(`What is the value of ${a}${L} + ${b} when ${L} = ${v}?`, num(ans), [num(a * (v + b)), num(a + v + b), num(Number(`${a}${v}`) + b), num(a * v - b)],
        [`${a}${L} means ${a} × ${L}. Replace ${L} with ${v}: ${a} × ${v} + ${b}.`, `Multiply first: ${a} × ${v} = ${a * v}.`, `Then add: ${a * v} + ${b} = ${ans}.`]);
    }],
    [() => {
      const nm = name(), s = rand(8, 40), a = rand(5, 30);
      return Q(`${nm} had some stickers. Then a friend gave ${nm} ${a} more, and now ${nm} has ${s + a} stickers. How many stickers did ${nm} have at first?`, num(s),
        [num(s + 2 * a), num(a), num(s + a), num(s - 1)],
        [`Write an equation: x + ${a} = ${s + a}.`, `Undo adding ${a} by subtracting ${a} from both sides: x = ${s + a} − ${a}.`, `x = ${s}.`]);
    }, () => {
      const a = rand(3, 9), b = rand(3, 12);
      return Q(`Solve for x:\nx ÷ ${a} = ${b}`, num(a * b), [num(r2(b / a)), num(a + b), num(b - a), num(a * b + a)],
        [`Undo dividing by ${a} by multiplying both sides by ${a}.`, `x = ${b} × ${a} = ${a * b}.`, `Check: ${a * b} ÷ ${a} = ${b}.`]);
    }, () => {
      const a = rand(3, 9), b = rand(3, 12);
      return Q(`Solve for x:\n${a}x = ${a * b}`, num(b), [num(a * a * b), num(a * b - a), num(a * b + a), num(b + 1)],
        [`${a}x means ${a} times x. Undo it by dividing both sides by ${a}.`, `x = ${a * b} ÷ ${a} = ${b}.`]);
    }],
    [() => {
      const k = rand(2, 6), c = rand(2, 9), kind = rand(0, 3);
      if (kind === 0) return Q(`Which expression means "${c} less than ${TIMES[k]} a number n"?`, `${k}n − ${c}`, [`${c} − ${k}n`, `${k}(n − ${c})`, `${k}n + ${c}`],
        [`"${TIMES[k]} a number n" is ${k}n.`, `"${c} less than" something means you subtract ${c} from it, so the ${c} comes after: ${k}n − ${c}.`], { fill: false });
      if (kind === 1) return Q(`Which expression means "${TIMES[k]} the sum of a number n and ${c}"?`, `${k}(n + ${c})`, [`${k}n + ${c}`, `${k} + n + ${c}`, `${c}(n + ${k})`],
        [`"The sum of a number n and ${c}" is n + ${c}.`, `"${TIMES[k]} the sum" means multiply the whole sum, so it needs parentheses: ${k}(n + ${c}).`], { fill: false });
      if (kind === 2) return Q(`Which expression means "the quotient of a number n and ${k}, increased by ${c}"?`, `n ÷ ${k} + ${c}`, [`${k} ÷ n + ${c}`, `n ÷ (${k} + ${c})`, `${k}n + ${c}`],
        [`"The quotient of a number n and ${k}" means n divided by ${k}: n ÷ ${k}.`, `"Increased by ${c}" means add ${c}: n ÷ ${k} + ${c}.`], { fill: false });
      return Q(`Which expression means "${c} more than the product of ${k} and a number n"?`, `${k}n + ${c}`, [`${k}(n + ${c})`, `${k} + n + ${c}`, `${c}n + ${k}`],
        [`"The product of ${k} and a number n" is ${k}n.`, `"${c} more than" that means add ${c}: ${k}n + ${c}.`], { fill: false });
    }],
    [() => {
      const a = rand(2, 9), x = rand(2, 12), b = rand(3, 20), plus = Math.random() < 0.5, c = plus ? a * x + b : a * x - b;
      const opp = plus ? c + b : c - b, wrongDir = opp % a === 0 ? num(opp / a) : null;
      return Q(`Solve for x:\n${a}x ${plus ? "+" : "−"} ${b} = ${num(c)}`, num(x), [wrongDir, num(a * x), Number.isInteger(c / a) ? num(c / a) : null, num(x + 1)],
        [plus ? `Undo adding ${b} first: subtract ${b} from both sides. ${a}x = ${num(c)} − ${b} = ${a * x}.` : `Undo subtracting ${b} first: add ${b} to both sides. ${a}x = ${num(c)} + ${b} = ${a * x}.`,
          `Undo multiplying by ${a}: divide both sides by ${a}. x = ${a * x} ÷ ${a} = ${x}.`, `Check: ${a} × ${x} ${plus ? "+" : "−"} ${b} = ${num(c)}.`]);
    }],
    [() => {
      const a = rand(2, 6), k = rand(1, 9), b = rand(1, 12), c = a * k + b, op = pick([">", "<", "≥", "≤"]);
      const flip = { ">": "<", "<": ">", "≥": "≤", "≤": "≥" }[op];
      return Q(`Which inequality is the solution to ${a}x + ${b} ${op} ${c}?`, `x ${op} ${k}`, [`x ${flip} ${k}`, `x ${op} ${c - b}`, `x ${op} ${frac(c + b, a)}`],
        [`Solve it like an equation. Subtract ${b} from both sides: ${a}x ${op} ${c - b}.`, `Divide both sides by ${a}: x ${op} ${k}.`,
          `Dividing by a positive number doesn't flip the inequality sign, so the solution is x ${op} ${k}.`], { fill: false });
    }],
    [() => {
      const a = rand(2, 5), b = rand(2, 5), c = rand(1, 6), d = rand(1, 7), X = a * b + d;
      return Q(`Which expression is equivalent to ${a}(${b}x − ${c}) + ${coef(d)}?`, `${X}x − ${a * c}`,
        [`${X}x − ${c}`, `${b + d}x − ${a * c}`, `${X}x + ${a * c}`, `${a * b}x − ${a * c + d}`],
        [`Distribute the ${a} to both terms in the parentheses: ${a} × ${b}x = ${a * b}x and ${a} × ${c} = ${a * c}.`, `Now you have ${a * b}x − ${a * c} + ${coef(d)}.`,
          `Combine like terms: ${a * b}x + ${coef(d)} = ${X}x. The answer is ${X}x − ${a * c}.`], { fill: false });
    }],
    [() => {
      let x, c, a, b, d; do { x = rand(2, 9); c = rand(1, 5); a = c + rand(1, 5); b = rand(1, 15); d = a * x - b - c * x; } while (d === 0);
      const w1 = (b + d) % (a + c) === 0 ? num((b + d) / (a + c)) : null, w2 = (d - b) % (a - c) === 0 ? num((d - b) / (a - c)) : null;
      return Q(`Solve for x:\n${coef(a)} − ${b} = ${coef(c)}${signed(d)}`, num(x), [w1, w2, num(x + 1), num(-x)],
        [`Get the x terms on one side: subtract ${coef(c)} from both sides. ${coef(a - c)} − ${b} = ${num(d)}.`, `Add ${b} to both sides: ${coef(a - c)} = ${num(d + b)}.`,
          a - c === 1 ? `So x = ${x}.` : `Divide both sides by ${a - c}: x = ${num(d + b)} ÷ ${a - c} = ${x}.`]);
    }, () => {
      let m; do { m = rand(-4, 5); } while (m === 0);
      const x1 = rand(-4, 3), dx = rand(1, 4), y1 = rand(-5, 6), x2 = x1 + dx, y2 = y1 + m * dx;
      return Q(`What is the slope of the line that passes through (${num(x1)}, ${num(y1)}) and (${num(x2)}, ${num(y2)})?`, num(m),
        [frac(1, m), num(-m), num(m * dx), frac(dx, m * dx + (m > 0 ? 1 : -1))],
        [`Slope = change in y ÷ change in x.`, `Change in y: ${num(y2)} − ${par(y1)} = ${num(m * dx)}. Change in x: ${num(x2)} − ${par(x1)} = ${dx}.`, `Slope = ${num(m * dx)} ÷ ${dx} = ${num(m)}.`]);
    }, () => {
      const s = rand(3, 12) * 5, m = rand(10, 40);
      return Q(`A gym charges a $${s} sign-up fee plus $${m} per month. Which equation shows the total cost, y, for x months?`, `y = ${m}x + ${s}`,
        [`y = ${s}x + ${m}`, `y = ${m + s}x`, `y = ${m}x − ${s}`],
        [`The $${m} is charged every month, so it's multiplied by the number of months: ${m}x.`, `The $${s} fee is paid once, so it's added: ${m}x + ${s}.`, `So y = ${m}x + ${s}.`], { fill: false });
    }],
  ];

  /* ---------- Geometry ---------- */
  const UNITS = [["cm", "centimeters"], ["in", "inches"], ["ft", "feet"], ["m", "meters"]];
  G.geometry = [null,
    [() => {
      let b, h; do { b = rand(4, 16); h = rand(3, 12); } while ((b * h) % 2);
      const [u, U] = pick(UNITS), sq = (v) => `${num(v)} square ${U}`;
      return Q(`What is the area of the triangle?`, sq((b * h) / 2), [sq(b * h), sq(b + h), sq((b * h) / 2 + h), sq(2 * (b + h))],
        [`The area of a triangle is ½ × base × height.`, `The base is ${b} and the height (the dashed line) is ${h}: ½ × ${b} × ${h}.`,
          `${b} × ${h} = ${b * h}, and half of ${b * h} is ${(b * h) / 2}. The area is ${sq((b * h) / 2)}.`], { figure: figTriangle(b, h, u) });
    }, () => {
      let L, W; do { L = rand(6, 20); W = rand(3, 12); } while (L === W);
      const [u, U] = pick(UNITS), area = Math.random() < 0.5;
      if (area) {
        const sq = (v) => `${num(v)} square ${U}`;
        return Q(`A garden is shaped like a rectangle. What is its area?`, sq(L * W), [sq(2 * (L + W)), sq(L + W), sq(L * W * 2)],
          [`Area of a rectangle = length × width.`, `${L} × ${W} = ${L * W}, so the area is ${sq(L * W)}.`], { figure: figRect(L, W, u) });
      }
      const ln = (v) => `${num(v)} ${U}`;
      return Q(`A garden is shaped like a rectangle. What is its perimeter?`, ln(2 * (L + W)), [ln(L * W), ln(L + W), ln(2 * L + W)],
        [`Perimeter is the distance around the outside: add all 4 sides.`, `${L} + ${W} + ${L} + ${W} = ${2 * (L + W)}, so the perimeter is ${ln(2 * (L + W))}.`], { figure: figRect(L, W, u) });
    }],
    [() => {
      let a, b; do { a = rand(-6, 6); b = rand(-6, 6); } while (!a || !b || Math.abs(a) === Math.abs(b));
      const xAxis = Math.random() < 0.5, pt = (x, y) => `(${num(x)}, ${num(y)})`, ans = xAxis ? pt(a, -b) : pt(-a, b);
      return Q(`Point P is at ${pt(a, b)}. It is reflected across the ${xAxis ? "x" : "y"}-axis. What are the coordinates of the new point?`, ans,
        [xAxis ? pt(-a, b) : pt(a, -b), pt(-a, -b), pt(b, a)],
        xAxis ? [`Reflecting across the x-axis flips the point over the horizontal axis.`, `The x-coordinate stays ${num(a)}. The y-coordinate changes sign: ${num(b)} becomes ${num(-b)}.`, `The new point is ${ans}.`]
          : [`Reflecting across the y-axis flips the point over the vertical axis.`, `The y-coordinate stays ${num(b)}. The x-coordinate changes sign: ${num(a)} becomes ${num(-a)}.`, `The new point is ${ans}.`],
        { figure: figGrid([{ x: a, y: b, label: "P" }]), fill: false });
    }],
    [() => {
      const W = rand(8, 16), H = rand(6, 12), w = rand(2, W - 4), h = rand(2, H - 3), [u, U] = pick(UNITS.slice(2)), sq = (v) => `${num(v)} square ${U}`, A = W * H - w * h;
      return Q(`What is the area of this figure? All corners are right angles.`, sq(A), [sq(W * H), sq(2 * (W + H)), sq(W * H - w - h), sq((W - w) * (H - h))],
        [`Think of the figure as a ${W} by ${H} rectangle with a corner cut out.`, `The cut-out corner is ${W} − ${W - w} = ${w} wide and ${H} − ${H - h} = ${h} tall.`,
          `Big rectangle: ${W} × ${H} = ${W * H}. Corner: ${w} × ${h} = ${w * h}.`, `Subtract: ${W * H} − ${w * h} = ${A}. The area is ${sq(A)}.`], { figure: figL(W, H, w, h, u) });
    }],
    [() => {
      const l = rand(3, 12), w = rand(2, 8), h = rand(2, 10), [u, U] = pick(UNITS), V = l * w * h, S = 2 * (l * w + l * h + w * h);
      if (Math.random() < 0.6) {
        const cu = (v) => `${num(v)} cubic ${U}`;
        return Q(`What is the volume of the rectangular prism?`, cu(V), [cu(l + w + h), cu(S), cu(l * w), cu(V * 2)],
          [`Volume of a rectangular prism = length × width × height.`, `${l} × ${w} = ${l * w}.`, `${l * w} × ${h} = ${V}. The volume is ${cu(V)}.`], { figure: figPrism(l, w, h, u) });
      }
      const sq = (v) => `${num(v)} square ${U}`;
      return Q(`What is the surface area of the rectangular prism?`, sq(S), [sq(V), sq(l * w + l * h + w * h), sq(6 * l * w), sq(2 * (l + w + h))],
        [`A rectangular prism has 6 faces in 3 matching pairs. Find each pair and add.`,
          `Front and back: 2 × (${l} × ${h}) = ${2 * l * h}. Top and bottom: 2 × (${l} × ${w}) = ${2 * l * w}. Left and right: 2 × (${w} × ${h}) = ${2 * w * h}.`,
          `${2 * l * h} + ${2 * l * w} + ${2 * w * h} = ${S}. The surface area is ${sq(S)}.`], { figure: figPrism(l, w, h, u) });
    }],
    [() => {
      let A, B; do { A = rand(35, 80); B = rand(35, 95); } while (180 - A - B < 40); // no skinny triangles, so labels don't collide
      const C = 180 - A - B, deg = (v) => `${v}°`;
      return Q(`What is the value of x?`, deg(C), [deg(360 - A - B), deg(A + B), deg(180 - A), deg(180 - B)],
        [`The three angles in a triangle add up to 180°.`, `${A}° + ${B}° = ${A + B}°.`, `x = 180° − ${A + B}° = ${C}°.`],
        { figure: figTriAngles(A, B, `${A}°`, `${B}°`, "x") });
    }, () => {
      let a; do { a = rand(25, 155); } while (Math.abs(a - 90) < 8);
      const deg = (v) => `${v}°`;
      return Q(`The figure shows a straight line. What is the value of x?`, deg(180 - a), [deg(Math.abs(90 - a)), deg(360 - a), deg(a), deg(180 - a + 10)],
        [`Angles that make a straight line add up to 180°.`, `x + ${a}° = 180°.`, `x = 180° − ${a}° = ${180 - a}°.`], { figure: figLine(a) });
    }],
    [() => {
      const r = rand(2, 10), d = 2 * r, [u, U] = pick(UNITS), giveR = Math.random() < 0.5, area = Math.random() < 0.5;
      const A = r2(3.14 * r * r), C = r2(3.14 * d), given = giveR ? `radius of ${r} ${U}` : `diameter of ${d} ${U}`;
      const fig = figCircle(giveR ? "r" : "d", giveR ? r : d, u);
      if (area) {
        const sq = (v) => `${num(v)} square ${U}`;
        return Q(`Use 3.14 for π. What is the area of a circle with a ${given}?`, sq(A), [sq(C), sq(r2(3.14 * d * d)), sq(r2(3.14 * r * 2)), sq(r2(A * 2))],
          [`Area of a circle = π × r × r, where r is the radius.`, ...(giveR ? [] : [`The radius is half the diameter: ${d} ÷ 2 = ${r}.`]), `3.14 × ${r} × ${r} = 3.14 × ${r * r} = ${num(A)}.`, `The area is ${sq(A)}.`],
          { figure: fig });
      }
      const ln = (v) => `${num(v)} ${U}`;
      return Q(`Use 3.14 for π. What is the circumference of a circle with a ${given}?`, ln(C), [ln(A), ln(r2(3.14 * r)), ln(r2(3.14 * d * 2)), ln(r2(C + 3.14))],
        [`Circumference = π × diameter.`, ...(giveR ? [`The diameter is twice the radius: 2 × ${r} = ${d}.`] : []), `3.14 × ${d} = ${num(C)}.`, `The circumference is ${ln(C)}.`],
        { figure: fig });
    }],
    [() => {
      const [a, b, c] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [9, 12, 15], [7, 24, 25], [12, 16, 20]]), [u, U] = pick(UNITS), ln = (v) => `${num(v)} ${U}`;
      if (Math.random() < 0.5) return Q(`What is the length of the hypotenuse, the side marked "?"`, ln(c), [ln(a + b), ln(a * a + b * b), ln(Math.max(a, b) + 1), ln(c + 2)],
        [`In a right triangle, a² + b² = c², where c is the hypotenuse (the side across from the right angle).`, `${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}.`, `c = √${c * c} = ${c}.`],
        { figure: figRight(b, a, `${b} ${u}`, `${a} ${u}`, "?") });
      return Q(`What is the length of the side marked "?"`, ln(b), [ln(c - a), ln(Math.round(Math.sqrt(c * c + a * a) * 10) / 10), ln(c + a), ln(c * c - a * a)],
        [`Use a² + b² = c². The hypotenuse (across from the right angle) is ${c}.`, `${a}² + b² = ${c}², so ${a * a} + b² = ${c * c}.`, `b² = ${c * c} − ${a * a} = ${b * b}, so b = √${b * b} = ${b}.`],
        { figure: figRight(b, a, "?", `${a} ${u}`, `${c} ${u}`) });
    }],
  ];

  /* ---------- Data & probability ---------- */
  const SURVEYS = [["Favorite sport", ["Soccer", "Basketball", "Football", "Baseball"]], ["Favorite pet", ["Dogs", "Cats", "Fish", "Birds"]], ["Favorite lunch", ["Pizza", "Tacos", "Burgers", "Pasta"]]];
  function survey() {
    const [title, cats] = pick(SURVEYS), step = pick([1, 2]);
    let vals; do { vals = cats.map(() => rand(1, 10) * step); } while (new Set(vals).size < 4);
    return { title, cats, vals, step };
  }
  G.data = [null,
    [() => {
      const { title, cats, vals, step } = survey();
      let i, j; do { i = rand(0, 3); j = rand(0, 3); } while (vals[i] <= vals[j]);
      return Q(`The bar graph shows the results of a survey. How many more students chose ${cats[i]} than ${cats[j]}?`, num(vals[i] - vals[j]),
        [num(vals[i]), num(vals[j]), num(vals[i] + vals[j])],
        [`Read the bar for ${cats[i]}: ${vals[i]} students.`, `Read the bar for ${cats[j]}: ${vals[j]} students.`, `Subtract: ${vals[i]} − ${vals[j]} = ${vals[i] - vals[j]}.`],
        { figure: figBar(title, cats, vals, step) });
    }, () => {
      const { title, cats, vals, step } = survey(), sum = vals.reduce((a, b) => a + b, 0);
      return Q(`The bar graph shows the results of a survey. How many students answered the survey in all?`, num(sum),
        [num(Math.max(...vals)), num(sum - vals[3]), num(sum + step)],
        [`Each bar shows how many students chose that answer: ${cats.map((c, k) => `${c} ${vals[k]}`).join(", ")}.`, `Add them: ${vals.join(" + ")} = ${sum}.`],
        { figure: figBar(title, cats, vals, step) });
    }],
    [() => {
      const nm = name();
      let v; do { v = Array.from({ length: 5 }, () => rand(60, 100)); } while (v.reduce((a, b) => a + b, 0) % 5);
      const sum = v.reduce((a, b) => a + b, 0), mean = sum / 5, sorted = v.slice().sort((a, b) => a - b);
      return Q(`${nm}'s quiz scores are ${v.join(", ")}. What is the mean score?`, num(mean),
        [num(sorted[2]), num(Math.round((sum / 4) * 10) / 10), Number.isInteger((sorted[0] + sorted[4]) / 2) ? num((sorted[0] + sorted[4]) / 2) : null, num(mean + 2)],
        [`The mean is the total divided by how many numbers there are.`, `Add the scores: ${v.join(" + ")} = ${sum}.`, `Divide by 5 scores: ${sum} ÷ 5 = ${num(mean)}.`]);
    }],
    [() => {
      const n = pick([6, 7]);
      let v; do { v = Array.from({ length: n }, () => rand(2, 30)); } while (new Set(v).size < n - 1);
      const s = v.slice().sort((a, b) => a - b), med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
      const raw = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2, mean = Math.round((v.reduce((a, b) => a + b, 0) / n) * 10) / 10;
      return Q(`A basketball team scored these points in its last ${n} games:\n${v.join(", ")}\nWhat is the median?`, num(med),
        [num(raw), num(mean), num(s[n - 1] - s[0])],
        [`Put the numbers in order: ${s.join(", ")}.`, ...(n % 2 ? [`The median is the middle number: ${med}.`]
          : [`There are ${n} numbers, so there are two middle numbers: ${s[n / 2 - 1]} and ${s[n / 2]}.`, `The median is halfway between them: (${s[n / 2 - 1]} + ${s[n / 2]}) ÷ 2 = ${num(med)}.`])]);
    }],
    [() => {
      let c; do { c = Array.from({ length: 7 }, () => rand(0, 5)); } while (c.reduce((a, b) => a + b, 0) < 10 || c.filter((x) => x === Math.max(...c)).length > 1);
      const mx = Math.max(...c), mode = c.indexOf(mx), total = c.reduce((a, b) => a + b, 0), title = "Number of books each student read", kind = rand(0, 2);
      if (kind === 0) {
        const second = c.map((x, i) => [x, i]).filter((p) => p[1] !== mode).sort((a, b) => b[0] - a[0])[0][1];
        return Q(`The dot plot shows how many books each student in a class read last month. What is the mode?`, `${mode} books`,
          [`${mx} books`, `${second} books`, `${total} books`, `${6 - mode === mode ? 0 : 6 - mode} books`],
          [`Each dot stands for one student. The mode is the value that appears most often.`, `The tallest stack is above ${mode}, with ${mx} dots.`, `So the mode is ${mode} books.`],
          { figure: figDot(c, title), fill: false });
      }
      if (kind === 1) {
        const k = rand(1, 4), more = c.slice(k + 1).reduce((a, b) => a + b, 0), atLeast = c.slice(k).reduce((a, b) => a + b, 0);
        const parts = c.map((x, i) => [x, i]).filter((p) => p[1] > k);
        return Q(`The dot plot shows how many books each student in a class read last month. How many students read more than ${k} books?`, num(more),
          [atLeast !== more ? num(atLeast) : null, num(c[k]), num(total), num(total - more)],
          [`Each dot stands for one student. "More than ${k}" means ${k + 1} or more books.`, `Count the dots above ${parts.map((p) => p[1]).join(", ")}: ${parts.map((p) => p[0]).join(" + ")} = ${more}.`],
          { figure: figDot(c, title) });
      }
      return Q(`The dot plot shows how many books each student in a class read last month. How many students are in the class?`, num(total),
        [num(7), num(mx), num(total - mx), num(total + 1)],
        [`Each dot stands for one student, so count all the dots.`, `${c.join(" + ")} = ${total}.`], { figure: figDot(c, title) });
    }],
    [() => {
      const r = rand(2, 9), b = rand(2, 9), g = rand(2, 9), T = r + b + g, not = Math.random() < 0.4;
      const [col, cnt] = pick([["red", r], ["blue", b], ["green", g]]), want = not ? T - cnt : cnt;
      return Q(`A bag has ${r} red, ${b} blue, and ${g} green marbles. You pick one without looking. What is the probability that it is ${not ? `not ${col}` : col}?`, frac(want, T),
        [frac(want, T - want), frac(not ? cnt : T - cnt, T), "1/3", frac(1, want + 1), frac(want, T + 1)],
        [`There are ${r} + ${b} + ${g} = ${T} marbles in all.`, not ? `${T} − ${cnt} = ${want} of them are not ${col}.` : `${cnt} of them are ${col}.`,
          `Probability = favorable ÷ total = ${want}/${T}${frac(want, T) !== `${want}/${T}` ? ` = ${frac(want, T)}` : ""}.`], { fill: false });
    }, () => {
      let counts; do { counts = { red: rand(1, 4), blue: rand(1, 3), green: rand(1, 3) }; counts.yellow = 8 - counts.red - counts.blue - counts.green; } while (counts.yellow < 1);
      const sections = shuffle(Object.entries(counts).flatMap(([k, n]) => Array(n).fill(k)));
      const col = pick(Object.keys(counts)), not = Math.random() < 0.4, want = not ? 8 - counts[col] : counts[col];
      return Q(`The spinner has 8 equal sections. What is the probability that it lands on ${not ? `a color that is not ${col}` : col}?`, frac(want, 8),
        [frac(want, 8 - want), frac(not ? counts[col] : 8 - counts[col], 8), "1/4", frac(1, want + 1)],
        [`The spinner has 8 equal sections, so each section is equally likely.`, `${not ? `${8 - counts[col]} sections are not ${col}` : `${counts[col]} section${counts[col] > 1 ? "s are" : " is"} ${col}`}.`,
          `Probability = ${want}/8${frac(want, 8) !== `${want}/8` ? ` = ${frac(want, 8)}` : ""}.`], { figure: figSpinner(sections), fill: false });
    }],
    [() => {
      const mn = 5 * rand(1, 6), q1 = mn + 5 * rand(1, 3), med = q1 + 5 * rand(1, 2), q3 = med + 5 * rand(1, 3), mx = q3 + 5 * rand(1, 3);
      const lo = mn - 5, hi = mx + 5, title = "Minutes spent on homework", kind = rand(0, 2), fig = figBox([mn, q1, med, q3, mx], lo, hi, 5, title);
      if (kind === 0) return Q(`What is the interquartile range (IQR) of the data in the box plot?`, num(q3 - q1), [num(mx - mn), num(med - q1), num(q3), num(q3 - med)],
        [`The box goes from the first quartile (Q1) to the third quartile (Q3).`, `Q1 = ${q1} and Q3 = ${q3}.`, `IQR = Q3 − Q1 = ${q3} − ${q1} = ${q3 - q1}.`], { figure: fig });
      if (kind === 1) return Q(`What is the median of the data in the box plot?`, num(med), [num(Math.round((mn + mx) / 2)), num(q1), num(q3), num(mx - mn)],
        [`The line inside the box marks the median.`, `The line is at ${med}, so the median is ${med}.`], { figure: fig });
      return Q(`About what percent of the data in the box plot is greater than ${q3}?`, "25%", [], [`A box plot splits the data into 4 parts with about the same number of values in each, so each part is about 25%.`,
        `${q3} is the third quartile, the right edge of the box. Only the right whisker, from ${q3} to ${mx}, is greater than it.`, `So about 25% of the data is greater than ${q3}.`],
      { figure: fig, fixed: ["25%", "50%", "75%", "100%"] });
    }],
    [() => {
      const [desc, list] = pick([["a number greater than 4", [5, 6]], ["an even number", [2, 4, 6]], ["a 6", [6]], ["a number less than 3", [1, 2]]]);
      const f = list.length, N = pick([60, 120, 180, 240, 300, 360, 600]), ans = (N * f) / 6;
      return Q(`A number cube with sides 1 to 6 is rolled ${num(N)} times. About how many times would you expect to roll ${desc}?`, num(ans),
        [num(N / 6), num(N / 2), num(N - ans), num(N * f)],
        [`A number cube has 6 equally likely sides. ${f === 1 ? `Only ${list[0]} counts` : `${list.join(" and ").replace(/ and (?=.* and )/g, ", ")} count`}, so that's ${f} out of 6.`,
          `P = ${f}/6${frac(f, 6) !== `${f}/6` ? ` = ${frac(f, 6)}` : ""}.`, `Expected number: ${frac(f, 6)} × ${num(N)} = ${num(ans)}.`]);
    }, () => {
      const [desc, f] = pick([["a 5", 1], ["an even number", 3], ["a number less than 3", 2], ["a number greater than 2", 4]]);
      return Q(`You flip a coin and roll a number cube with sides 1 to 6. What is the probability of getting heads and ${desc}?`, frac(f, 12),
        [frac(3 + f, 6), frac(f, 8), frac(f, 6), frac(1, 2)],
        [`The coin and the cube don't affect each other, so multiply their probabilities.`, `P(heads) = 1/2 and P(${desc}) = ${frac(f, 6)}.`, `1/2 × ${frac(f, 6)} = ${frac(f, 12)}.`], { fill: false });
    }, () => {
      let s, y, N; do { s = pick([40, 50, 60, 80]); y = rand(8, s - 10); N = pick([400, 500, 600, 800, 1200]); } while ((N * y) % s);
      const opt = pick(["a later start time", "pizza on Fridays", "a longer lunch", "a new mascot"]), ans = (N * y) / s;
      return Q(`In a random survey of ${s} students, ${y} said they want ${opt}. There are ${num(N)} students at the school. About how many students would you predict want ${opt}?`, num(ans),
        [num(y * 10), num(N - ans), num(N / s + y), num(y)],
        [`In the sample, ${y} out of ${s} students said yes: ${frac(y, s)}.`, `Use the same fraction for all ${num(N)} students: ${frac(y, s)} × ${num(N)}.`, `${frac(y, s)} × ${num(N)} = ${num(ans)} students.`]);
    }],
  ];

  /* ---------- Building a run ---------- */
  // 7 stages of 6 questions. Each stage leaves out 2 topics: each regular topic sits out twice
  // (5 questions) and Geometry and Data & probability sit out once (6 questions).
  function plan() {
    for (let attempt = 0; attempt < 500; attempt++) {
      const out = ORDER.flatMap((t) => (EXTRA.includes(t) ? [t] : [t, t]));
      const sh = shuffle(out), stages = [];
      let ok = true;
      for (let s = 0; s < STAGES; s++) {
        const a = sh[2 * s], b = sh[2 * s + 1];
        if (a === b) { ok = false; break; }
        stages.push(ORDER.filter((t) => t !== a && t !== b));
      }
      if (!ok) continue;
      const list = [];
      stages.forEach((topics, s) => {
        let order, tries = 0;
        do { order = shuffle(topics); } while (list.length && order[0] === list[list.length - 1][0] && ++tries < 30);
        order.forEach((t) => list.push([t, s + 1]));
      });
      return list;
    }
    throw new Error("Couldn't build a MAP Practice run.");
  }

  function generate(topic, stage, v) {
    const list = G[topic][stage];
    if (v == null || !list[v]) v = Math.floor(Math.random() * list.length);
    for (let i = 0; i < 80; i++) {
      const q = finalize(list[v]());
      if (q) return Object.assign(q, { topic, stage, v, label: LABELS[topic] });
    }
    throw new Error(`Couldn't make a ${topic} question.`);
  }
  // A similar question: same kind, new numbers
  function twin(q) {
    let t;
    for (let i = 0; i < 40; i++) {
      t = generate(q.topic, q.stage, q.v);
      if (t.prompt + t.figure !== q.prompt + q.figure && t.answer !== q.answer) break;
    }
    t.twin = true;
    return t;
  }

  MML.mapQuestions = { TOTAL, STAGES, PER_STAGE, ORDER, LABELS, plan, generate, twin, _G: G };
})(window.MML);
