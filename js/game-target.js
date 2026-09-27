/* Mental Math Lab: Make the Target
   Combine all the numbers with + − × ÷ to make the target. */
window.MML = window.MML || {};
MML.games = MML.games || {};
(function () {
  const P = () => MML.problems;
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const nz = (a, b) => { let n = 0; while (n === 0) n = rand(a, b); return n; };
  const f = (n) => P().fmt(n);
  const SYM = { "+": "+", "-": "−", "*": "×", "/": "÷" };
  function apply(a, op, b) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (b === 0 || a % b !== 0) return null;
    return a / b;
  }

  const CFG = {
    facts: [
      { n: 3, nums: () => rand(1, 9), ops: ["+", "-"], lo: 0, hi: 40, tlo: 2, thi: 30 },
      { n: 4, nums: () => rand(1, 9), ops: ["+", "-", "*"], lo: 0, hi: 100, tlo: 5, thi: 60 },
      { n: 4, nums: () => rand(1, 12), ops: ["+", "-", "*", "/"], lo: 0, hi: 150, tlo: 5, thi: 100 },
      { n: 4, nums: (i) => (i === 0 ? rand(10, 25) : rand(2, 12)), ops: ["+", "-", "*", "/"], lo: 0, hi: 300, tlo: 20, thi: 200 },
    ],
    integers: [
      { n: 3, nums: () => nz(-9, 9), ops: ["+", "-"], lo: -40, hi: 40, tlo: -20, thi: 20, neg: true },
      { n: 4, nums: () => nz(-9, 9), ops: ["+", "-", "*"], lo: -100, hi: 100, tlo: -60, thi: 60, neg: true },
      { n: 4, nums: () => nz(-9, 9), ops: ["+", "-", "*", "/"], lo: -120, hi: 120, tlo: -80, thi: 80, neg: true },
      { n: 4, nums: () => nz(-12, 12), ops: ["+", "-", "*", "/"], lo: -200, hi: 200, tlo: -150, thi: 150, neg: true },
    ],
  };

  // Build a puzzle by combining random numbers, so there's always at least one answer
  function puzzle(topic, level) {
    const c = CFG[topic][level - 1];
    for (let tries = 0; tries < 500; tries++) {
      const nums = Array.from({ length: c.n }, (_, i) => c.nums(i));
      if (c.neg && !nums.some((x) => x < 0)) continue;
      let items = nums.map((v) => ({ v, e: v < 0 ? `(${f(v)})` : f(v) }));
      let ok = true;
      while (items.length > 1 && ok) {
        const i = rand(0, items.length - 1); let j = rand(0, items.length - 2); if (j >= i) j++;
        const op = c.ops[rand(0, c.ops.length - 1)], a = items[i], b = items[j];
        const v = apply(a.v, op, b.v);
        if (v === null || v < c.lo || v > c.hi || (op === "*" && (a.v === 1 || b.v === 1)) || (op === "/" && b.v === 1)) { ok = false; break; }
        const e = `(${a.e} ${SYM[op]} ${b.e})`;
        items = items.filter((_, k) => k !== i && k !== j).concat([{ v, e }]);
      }
      if (!ok) continue;
      const target = items[0].v;
      if (target < c.tlo || target > c.thi || nums.includes(target) || target === 0) continue;
      if (c.ops.includes("*") && !/[×÷]/.test(items[0].e)) continue; // levels with × should need it
      return { nums, target, solution: items[0].e.replace(/^\((.*)\)$/, "$1") };
    }
    return { nums: [3, 4, 2], target: 14, solution: "(3 × 4) + 2" };
  }

  MML.games.target = {
    mixes: {
      6: [["facts", 1], ["facts", 2], ["facts", 3], ["facts", 4]],
      7: [["facts", 2], ["integers", 1], ["facts", 3], ["integers", 2], ["integers", 3]],
      8: [["facts", 3], ["integers", 2], ["facts", 4], ["integers", 3], ["integers", 4]],
      school: [["facts", 1], ["facts", 2], ["facts", 3]],
    },
    rules: () => [
      "Use every number once, combining two at a time: click a number, an operation, then another number.",
      "Keys: <kbd>1</kbd>–<kbd>4</kbd> pick numbers, <kbd>+</kbd> <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd> pick operations, <kbd>Backspace</kbd> undoes.",
      "Division has to come out even.",
      "Solve it before time runs out. Skipping or running out of time costs a life.",
    ],
    puzzle,
    create(S) {
      const C = S.C;
      let pz = null, tiles = [], history = [], sel = null, op = null, t = 0, limit = 90, phase = "idle", scroll = 0, solvedN = 0, bob = 0;
      const box = document.createElement("div");
      box.className = "target-card";
      box.innerHTML = `<p class="chain-label">Make</p><p class="target-num" id="tgNum"></p>
        <div class="timebar"><span id="tgBar"></span></div>
        <div class="tiles" id="tgTiles"></div>
        <div class="ops" id="tgOps">${["+", "-", "*", "/"].map((o) => `<button type="button" data-op="${o}" aria-label="${{ "+": "plus", "-": "minus", "*": "times", "/": "divided by" }[o]}">${SYM[o]}</button>`).join("")}</div>
        <p class="tg-msg" id="tgMsg" aria-live="polite"></p>
        <div class="actions"><button type="button" class="btn btn-ghost" id="tgUndo">Undo</button><button type="button" class="btn btn-ghost" id="tgReset">Start over</button><button type="button" class="btn btn-ghost" id="tgSkip">Skip</button></div>`;
      box.hidden = true;
      S.ui.appendChild(box);
      const $ = (id) => box.querySelector("#" + id);

      function newPuzzle() {
        const [tp, lv] = S.content();
        pz = Object.assign(puzzle(tp, lv), { strand: tp, level: lv });
        tiles = pz.nums.map((v, i) => ({ v, id: i }));
        history = []; sel = null; op = null; t = 0; phase = "play";
        limit = S.arcade ? Math.max(30, 75 - solvedN * 3) : 100 - lv * 10;
        $("tgNum").textContent = f(pz.target);
        msg("");
        render();
      }
      function msg(s) { $("tgMsg").textContent = s; }
      function render() {
        const box2 = $("tgTiles"); box2.innerHTML = "";
        tiles.forEach((tl, i) => {
          const b = document.createElement("button");
          b.type = "button"; b.className = "tile" + (sel === i ? " sel" : "");
          b.textContent = f(tl.v);
          b.setAttribute("aria-label", `Number ${f(tl.v)}`);
          b.onclick = () => pickTile(i);
          box2.appendChild(b);
        });
        box.querySelectorAll("[data-op]").forEach((b) => b.classList.toggle("sel", b.dataset.op === op));
      }
      function pickTile(i) {
        if (phase !== "play" || S.state !== "playing") return;
        if (sel === null || op === null) { sel = i; msg(""); render(); return; }
        if (i === sel) { op = null; render(); return; }
        const a = tiles[sel], b = tiles[i], v = apply(a.v, op, b.v);
        if (v === null) { msg(op === "/" && b.v === 0 ? "You can't divide by zero." : `${f(a.v)} ÷ ${f(b.v)} doesn't come out even. Try something else.`); op = null; render(); return; }
        history.push(tiles.map((x) => Object.assign({}, x)));
        const nt = tiles.filter((_, k) => k !== sel && k !== i);
        nt.splice(Math.min(sel, i), 0, { v, id: Math.random() });
        tiles = nt; sel = Math.min(sel, i); op = null;
        S.sfx.move();
        if (tiles.length === 1) {
          if (tiles[0].v === pz.target) return solved();
          msg(`That makes ${f(tiles[0].v)}, not ${f(pz.target)}. Undo or start over.`);
          sel = null;
        } else msg("");
        render();
      }
      function pickOp(o) {
        if (phase !== "play" || S.state !== "playing") return;
        if (sel === null) { msg("Pick a number first."); return; }
        op = o; msg(""); render();
      }
      function undo() { if (phase !== "play" || !history.length) return; tiles = history.pop(); sel = null; op = null; msg(""); render(); }
      function reset() { if (phase !== "play") return; if (history.length) tiles = history[0]; history = []; sel = null; op = null; msg(""); render(); }
      function record() { return { prompt: `Make ${f(pz.target)} from ${pz.nums.map(f).join(", ")}`, answer: pz.solution, strand: pz.strand, level: pz.level, tip: `One way: ${pz.solution} = ${f(pz.target)}` }; }
      function solved() {
        phase = "done"; solvedN++;
        const m = S.record(record(), true, { review: false });
        const pts = Math.round((20 + Math.max(0, limit - t)) * m);
        S.addScore(pts); S.addCoins(m * 2);
        msg(`You made ${f(pz.target)}! +${pts}`);
        S.float("+" + pts, S.W / 2, S.H * 0.25, C.sun); S.burst(S.W / 2, S.H * 0.3, C.mint, 30); S.sfx.right();
        render();
        setTimeout(() => { if (S.state === "playing" && phase === "done") newPuzzle(); }, 1200);
      }
      function giveUp(reason) {
        if (phase !== "play") return;
        phase = "done";
        S.miss(record(), reason, { review: false, fixPrefix: "One way: ", fixAnswer: `${pz.solution} = ${f(pz.target)}`, title: "Here's one way",
          onClose: () => { if (S.state === "playing") newPuzzle(); } });
      }
      box.querySelectorAll("[data-op]").forEach((b) => (b.onclick = () => pickOp(b.dataset.op)));
      $("tgUndo").onclick = undo; $("tgReset").onclick = reset;
      $("tgSkip").onclick = (e) => { e.currentTarget.blur(); giveUp("You skipped this one."); };

      return {
      debug: () => ({ pz, tiles, phase }),
        start() { solvedN = 0; box.hidden = false; S.hideProblem(); S.hint(""); newPuzzle(); },
        onEnd() { box.hidden = true; phase = "idle"; },
        onKey(e) {
          const k = e.key;
          if (/^[1-5]$/.test(k) && +k <= tiles.length) pickTile(+k - 1);
          else if (k === "+" || k === "=") pickOp("+");
          else if (k === "-" || k === "_") pickOp("-");
          else if (k === "*" || k === "x" || k === "X") pickOp("*");
          else if (k === "/") { e.preventDefault(); pickOp("/"); }
          else if (k === "Backspace") { e.preventDefault(); undo(); }
        },
        update(dt) {
          scroll += 20 * dt; bob += dt;
          if (phase === "play") {
            t += dt;
            $("tgBar").style.width = Math.max(0, 100 - (t / limit) * 100) + "%";
            if (t >= limit) giveUp("Time ran out.");
          }
        },
        idle(dt) { scroll += 15 * dt; bob += dt; },
        draw() {
          S.background(scroll);
          S.ship(S.W / 2, S.H - 110 + Math.sin(bob * 2) * 5, 1, { flame: 12 + Math.sin(bob * 20) * 3 });
        },
      };
    },
  };
})();
