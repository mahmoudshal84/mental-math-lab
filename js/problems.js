/* Mental Math Lab: problem engine
   Every game asks this file for problems. A problem looks like:
   { prompt: "7 × 8", answer: "56", wrong: ["54","48",...], tip: "..." }
   "wrong" is ordered so the most common mistakes come first. */
window.MML = window.MML || {};
(function (MML) {
  const MINUS = "−";
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const nz = (a, b) => { let n = 0; while (n === 0) n = rand(a, b); return n; };

  function fmt(n) {
    if (typeof n === "string") return n;
    let v = Math.round(n * 10000) / 10000;
    if (Object.is(v, -0)) v = 0;
    const a = Math.abs(v);
    const s = Number.isInteger(a) && a >= 1000 ? a.toLocaleString("en-US") : String(a);
    return (v < 0 ? MINUS : "") + s;
  }
  // Wrap negatives in parentheses when they follow an operation sign
  const p = (n) => (n < 0 ? "(" + fmt(n) + ")" : fmt(n));
  const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
  const sup = (n) => String(n).split("").map((c) => SUP[c]).join("");
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  function frac(n, d) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d); n /= g; d /= g;
    return d === 1 ? fmt(n) : (n < 0 ? MINUS : "") + Math.abs(n) + "/" + d;
  }
  const money = (n) => "$" + fmt(n);
  const pct = (n) => fmt(n) + "%";
  const coef = (a, v = "x") => (a === 1 ? v : a === -1 ? MINUS + v : fmt(a) + v);
  const term = (b) => (b < 0 ? " " + MINUS + " " + fmt(-b) : " + " + fmt(b));

  const UNSUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
  function norm(s) {
    return String(s).toLowerCase().replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => UNSUP[c]).replace(/[−–]/g, "-")
      .replace(/[×*]/g, "x").replace(/[\s$,%^…]/g, "");
  }
  function numVal(s) {
    if (/^-?\d*\.?\d+$/.test(s)) return parseFloat(s);
    const m = s.match(/^(-?\d+)\/(\d+)$/);
    return m && +m[2] !== 0 ? +m[1] / +m[2] : null;
  }

  function make(prompt, answer, cands, tip) {
    const ans = fmt(answer);
    const wrong = [];
    for (const c of cands) {
      if (c === null || c === undefined || (typeof c === "number" && !isFinite(c))) continue;
      const s = fmt(c);
      if (s !== ans && !wrong.includes(s)) wrong.push(s);
    }
    if (typeof answer === "number") {
      const step = Number.isInteger(answer) ? 1 : 0.1;
      for (let k = 1; wrong.length < 4 && k < 20; k++) {
        for (const d of [k, -k]) {
          const s = fmt(Math.round((answer + d * step) * 1000) / 1000);
          if (s !== ans && !wrong.includes(s) && wrong.length < 4) wrong.push(s);
        }
      }
    }
    return { prompt, answer: ans, wrong, tip };
  }

  /* ---------- Quick facts ---------- */
  function multTip(a, b) {
    for (const f of [9, 5, 11, 4, 8, 6, 12, 7, 3, 2]) {
      if (a !== f && b !== f) continue;
      const o = a === f ? b : a;
      switch (f) {
        case 9: return `${o} × 9 = ${o} × 10 ${MINUS} ${o} = ${o * 10} ${MINUS} ${o}`;
        case 5: return `× 5 is half of × 10. Half of ${o * 10} is ${o * 5}.`;
        case 11: return `${o} × 11 = ${o} × 10 + ${o} = ${o * 10} + ${o}`;
        case 4: return `× 4 means double, then double again: ${o} → ${o * 2} → ${o * 4}`;
        case 8: return `× 8 means double three times: ${o} → ${o * 2} → ${o * 4} → ${o * 8}`;
        case 6: return `${o} × 6 = ${o} × 5 + ${o} = ${o * 5} + ${o}`;
        case 12: return `${o} × 12 = ${o} × 10 + ${o} × 2 = ${o * 10} + ${o * 2}`;
        case 7: return `${o} × 7 = ${o} × 5 + ${o} × 2 = ${o * 5} + ${o * 2}`;
        case 3: return `${o} × 3 = ${o} + ${o} + ${o}`;
        case 2: return `× 2 means double: ${o} + ${o}`;
      }
    }
    return `Break one number apart and multiply each piece.`;
  }
  function multFact(lo, hi) {
    const a = rand(lo, hi), b = rand(lo, hi);
    return make(`${a} × ${b}`, a * b, [a * (b + 1), (a + 1) * b, a * (b - 1), (a - 1) * b, a * b + 2], multTip(a, b));
  }
  function divFact() {
    const b = rand(2, 12), q = rand(2, 12);
    return make(`${b * q} ÷ ${b}`, q, [q + 1, q - 1, q + 2, q - 2], `Think multiplication: ${b} × ? = ${b * q}`);
  }
  function twoByOne() {
    let a = rand(12, 49); if (a % 10 === 0) a++;
    const b = rand(3, 9), t = a - (a % 10), o = a % 10;
    return make(`${a} × ${b}`, a * b, [t * b + o, a * b + 10, a * b - 10, a * b + b],
      `Split it: ${t} × ${b} + ${o} × ${b} = ${t * b} + ${o * b}`);
  }
  function decimals() {
    const type = rand(1, 3);
    if (type === 1) {
      const n = pick([3.6, 0.45, 7.25, 0.8, 12.5, 0.06, 4.7, 0.312]);
      const k = rand(1, 3), pw = 10 ** k;
      const ans = n * pw;
      return make(`${fmt(n)} × ${fmt(pw)}`, ans, [ans / 10, ans * 10, ans / 100],
        `× ${fmt(pw)} moves the digits ${k} place${k > 1 ? "s" : ""} to the left (bigger).`);
    }
    if (type === 2) {
      const n = pick([36, 450, 7.5, 82, 1200, 6, 93.4]);
      const k = rand(1, 3), pw = 10 ** k;
      const ans = n / pw;
      return make(`${fmt(n)} ÷ ${fmt(pw)}`, ans, [ans * 10, ans / 10, ans * 100],
        `÷ ${fmt(pw)} moves the digits ${k} place${k > 1 ? "s" : ""} to the right (smaller).`);
    }
    const d = rand(2, 9), w = rand(2, 9);
    return make(`0.${d} × ${w}`, (d * w) / 10, [d * w, (d * w) / 100, (d + w) / 10],
      `${d} × ${w} = ${d * w}. 0.${d} has one decimal place, so the answer does too.`);
  }

  /* ---------- Integers ---------- */
  function intAddSub() {
    let a, b;
    do { a = rand(-10, 10); b = nz(-10, 10); } while (a >= 0 && b > 0);
    const add = Math.random() < 0.5;
    const ans = add ? a + b : a - b;
    let tip;
    if (!add && b < 0) tip = `Subtracting a negative is adding: ${fmt(a)} ${MINUS} (${fmt(b)}) = ${fmt(a)} + ${fmt(-b)}`;
    else if (add && b < 0) tip = `Adding a negative is subtracting: ${fmt(a)} + (${fmt(b)}) = ${fmt(a)} ${MINUS} ${fmt(-b)}`;
    else tip = `Start at ${fmt(a)} on the number line and move ${Math.abs(b)} ${add === b > 0 ? "right" : "left"}.`;
    return make(`${fmt(a)} ${add ? "+" : MINUS} ${p(b)}`, ans, [-ans, add ? a - b : a + b, -(add ? a - b : a + b)], tip);
  }
  function intMulDiv() {
    let a, b;
    do { a = nz(-9, 9); b = nz(-9, 9); } while (a > 0 && b > 0);
    const tip = "Same signs give a positive. Different signs give a negative.";
    if (Math.random() < 0.5) return make(`${fmt(a)} × ${p(b)}`, a * b, [-a * b, a + b, -(a + b)], tip);
    return make(`${fmt(a * b)} ÷ ${p(a)}`, b, [-b, a * b + a, b + 1], tip);
  }
  function intMixed() {
    if (Math.random() < 0.35) {
      const a = nz(-9, 9), b = nz(-9, 9), c = nz(-12, 12);
      const ans = a * b + c;
      return make(`${fmt(a)} × ${p(b)} + ${p(c)}`, ans, [a * (b + c), -ans, a * b - c],
        `Multiply first: ${fmt(a)} × ${p(b)} = ${fmt(a * b)}. Then add ${p(c)}.`);
    }
    const a = nz(-15, 15), b = nz(-15, 15), c = nz(-15, 15);
    const o1 = Math.random() < 0.5 ? 1 : -1, o2 = Math.random() < 0.5 ? 1 : -1;
    const r1 = a + o1 * b, ans = r1 + o2 * c;
    const s = (o) => (o > 0 ? "+" : MINUS);
    return make(`${fmt(a)} ${s(o1)} ${p(b)} ${s(o2)} ${p(c)}`, ans, [r1 - o2 * c, -ans, ans + 2, ans - 2],
      `Left to right: ${fmt(a)} ${s(o1)} ${p(b)} = ${fmt(r1)}, then ${fmt(r1)} ${s(o2)} ${p(c)}.`);
  }
  function intAbsDec() {
    const type = rand(1, 3);
    if (type === 1) {
      const a = nz(-12, 12), b = nz(-12, 12);
      const ans = Math.abs(a) - Math.abs(b);
      return make(`|${fmt(a)}| ${MINUS} |${fmt(b)}|`, ans, [a - b, -ans, Math.abs(a - b)],
        `Absolute value is distance from zero, so |${fmt(a)}| = ${Math.abs(a)} and |${fmt(b)}| = ${Math.abs(b)}.`);
    }
    if (type === 2) {
      const a = -(rand(1, 9) + 0.5), b = rand(2, 9);
      const ans = a + b;
      return make(`${fmt(a)} + ${fmt(b)}`, ans, [-ans, a - b, -(a - b)],
        `Start at ${fmt(a)} and move ${b} to the right on the number line.`);
    }
    const a = -(rand(1, 4) + 0.5), b = rand(2, 6);
    const ans = a * b;
    return make(`${fmt(a)} × ${b}`, ans, [-ans, ans + 1, ans - 1],
      `${fmt(-a)} × ${b} = ${fmt(-ans)}. Different signs, so it's negative.`);
  }

  /* ---------- Fractions, decimals, percents ---------- */
  const EQ = [["1/2", "0.5", "50%"], ["1/4", "0.25", "25%"], ["3/4", "0.75", "75%"], ["1/5", "0.2", "20%"],
    ["2/5", "0.4", "40%"], ["3/5", "0.6", "60%"], ["4/5", "0.8", "80%"], ["1/10", "0.1", "10%"],
    ["3/10", "0.3", "30%"], ["7/10", "0.7", "70%"], ["1/8", "0.125", "12.5%"], ["3/8", "0.375", "37.5%"],
    ["5/8", "0.625", "62.5%"], ["7/8", "0.875", "87.5%"], ["1/3", "0.333…", "33⅓%"], ["2/3", "0.666…", "66⅔%"],
    ["1/20", "0.05", "5%"], ["3/20", "0.15", "15%"]];
  const EQ_NAMES = ["a fraction", "a decimal", "a percent"];
  function equivalents() {
    const row = pick(EQ);
    const from = rand(0, 2); let to = rand(0, 2); while (to === from) to = rand(0, 2);
    const cands = [];
    if (from === 0 && to > 0) { // the "digits glued together" mistake, like 1/4 → 0.14
      const [n, d] = row[0].split("/");
      if (d.length === 1) cands.push(to === 1 ? "0." + n + d : n + d + "%");
    }
    if (row[0] === "1/20") cands.push(to === 1 ? "0.5" : to === 2 ? "50%" : "1/2");
    const others = EQ.filter((r) => r !== row).sort(() => Math.random() - 0.5);
    for (const r of others.slice(0, 4)) cands.push(r[to]);
    return make(`${row[from]} as ${EQ_NAMES[to]}`, row[to], cands, `${row[0]} = ${row[1]} = ${row[2]}`);
  }
  function percentOf() {
    const opts = [
      [10, () => 10 * rand(2, 90), "10% means divide by 10."],
      [20, () => 5 * rand(4, 40), "20% is 10% doubled."],
      [25, () => 4 * rand(3, 50), "25% means divide by 4."],
      [50, () => 2 * rand(6, 150), "50% means half."],
      [75, () => 4 * rand(3, 30), "75% is 3 × 25%, or the whole minus 25%."],
      [5, () => 20 * rand(2, 20), "5% is half of 10%."],
      [1, () => 100 * rand(2, 30), "1% means divide by 100."],
      [30, () => 10 * rand(2, 40), "30% is 3 × 10%."],
      [40, () => 10 * rand(2, 40), "40% is 4 × 10%."],
    ];
    const [pc, gen, tip] = pick(opts);
    const n = gen(), ans = (n * pc) / 100;
    return make(`${pc}% of ${fmt(n)}`, ans, [n - ans, ans * 10, ans * 2, ans / 2, n / 10], tip);
  }
  function percentWord() {
    const type = rand(1, 3);
    if (type === 1) {
      let price, pc;
      do { price = pick([20, 40, 60, 80, 120, 200, 48, 36, 150]); pc = pick([10, 20, 25, 50]); } while ((price * pc) % 100);
      const d = (price * pc) / 100;
      return make(`${money(price)} shirt, ${pc}% off. Sale price?`, money(price - d),
        [money(d), money(price + d), money(price - pc), money(price - d - 5)],
        `${pc}% of ${money(price)} is ${money(d)}. Subtract it: ${money(price)} ${MINUS} ${money(d)}.`);
    }
    if (type === 2) {
      let bill, pc;
      do { bill = pick([20, 30, 40, 60, 80, 50, 120]); pc = pick([10, 15, 20]); } while ((bill * pc) % 100);
      const t = (bill * pc) / 100;
      return make(`${money(bill)} meal plus a ${pc}% tip. Total?`, money(bill + t),
        [money(t), money(bill + pc), money(bill - t), money(bill + t + 2)],
        `${pc}% of ${money(bill)} is ${money(t)}. Add it: ${money(bill)} + ${money(t)}.`);
    }
    let base, pc;
    do { base = pick([20, 40, 50, 80, 200, 25, 60]); pc = pick([10, 20, 25, 50]); } while ((base * pc) % 100);
    const up = Math.random() < 0.6;
    const change = (base * pc) / 100, next = up ? base + change : base - change;
    const cands = [pct(change), pct(Math.round((change / next) * 1000) / 10)];
    for (const o of [10, 20, 25, 50, 75]) cands.push(pct(o));
    return make(`${money(base)} → ${money(next)}. Percent ${up ? "increase" : "decrease"}?`, pct(pc), cands,
      `Percent change = change ÷ original = ${fmt(change)} ÷ ${fmt(base)} = ${pc}%`);
  }
  function fractionOps() {
    const type = rand(1, 4);
    if (type === 1) {
      const [d1, d2] = pick([[2, 4], [3, 6], [2, 3], [4, 8], [2, 5], [3, 4], [2, 6]]);
      const n1 = rand(1, d1 - 1), n2 = rand(1, d2 - 1);
      const ansN = n1 * d2 + n2 * d1, ansD = d1 * d2;
      return make(`${n1}/${d1} + ${n2}/${d2}`, frac(ansN, ansD),
        [frac(n1 + n2, d1 + d2), frac(n1 + n2, Math.max(d1, d2)), frac(ansN + 1, ansD), frac(n1 * n2, d1 * d2)],
        `Make the bottoms match first, then add the tops.`);
    }
    if (type === 2) {
      const d = rand(2, 6), n = rand(1, d - 1), w = d * rand(2, 8);
      const ans = (w / d) * n;
      return make(`${n}/${d} of ${w}`, ans, [w / d, (w * d) / n, w - ans, ans + n],
        `${w} ÷ ${d} = ${w / d}, then × ${n} = ${ans}`);
    }
    const simple = (maxD) => { let n, d; do { d = rand(2, maxD); n = rand(1, d - 1); } while (gcd(n, d) !== 1); return [n, d]; };
    if (type === 3) {
      const [a, b] = simple(8), [c, d] = simple(8);
      return make(`${a}/${b} × ${c}/${d}`, frac(a * c, b * d),
        [frac(a + c, b + d), frac(a * d, b * c), frac(a * c, b + d), frac(a * c + 1, b * d)],
        `Multiply straight across: top × top, bottom × bottom.`);
    }
    const [a, b] = simple(8), [c, d] = simple(5);
    return make(`${a}/${b} ÷ ${c}/${d}`, frac(a * d, b * c),
      [frac(a * c, b * d), frac(b * c, a * d), frac(a * d + 1, b * c), frac(a + d, b + c)],
      `Keep, change, flip: ${a}/${b} × ${d}/${c}`);
  }

  /* ---------- Ratios ---------- */
  function unitRate() {
    const type = rand(1, 3);
    if (type === 1) {
      const r = rand(2, 12), c = rand(2, 9), t = r * c;
      return make(`${money(t)} for ${c} notebooks. Cost of 1?`, money(r),
        [money(t - c), money(t * c), money(r + 1), money(r - 1)], `Divide: ${money(t)} ÷ ${c} = ${money(r)} each.`);
    }
    if (type === 2) {
      const r = 5 * rand(6, 14), c = rand(2, 5), t = r * c;
      return make(`${t} miles in ${c} hours. Miles per hour?`, r, [t - c, r + 5, r - 5, t * c],
        `Divide the miles by the hours: ${t} ÷ ${c} = ${r}.`);
    }
    const r = rand(20, 60), c = rand(2, 5), t = r * c;
    return make(`${t} words in ${c} minutes. Words per minute?`, r, [t - c, r + 10, r - 10],
      `Divide: ${t} ÷ ${c} = ${r}.`);
  }
  function proportion() {
    let a, b; do { a = rand(1, 8); b = rand(2, 9); } while (a >= b || gcd(a, b) !== 1);
    const k = rand(2, 6), d = b * k;
    const colon = Math.random() < 0.5;
    const f = (x, y) => (colon ? `${x} : ${y}` : `${x}/${y}`);
    if (Math.random() < 0.7) {
      return make(`${f(a, b)} = ${f("?", d)}`, a * k, [a + (d - b), a * k + a, d - b, a * k - 1],
        `${b} × ${k} = ${d}, so multiply the other part by ${k} too: ${a} × ${k}.`);
    }
    return make(`${f(a, b)} = ${f(a * k, "?")}`, d, [b + (a * k - a), d + b, d - 1],
      `${a} × ${k} = ${a * k}, so multiply the other part by ${k} too: ${b} × ${k}.`);
  }
  function ratioApply() {
    const type = rand(1, 3);
    if (type === 1) {
      let a, b; do { a = rand(1, 5); b = rand(1, 5); } while (a === b || gcd(a, b) !== 1);
      const k = rand(2, 12), total = (a + b) * k;
      return make(`Split ${total} in the ratio ${a} : ${b}. Bigger share?`, Math.max(a, b) * k,
        [Math.min(a, b) * k, k, total / 2, Math.max(a, b) * k + k],
        `${a} + ${b} = ${a + b} parts. Each part is ${total} ÷ ${a + b} = ${k}.`);
    }
    if (type === 2) {
      const s = rand(2, 12), c = rand(3, 9);
      return make(`Map: 1 cm = ${s} km. ${c} cm = ? km`, s * c, [s + c, s * c + s, s * c - s],
        `Every centimeter is ${s} km, so ${c} × ${s}.`);
    }
    const a = rand(2, 4), b = 12 * rand(1, 2), k = rand(2, 4);
    return make(`${a} cups of flour makes ${b} cookies. Cups for ${b * k} cookies?`, a * k,
      [a + k, a * k + a, (b * k) / a, a * k - 1], `${b * k} is ${k} times ${b}, so use ${k} times the flour.`);
  }

  /* ---------- Exponents & roots ---------- */
  function powers() {
    if (Math.random() < 0.6) {
      const n = rand(2, 15);
      return make(`${n}${sup(2)}`, n * n, [n * 2, (n + 1) ** 2, (n - 1) ** 2, n * n + n],
        `${n}${sup(2)} means ${n} × ${n}, not ${n} × 2.`);
    }
    const [b, e] = pick([[2, 3], [2, 4], [2, 5], [2, 6], [3, 3], [3, 4], [4, 3], [5, 3], [10, 3], [10, 4], [10, 5]]);
    return make(`${b}${sup(e)}`, b ** e, [b * e, e ** b, b ** (e - 1), b ** (e + 1)],
      `${b}${sup(e)} means ${Array(e).fill(b).join(" × ")}`);
  }
  function roots() {
    const type = rand(1, 3);
    if (type === 1) {
      const n = rand(2, 15);
      return make(`√${n * n}`, n, [(n * n) / 2, n + 1, n - 1, n * 2],
        `What number times itself makes ${n * n}? ${n} × ${n} = ${n * n}.`);
    }
    const n = pick([2, 3, 4, 5, 10]);
    if (type === 2) {
      return make(`∛${fmt(n ** 3)}`, n, [(n ** 3) / 3, n + 1, n * n, n - 1],
        `What number used three times makes ${fmt(n ** 3)}? ${n} × ${n} × ${n}.`);
    }
    return make(`${n}${sup(3)}`, n ** 3, [n * 3, n * n, (n + 1) ** 3], `${n}${sup(3)} = ${n} × ${n} × ${n}`);
  }
  function expRules() {
    const base = Math.random() < 0.7 ? "x" : "10";
    const v = (e) => base + sup(e);
    const type = rand(1, 3);
    const a = rand(2, 9), b = rand(2, 6);
    if (type === 1) return make(`${v(a)} · ${v(b)}`, v(a + b), [v(a * b), v(a + b + 1), v(Math.abs(a - b) || 1), v(a + b - 1)],
      `Same base, multiplying: add the exponents. ${a} + ${b} = ${a + b}.`);
    if (type === 2) {
      const top = a + b;
      return make(`${v(top)} ÷ ${v(b)}`, v(a), [v(top + b), v(top * b), Number.isInteger(top / b) ? v(top / b) : v(a + 1), v(a + 1), v(a - 1)],
        `Same base, dividing: subtract the exponents. ${top} ${MINUS} ${b} = ${a}.`);
    }
    const c = rand(2, 5);
    return make(`(${v(b)})${sup(c)}`, v(b * c), [v(b + c), v(b ** c), v(b * c + 1), v(b * c - 1)],
      `Power of a power: multiply the exponents. ${b} × ${c} = ${b * c}.`);
  }
  function expAdvanced() {
    const type = rand(1, 4);
    if (type === 1) {
      const [b, n] = pick([[2, 1], [2, 2], [2, 3], [2, 4], [3, 1], [3, 2], [4, 2], [5, 2], [10, 2], [10, 3]]);
      const v = b ** n;
      return make(`${b}${sup(-n)}`, "1/" + fmt(v), [MINUS + fmt(v), MINUS + fmt(b * n), "1/" + fmt(b * n), fmt(v), "1/" + fmt(v * b), MINUS + "1/" + fmt(v)],
        `A negative exponent means "one over": ${b}${sup(-n)} = 1/${b}${sup(n)} = 1/${fmt(v)}`);
    }
    if (type === 2) {
      const b = rand(2, 15);
      return make(`${b}${sup(0)}`, 1, [0, b, "1/" + b], `Anything (except 0) to the power of 0 is 1.`);
    }
    const m = pick([1.2, 2.5, 3.4, 4.2, 6.05, 7.8, 9.1, 5.6]);
    if (type === 3) {
      const e = rand(2, 5);
      const ans = m * 10 ** e;
      const neg = Math.random() < 0.3;
      if (neg) {
        const e2 = rand(1, 3), v = m / 10 ** e2;
        return make(`${fmt(m)} × 10${sup(-e2)}`, v, [v * 10, v / 10, MINUS + fmt(m * 10 ** e2)],
          `10${sup(-e2)} moves the decimal ${e2} place${e2 > 1 ? "s" : ""} left.`);
      }
      return make(`${fmt(m)} × 10${sup(e)}`, ans, [ans * 10, ans / 10, m * 10 * e],
        `10${sup(e)} moves the decimal ${e} places right.`);
    }
    const e = rand(2, 5), num = Math.round(m * 10 ** e);
    const sci = (mm, ee) => `${fmt(mm)} × 10${sup(ee)}`;
    return make(`${fmt(num)} in scientific notation`, sci(m, e),
      [sci(m, e + 1), sci(m, e - 1), sci(Math.round(m * 100) / 10, e - 1)],
      `Move the decimal until one digit is left of it. You moved it ${e} places, so the exponent is ${e}.`);
  }

  /* ---------- Equations ---------- */
  function oneStepAdd() {
    const x = rand(1, 20), a = rand(2, 15);
    if (Math.random() < 0.5) return make(`x + ${a} = ${x + a}`, x, [x + 2 * a, a, -x], `Undo + ${a} by subtracting ${a} from both sides.`);
    return make(`x ${MINUS} ${a} = ${x}`, x + a, [x - a, a, x], `Undo ${MINUS} ${a} by adding ${a} to both sides.`);
  }
  function oneStepMul() {
    const x = rand(2, 12), a = rand(2, 9);
    if (Math.random() < 0.6) return make(`${a}x = ${a * x}`, x, [a * x - a, a * a * x, x + 1], `Undo × ${a} by dividing both sides by ${a}.`);
    return make(`x ÷ ${a} = ${x}`, a * x, [x - a, x + a, a * x + a], `Undo ÷ ${a} by multiplying both sides by ${a}.`);
  }
  function twoStep() {
    const a = rand(2, 9), x = rand(1, 12), b = rand(1, 15);
    const type = rand(1, 3);
    if (type === 1) {
      const c = a * x + b;
      return make(`${a}x + ${b} = ${c}`, x, [c - b, (c + b) % a === 0 ? (c + b) / a : x + 2, x + 1, x - 1],
        `Undo in reverse: subtract ${b}, then divide by ${a}.`);
    }
    if (type === 2) {
      const c = a * x - b;
      return make(`${a}x ${MINUS} ${b} = ${fmt(c)}`, x, [c + b, (c - b) % a === 0 ? (c - b) / a : x - 2, x + 1, x - 1],
        `Undo in reverse: add ${b}, then divide by ${a}.`);
    }
    const q = rand(2, 9), X = a * q, c = q + b;
    return make(`x ÷ ${a} + ${b} = ${c}`, X, [c - b, (c - b) + a, X + a, c * a], `Subtract ${b} first, then multiply by ${a}.`);
  }
  function equationsAdv() {
    const type = rand(1, 3);
    if (type === 1) {
      const a = rand(2, 6), b = rand(2, 6), x = rand(2, 9), c = (a + b) * x;
      return make(`${a}x + ${b}x = ${c}`, x, [c - a - b, (a * b) && c % (a * b) === 0 ? c / (a * b) : x + 1, x - 1],
        `Combine like terms: ${a}x + ${b}x = ${a + b}x. Then divide by ${a + b}.`);
    }
    if (type === 2) {
      const a = rand(2, 7), x = nz(-6, 9), b = nz(-12, 12), c = -a * x + b;
      return make(`${coef(-a)}${term(b)} = ${fmt(c)}`, x, [-x, x + 1, c - b],
        `Undo ${b < 0 ? MINUS + " " + fmt(-b) : "+ " + b} first, then divide by ${fmt(-a)}. Watch the sign!`);
    }
    const x = rand(1, 9), c = rand(1, 5), a = rand(c + 1, 9), b = nz(-10, 10);
    const d = a * x + b - c * x;
    return make(`${coef(a)}${term(b)} = ${coef(c)}${term(d)}`, x, [-x, x + 1, x - 1, ((d - b) % (a + c) === 0) ? (d - b) / (a + c) : x + 2],
      `Get the x's on one side: subtract ${coef(c)} from both sides first.`);
  }

   /* ===== Geometry and Data & probability (paste this whole block into js/problems.js) ===== */
  /* ---------- Geometry ---------- */
  function geoRect() {
    let l, w; do { l = rand(3, 15); w = rand(2, 12); } while (l === w);
    if (Math.random() < 0.5)
      return make(`Rectangle ${l} by ${w}. Area?`, l * w, [2 * (l + w), l + w, l * w + l], `Area = length × width: ${l} × ${w} = ${l * w}.`);
    return make(`Rectangle ${l} by ${w}. Perimeter?`, 2 * (l + w), [l * w, l + w, 2 * l + w], `Perimeter adds all 4 sides: ${l} + ${w} + ${l} + ${w} = ${2 * (l + w)}.`);
  }
  function geoTriPara() {
    const type = rand(1, 3);
    if (type === 1) {
      let b, h; do { b = rand(3, 16); h = rand(2, 12); } while ((b * h) % 2);
      return make(`Triangle: base ${b}, height ${h}. Area?`, (b * h) / 2, [b * h, b + h, (b * h) / 2 + b],
        `Triangle area is half of base × height: ${b} × ${h} = ${b * h}, and half is ${(b * h) / 2}.`);
    }
    if (type === 2) {
      const b = rand(3, 14), h = rand(2, 11);
      return make(`Parallelogram: base ${b}, height ${h}. Area?`, b * h, [(b * h) / 2, 2 * (b + h), b + h],
        `Parallelogram area = base × height: ${b} × ${h} = ${b * h}.`);
    }
    const w = rand(3, 9), l = rand(4, 12), A = l * w;
    return make(`Rectangle: area ${A}, width ${w}. Length?`, l, [A - w, A * w, A / 2], `Length × ${w} = ${A}, so length = ${A} ÷ ${w} = ${l}.`);
  }
  function geoAngles() {
    const type = rand(1, 4);
    if (type === 1) {
      let a, b; do { a = rand(25, 95); b = rand(25, 95); } while (a + b > 155);
      return make(`Triangle angles: ${a}°, ${b}°, x°. x?`, 180 - a - b, [360 - a - b, a + b, Math.abs(90 - a)],
        `The angles in a triangle add to 180°: 180 ${MINUS} ${a} ${MINUS} ${b} = ${180 - a - b}.`);
    }
    if (type === 2) {
      let a; do { a = rand(20, 160); } while (Math.abs(a - 90) < 6);
      return make(`Straight line: ${a}° and x°. x?`, 180 - a, [Math.abs(90 - a), 360 - a, a],
        `Angles on a straight line add to 180°: 180 ${MINUS} ${a} = ${180 - a}.`);
    }
    if (type === 3) {
      const a = rand(12, 78);
      return make(`Right angle split: ${a}° and x°. x?`, 90 - a, [180 - a, a, 100 - a],
        `A right angle is 90°, so the two parts add to 90: 90 ${MINUS} ${a} = ${90 - a}.`);
    }
    let a; do { a = rand(25, 155); } while (Math.abs(a - 90) < 6);
    return make(`Vertical angles: one is ${a}°. The other?`, a, [180 - a, 360 - a, Math.abs(90 - a)],
      `Vertical angles (across from each other where two lines cross) are equal: ${a}°.`);
  }
  function geoSolids() {
    const type = rand(1, 4);
    if (type === 1) {
      const l = rand(2, 9), w = rand(2, 6), h = rand(2, 6);
      return make(`Box ${l} × ${w} × ${h}. Volume?`, l * w * h, [l + w + h, 2 * (l * w + l * h + w * h), l * w, l * w * h + l * w],
        `Volume = length × width × height: ${l} × ${w} = ${l * w}, then × ${h} = ${l * w * h}.`);
    }
    if (type === 2) {
      const r = rand(1, 10), A = Math.round(3.14 * r * r * 100) / 100;
      return make(`Circle area, r = ${r} (π ≈ 3.14)?`, A, [Math.round(6.28 * r * 100) / 100, Math.round(3.14 * r * 100) / 100, Math.round(3.14 * 4 * r * r * 100) / 100],
        `Area = π × r × r: 3.14 × ${r * r} = ${fmt(A)}.`);
    }
    if (type === 3) {
      const d = rand(2, 10), C = Math.round(3.14 * d * 100) / 100;
      return make(`Circumference, d = ${d} (π ≈ 3.14)?`, C, [Math.round(6.28 * d * 100) / 100, Math.round(3.14 * (d / 2) * (d / 2) * 100) / 100, Math.round(3.14 * d * d * 100) / 100],
        `Circumference = π × diameter: 3.14 × ${d} = ${fmt(C)}.`);
    }
    const [a, b, c] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20]]);
    if (Math.random() < 0.5)
      return make(`Legs ${a} and ${b}. Hypotenuse?`, c, [a + b, a * a + b * b, c + 1],
        `a² + b² = c²: ${a * a} + ${b * b} = ${c * c}, and √${c * c} = ${c}.`);
    return make(`Leg ${a}, hypotenuse ${c}. Other leg?`, b, [c - a, c + a, c * c - a * a],
      `a² + b² = c²: ${c * c} ${MINUS} ${a * a} = ${b * b}, and √${b * b} = ${b}.`);
  }

  /* ---------- Data & probability ---------- */
  const dataSort = (v) => v.slice().sort((a, b) => a - b);
  function dataMMR() {
    const type = rand(1, 3);
    if (type === 1) {
      const n = pick([5, 5, 7]);
      let v; do { v = Array.from({ length: n }, () => rand(1, 20)); } while (v[(n - 1) / 2] === dataSort(v)[(n - 1) / 2]);
      const s = dataSort(v), med = s[(n - 1) / 2];
      return make(`Median of ${v.join(", ")}`, med, [v[(n - 1) / 2], s[n - 1] - s[0], s[n - 1]],
        `Put them in order: ${s.join(", ")}. The middle number is ${med}.`);
    }
    if (type === 2) {
      let v, m; do { m = rand(1, 15); v = [m, m, ...Array.from({ length: 3 }, () => rand(1, 15))]; } while (new Set(v).size !== 4);
      v.sort(() => Math.random() - 0.5);
      const s = dataSort(v), others = s.filter((x) => x !== m);
      return make(`Mode of ${v.join(", ")}`, m, [...others, s[2]],
        `The mode is the number that shows up most often. ${m} appears twice.`);
    }
    let v; do { v = Array.from({ length: 5 }, () => rand(2, 30)); } while (new Set(v).size < 5);
    const s = dataSort(v);
    return make(`Range of ${v.join(", ")}`, s[4] - s[0], [s[4], s[4] + s[0], s[2]],
      `Range = greatest ${MINUS} least: ${s[4]} ${MINUS} ${s[0]} = ${s[4] - s[0]}.`);
  }
  function dataMean() {
    if (Math.random() < 0.7) {
      const n = pick([3, 4, 4, 5]);
      let v; do { v = Array.from({ length: n }, () => rand(1, 20)); } while (v.reduce((a, b) => a + b, 0) % n);
      const sum = v.reduce((a, b) => a + b, 0), m = sum / n, s = dataSort(v);
      const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
      return make(`Mean of ${v.join(", ")}`, m, [sum, med, m + 1],
        `Add them: ${v.join(" + ")} = ${sum}. Divide by ${n}: ${sum} ÷ ${n} = ${m}.`);
    }
    const m = rand(4, 12), a = rand(1, m + 3), b = rand(1, m + 3), x = 3 * m - a - b;
    if (x < 1) return dataMean();
    return make(`Mean of ${a}, ${b}, and x is ${m}. x?`, x, [m, 3 * m, 2 * m - a - b > 0 ? 2 * m - a - b : x + 3],
      `The 3 numbers must add to 3 × ${m} = ${3 * m}. So x = ${3 * m} ${MINUS} ${a} ${MINUS} ${b} = ${x}.`);
  }
  function dataProb() {
    const type = rand(1, 4);
    if (type === 1) {
      let r, b; do { r = rand(1, 9); b = rand(1, 9); } while (r === b);
      const T = r + b;
      return make(`Bag: ${r} red, ${b} blue. P(red)?`, frac(r, T), [frac(r, b), frac(b, T), frac(1, T), frac(r, T + 1)],
        `${r} of the ${T} marbles are red, so P(red) = ${r}/${T}.`);
    }
    if (type === 2) {
      let r, b; do { r = rand(1, 8); b = rand(1, 8); } while (r === b);
      const T = r + b;
      return make(`Bag: ${r} red, ${b} blue. P(not red)?`, frac(b, T), [frac(r, T), frac(b, r), frac(1, T), frac(b, T + 1)],
        `Not red means blue: ${b} of the ${T} marbles, so P = ${b}/${T}.`);
    }
    if (type === 3) {
      const [desc, f] = pick([["even", 3], ["a 5", 1], ["less than 3", 2], ["more than 2", 4], ["odd", 3], ["a 1 or 6", 2]]);
      return make(`Number cube: P(${desc})?`, frac(f, 6), [f < 6 ? frac(f, 6 - f) : null, frac(1, 6) === frac(f, 6) ? frac(1, 2) : frac(1, 6), frac(f, 12), frac(6 - f, 6)],
        `${f} of the 6 sides count, so P = ${f}/6${frac(f, 6) !== `${f}/6` ? ` = ${frac(f, 6)}` : ""}.`);
    }
    let k; const n = pick([4, 5, 8, 10]); do { k = rand(1, n - 1); } while (frac(k, n) === frac(n - k, n));
    return make(`Spinner, ${n} parts, ${k} blue. P(blue)?`, frac(k, n), [frac(k, n - k), frac(n - k, n), frac(1, n), frac(k, n + 1)],
      `${k} of the ${n} equal parts are blue, so P = ${k}/${n}${frac(k, n) !== `${k}/${n}` ? ` = ${frac(k, n)}` : ""}.`);
  }
  function dataPredict() {
    const type = rand(1, 4);
    if (type === 1) {
      const [desc, f] = pick([["5s", 1], ["evens", 3], ["6s", 1], ["1s or 2s", 2]]), N = 6 * pick([5, 10, 20, 30, 50]);
      return make(`${N} rolls of a cube. How many ${desc}?`, (N * f) / 6, [N / 6 === (N * f) / 6 ? N / 2 : N / 6, N - (N * f) / 6, N / f],
        `P = ${f}/6, and ${f}/6 of ${N} is ${(N * f) / 6}.`);
    }
    if (type === 2) {
      const [desc, f] = pick([["a 6", 1], ["an even", 3], ["a 1 or 2", 2]]);
      return make(`Coin + cube: P(heads and ${desc})?`, frac(f, 12), [frac(f, 8), frac(f, 6), frac(1, 2), frac(f + 1, 12)],
        `Multiply the chances: 1/2 × ${frac(f, 6)} = ${frac(f, 12)}.`);
    }
    if (type === 3) {
      const n = pick([2, 3]);
      return make(`Flip ${n} coins. P(all heads)?`, frac(1, 2 ** n), n === 2 ? ["1/2", "1/3", "3/4"] : ["1/2", "1/3", "1/6", "3/8"],
        `Each coin is 1/2, so multiply: ${Array(n).fill("1/2").join(" × ")} = ${frac(1, 2 ** n)}.`);
    }
    let s, y, N; do { s = pick([10, 20, 40, 50]); y = rand(2, s - 2); N = pick([100, 200, 400, 500]); } while ((N * y) % s);
    return make(`${y} of ${s} said yes. How many of ${N}?`, (N * y) / s, [y * 10, N - (N * y) / s, N / s + y],
      `${y}/${s} said yes. ${y}/${s} of ${N} = ${(N * y) / s}.`);
  }
   
  /* ---------- Strand list ---------- */
  MML.problems = {
        order: ["facts", "integers", "fdp", "ratios", "exponents", "equations", "geometry", "data"],
    strands: {
      facts: { name: "Quick facts", blurb: "Times tables, division, decimals", levels: [
        { name: "Times tables to 9", gen: () => multFact(2, 9) },
        { name: "Tables to 12 and division", gen: () => (Math.random() < 0.5 ? multFact(2, 12) : divFact()) },
        { name: "Two-digit times one-digit", gen: twoByOne },
        { name: "Decimals and powers of 10", gen: decimals }] },
      integers: { name: "Integers", blurb: "Working with negative numbers", levels: [
        { name: "Adding and subtracting", gen: intAddSub },
        { name: "Multiplying and dividing", gen: intMulDiv },
        { name: "Mixed, three numbers", gen: intMixed },
        { name: "Absolute value and decimals", gen: intAbsDec }] },
      fdp: { name: "Fractions & percents", blurb: "Converting, percents, fraction math", levels: [
        { name: "Fraction, decimal, percent", gen: equivalents },
        { name: "Percent of a number", gen: percentOf },
        { name: "Sales, tips, and change", gen: percentWord },
        { name: "Fraction operations", gen: fractionOps }] },
      ratios: { name: "Ratios", blurb: "Unit rates and proportions", levels: [
        { name: "Unit rates", gen: unitRate },
        { name: "Missing values", gen: proportion },
        { name: "Sharing and scaling", gen: ratioApply }] },
      exponents: { name: "Exponents & roots", blurb: "Powers, roots, scientific notation", levels: [
        { name: "Squares and powers", gen: powers },
        { name: "Square and cube roots", gen: roots },
        { name: "Exponent rules", gen: expRules },
        { name: "Negative exponents and sci. notation", gen: expAdvanced }] },
      equations: { name: "Equations", blurb: "Solve for x in your head", levels: [
        { name: "One step: add and subtract", gen: oneStepAdd },
        { name: "One step: multiply and divide", gen: oneStepMul },
        { name: "Two steps", gen: twoStep },
                { name: "Negatives and x on both sides", gen: equationsAdv }] },
      geometry: { name: "Geometry", blurb: "Area, angles, volume, circles", levels: [
        { name: "Rectangles: area and perimeter", gen: geoRect },
        { name: "Triangles and parallelograms", gen: geoTriPara },
        { name: "Angles", gen: geoAngles },
        { name: "Volume, circles, and right triangles", gen: geoSolids }] },
      data: { name: "Data & probability", blurb: "Mean, median, and chances", levels: [
        { name: "Median, mode, and range", gen: dataMMR },
        { name: "Mean", gen: dataMean },
        { name: "Probability", gen: dataProb },
        { name: "Predictions and combined chances", gen: dataPredict }] },
    },
    /* Checking typed answers: "3/4", "-5", "x^7", "4.2 x 10^3", "$60", "37.5%" all work */
    matches(typed, answer) {
      const t = norm(typed), a = norm(answer);
      if (!t) return false;
      if (t === a) return true;
      if (t.includes("/") !== a.includes("/")) return false;
      const tv = numVal(t), av = numVal(a);
      return tv !== null && av !== null && Math.abs(tv - av) < 1e-9;
    },
    typable: (answer) => !/[⅓⅔…]/.test(answer),
    numVal: (s) => numVal(norm(s)),
    generate(strandId, level) {
      const s = this.strands[strandId];
      const lv = s.levels[Math.max(0, Math.min(level, s.levels.length) - 1)];
      return lv.gen();
    },
    fmt, frac, sup, rand, pick, gcd, MINUS,
  };
})(window.MML);

