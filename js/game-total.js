/* Mental Math Lab: Running Total
   Start with a number, then follow the steps in your head. At the end, type your number. */
window.MML = window.MML || {};
MML.games = MML.games || {};
(function () {
  const P = () => MML.problems;
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const f = (n) => P().fmt(n);
  const par = (n) => (n < 0 ? `(${f(n)})` : f(n));
  const round = (v) => Math.round(v * 10000) / 10000;
  const dp = (v) => { const s = String(round(v)); return s.includes(".") ? s.split(".")[1].length : 0; };

  /* Step makers: each takes the current value and returns { text, val } or null if it doesn't fit */
  const add = (lo, hi) => () => { const n = rand(lo, hi); return { text: `+ ${n}`, val: (v) => v + n }; };
  const sub = (lo, hi) => () => { const n = rand(lo, hi); return { text: `${P().MINUS} ${n}`, val: (v) => v - n }; };
  const addNeg = (lo, hi) => () => { const n = -rand(lo, hi); return Math.random() < 0.5
    ? { text: `+ (${f(n)})`, val: (v) => v + n } : { text: `${P().MINUS} (${f(n)})`, val: (v) => v - n }; };
  const mul = (lo, hi, neg) => () => { let n = rand(lo, hi); if (neg && Math.random() < 0.45) n = -n; return { text: `× ${par(n)}`, val: (v) => v * n }; };
  const div = (lo, hi, neg) => (v) => {
    const ok = []; for (let n = lo; n <= hi; n++) if (v !== 0 && v % n === 0) ok.push(n);
    if (!ok.length) return null;
    let n = pick(ok); if (neg && Math.random() < 0.45) n = -n;
    return { text: `÷ ${par(n)}`, val: (x) => x / n };
  };
  const double = () => ({ text: "Double it", val: (v) => v * 2 });
  const half = (v) => (v % 2 === 0 ? { text: "Halve it", val: (x) => x / 2 } : null);
  const pctOf = (v) => {
    const ok = [10, 20, 25, 50, 75, 5].filter((p) => Number.isInteger((v * p) / 100) && v * p !== 0);
    if (!ok.length) return null; const p = pick(ok);
    return { text: `Take ${p}% of it`, val: (x) => (x * p) / 100 };
  };
  const pctChange = (v) => {
    const ok = [10, 20, 25, 50].filter((p) => Number.isInteger((v * p) / 100));
    if (!ok.length || v === 0) return null; const p = pick(ok), up = Math.random() < 0.55;
    return { text: `${up ? "Increase" : "Decrease"} by ${p}%`, val: (x) => x + ((up ? 1 : -1) * x * p) / 100 };
  };
  const fracOf = (v) => {
    const ok = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [5, 6]].filter(([, d]) => v % d === 0 && v !== 0);
    if (!ok.length) return null; const [n, d] = pick(ok);
    return { text: `Take ${n}/${d} of it`, val: (x) => (x / d) * n };
  };
  const tens = () => pick([
    { text: "× 10", val: (v) => v * 10 }, { text: "÷ 10", val: (v) => v / 10 },
    { text: "× 100", val: (v) => v * 100 }, { text: "÷ 100", val: (v) => v / 100 },
    { text: "+ 0.5", val: (v) => v + 0.5 }, { text: `${"−"} 0.2`, val: (v) => v - 0.2 }]);
  const square = (v) => (Math.abs(v) <= 15 && v !== 0 && Math.abs(v) !== 1 ? { text: "Square it", val: (x) => x * x } : null);
  const sqrt = (v) => (v > 1 && Number.isInteger(Math.sqrt(v)) ? { text: "Take the square root", val: (x) => Math.sqrt(x) } : null);
  const cube = (v) => (Math.abs(v) <= 5 && Math.abs(v) > 1 ? { text: "Cube it", val: (x) => x * x * x } : null);

  // must: the level's first step type has to appear at least once (e.g. squaring on exponent levels)
  const T = (start, steps, makers, lo, hi, maxDp = 0, must = false) => ({ start, steps, makers, lo, hi, maxDp, must });
  const LEVELS = {
    facts: [
      T(() => rand(2, 9), 3, [add(1, 9), sub(1, 9)], 0, 40),
      T(() => rand(2, 9), 4, [add(2, 12), sub(2, 12), mul(2, 5)], 0, 120),
      T(() => rand(3, 12), 5, [add(3, 15), sub(3, 15), mul(2, 6), div(2, 9)], 0, 200),
      T(() => rand(2, 9), 4, [tens, tens, double, half], 0, 1000, 2, true),
    ],
    integers: [
      T(() => rand(-5, 5), 3, [add(1, 9), sub(1, 9), addNeg(1, 9)], -30, 30),
      T(() => rand(-6, 6) || 3, 4, [add(1, 9), sub(1, 9), mul(2, 4, true), div(2, 5, true)], -80, 80),
      T(() => rand(-9, 9) || -4, 5, [addNeg(2, 12), sub(2, 12), mul(2, 5, true), div(2, 6, true)], -120, 120),
      T(() => rand(-12, 12) || 5, 6, [addNeg(3, 15), add(3, 15), sub(3, 15), mul(2, 6, true), div(2, 7, true)], -200, 200),
    ],
    fdp: [
      T(() => 4 * rand(2, 10), 4, [double, half, add(2, 10), sub(2, 10)], 0, 200, 0, true),
      T(() => 20 * rand(2, 10), 3, [pctOf, add(5, 20), double, half], 0, 500, 0, true),
      T(() => 20 * rand(2, 10), 3, [pctChange, pctChange, add(5, 20)], 0, 600, 0, true),
      T(() => 12 * rand(2, 8), 4, [fracOf, fracOf, add(2, 12), double], 0, 300, 0, true),
    ],
    exponents: [
      T(() => rand(2, 6), 3, [square, add(1, 9), sub(1, 9)], 0, 250, 0, true),
      T(() => pick([4, 9, 16, 25, 36, 49, 64, 81, 100]), 4, [sqrt, square, add(1, 6), sub(1, 6)], 0, 400, 0, true),
      T(() => rand(2, 5), 4, [cube, square, sqrt, add(1, 9), sub(1, 9)], -50, 400, 0, true),
      T(() => rand(-5, 5) || 2, 5, [square, cube, sqrt, addNeg(1, 9), sub(1, 9), mul(2, 3, true)], -300, 400, 0, true),
    ],
  };

  function chain(topic, level, extra = 0) {
    const cfg = LEVELS[topic][level - 1];
    for (let attempt = 0; attempt < 200; attempt++) {
      let v = cfg.start();
      const start = v, steps = [];
      let ok = true, usedMust = false;
      for (let i = 0; i < cfg.steps + extra && ok; i++) {
        let placed = false;
        for (let t = 0; t < 40 && !placed; t++) {
          const mi = Math.floor(Math.random() * cfg.makers.length), op = cfg.makers[mi](v);
          if (!op) continue;
          const nv = round(op.val(v));
          if (nv < cfg.lo || nv > cfg.hi || dp(nv) > cfg.maxDp || nv === v) continue;
          steps.push({ text: op.text, after: nv }); v = nv; placed = true;
          if (mi === 0) usedMust = true;
        }
        ok = placed;
      }
      if (ok && (!cfg.must || usedMust)) return { start, steps, answer: v };
    }
    return { start: 5, steps: [{ text: "+ 3", after: 8 }, { text: "× 2", after: 16 }], answer: 16 };
  }

  MML.games.total = {
    mixes: {
      6: [["facts", 1], ["fdp", 1], ["facts", 2], ["exponents", 1], ["facts", 3], ["fdp", 2]],
      7: [["facts", 2], ["integers", 1], ["fdp", 2], ["integers", 2], ["facts", 3], ["fdp", 3], ["integers", 3]],
      8: [["integers", 1], ["facts", 3], ["integers", 2], ["exponents", 1], ["integers", 3], ["exponents", 2], ["fdp", 4], ["integers", 4]],
      school: [["facts", 1], ["facts", 2], ["integers", 1], ["fdp", 1], ["facts", 3]],
    },
    rules: () => [
      "You'll see a starting number, then one step at a time. Do each step in your head.",
      "Press <kbd>space</kbd> (or click) when you're ready for the next step. Steps also move on by themselves.",
      "At the end, type your number and press <kbd>Enter</kbd>.",
      "Longer chains are worth more points.",
    ],
    create(S) {
      const C = S.C;
      let ch = null, phase = "idle", idx = -1, stepT = 0, stepTime = 4, scroll = 0, chainsDone = 0, waitT = 0, bob = 0;
      const box = document.createElement("div");
      box.className = "chain-card";
      box.innerHTML = `<p class="chain-label" id="chLabel"></p><p class="chain-big" id="chBig"></p>
        <div class="chain-dots" id="chDots"></div><div class="timebar"><span id="chBar"></span></div>
        <button type="button" class="btn btn-primary" id="chNext">Next step</button>
        <form id="chForm" class="chain-form" hidden><input id="chIn" inputmode="decimal" autocomplete="off" aria-label="Your number" placeholder="Your number">
        <button type="submit" class="btn btn-primary">Check</button></form>`;
      box.hidden = true;
      S.ui.appendChild(box);
      const $ = (id) => box.querySelector("#" + id);

      function newChain() {
        const [t, l] = S.content();
        const extra = S.arcade ? Math.min(4, Math.floor(chainsDone / 4)) : 0;
        ch = Object.assign(chain(t, l, extra), { strand: t, level: l });
        stepTime = S.arcade ? Math.max(1.8, 4 - chainsDone * 0.12) : Math.max(2.4, 4.4 - l * 0.35);
        idx = -1; phase = "steps"; stepT = 0;
        $("chForm").hidden = true; $("chNext").hidden = false;
        $("chDots").innerHTML = ch.steps.map(() => "<i></i>").join("");
        show();
      }
      function show() {
        const dots = $("chDots").children;
        for (let i = 0; i < dots.length; i++) dots[i].className = i <= idx ? "on" : "";
        if (idx < 0) { $("chLabel").textContent = "Start with"; $("chBig").textContent = f(ch.start); }
        else { $("chLabel").textContent = `Step ${idx + 1} of ${ch.steps.length}`; $("chBig").textContent = ch.steps[idx].text; }
        $("chBig").classList.remove("pop"); void $("chBig").offsetWidth; $("chBig").classList.add("pop");
        stepT = 0;
        S.sfx.tick();
      }
      function next() {
        if (phase !== "steps") return;
        if (idx < ch.steps.length - 1) { idx++; show(); return; }
        phase = "answer";
        $("chLabel").textContent = "What's your number now?";
        $("chBig").textContent = "?";
        $("chNext").hidden = true; $("chForm").hidden = false; $("chBar").style.width = "0";
        $("chIn").value = ""; $("chIn").focus();
      }
      function check(e) {
        e.preventDefault();
        if (phase !== "answer" || S.state !== "playing") return;
        const val = $("chIn").value.trim();
        if (!val) return;
        const q = {
          prompt: `${f(ch.start)} ${ch.steps.map((s) => s.text).join(", ")}`, answer: f(ch.answer),
          strand: ch.strand, level: ch.level,
          tip: "Step by step: " + f(ch.start) + " → " + ch.steps.map((s) => `${s.text} = ${f(s.after)}`).join(" → "),
        };
        const tv = P().numVal(val);
        phase = "done";
        if (tv !== null && Math.abs(tv - ch.answer) < 1e-6) {
          const m = S.record(q, true, { review: false });
          const pts = 10 * ch.steps.length * m;
          S.addScore(pts); S.addCoins(m);
          S.float("+" + pts, S.W / 2, S.H * 0.3, C.sun); S.burst(S.W / 2, S.H * 0.35, C.mint, 24); S.sfx.right();
          $("chBig").textContent = f(ch.answer); $("chLabel").textContent = "Right!";
          chainsDone++; waitT = 1.1;
        } else {
          chainsDone++;
          S.miss(q, `You said ${val}.`, { review: false, fixPrefix: "The number was ", onClose: () => { if (S.state === "playing") newChain(); } });
        }
        if (S.count >= 2) S.fadeHint();
      }
      $("chNext").onclick = (e) => { e.currentTarget.blur(); next(); };
      $("chForm").addEventListener("submit", check);

      return {
      debug: () => ({ ch, phase }),
        start() {
          chainsDone = 0; box.hidden = false; S.hideProblem();
          S.hint("<kbd>space</kbd> next step &nbsp; type your number at the end");
          newChain();
        },
        focus() { if (phase === "answer") $("chIn").focus(); else if (document.activeElement) document.activeElement.blur(); },
        onKey(e) {
          if (phase === "steps" && (e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); next(); }
        },
        onEnd() { box.hidden = true; phase = "idle"; },
        update(dt) {
          scroll += 30 * dt; bob += dt;
          if (phase === "steps") {
            stepT += dt;
            $("chBar").style.width = Math.max(0, 100 - (stepT / stepTime) * 100) + "%";
            if (stepT >= stepTime) next();
          } else if (phase === "done" && waitT > 0) {
            waitT -= dt;
            if (waitT <= 0) newChain();
          }
        },
        idle(dt) { scroll += 20 * dt; bob += dt; },
        draw() {
          S.background(scroll);
          const n = ch ? ch.steps.length : 1, done = phase === "steps" ? idx + 1 : n;
          const y = S.H - 90 - (S.H * 0.25) * (done / n);
          S.ship(S.W / 2, y + Math.sin(bob * 2) * 4, 1.1, { flame: 14 + Math.sin(bob * 20) * 3 });
        },
      };
    },
  };
  MML.games.total.chain = chain; // exposed for testing
})();