/* Arcade mixes: every student on a board gets the same kinds of problems.
   Each entry is [topic, level]. Problems start from the front of the list and
   the pool grows as the run goes on, so arcade runs get harder over time. */
window.MML.problems.mixes = {
  6: [["facts", 1], ["integers", 1], ["fdp", 1], ["geometry", 1], ["equations", 1], ["data", 1], ["facts", 2], ["ratios", 1], ["exponents", 1],
      ["fdp", 2], ["geometry", 2], ["equations", 2], ["data", 2], ["facts", 3], ["ratios", 2], ["facts", 4]],
  7: [["facts", 2], ["integers", 1], ["fdp", 2], ["geometry", 1], ["equations", 2], ["integers", 2], ["data", 1], ["ratios", 2], ["facts", 3],
      ["exponents", 1], ["geometry", 2], ["fdp", 3], ["data", 2], ["integers", 3], ["equations", 3], ["geometry", 3], ["data", 3], ["fdp", 4], ["ratios", 3]],
  8: [["facts", 3], ["integers", 2], ["exponents", 1], ["geometry", 2], ["equations", 2], ["fdp", 2], ["data", 2], ["exponents", 2], ["integers", 3],
      ["geometry", 3], ["equations", 3], ["data", 3], ["fdp", 3], ["exponents", 3], ["integers", 4], ["geometry", 4], ["equations", 4], ["data", 4], ["exponents", 4], ["fdp", 4]],
  school: [["facts", 1], ["integers", 1], ["facts", 2], ["fdp", 1], ["geometry", 1], ["equations", 1], ["data", 1], ["exponents", 1], ["fdp", 2], ["integers", 2]],
};
