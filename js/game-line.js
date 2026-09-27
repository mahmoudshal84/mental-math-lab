/* Mental Math Lab: Number Line
   Estimate where the answer lands. Closer = more points. */
window.MML = window.MML || {};
MML.games = MML.games || {};
(function () {
  const P = () => MML.problems;
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const f = (n) => P().fmt(Math.round(n * 1000) / 1000);
  const M = () => P().MINUS;

  // Each maker returns { prompt, value, min, max, major, tol, tip }
  const Q = (prompt, value, min, max, major, tol, tip) => ({ prompt, value, min, max, major, tol, tip });
  const niceStep = (x) => { const p = 10 ** Math.floor(Math.log10(x)); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= x) return m * p; return 10 * p; };
  const niceMax = (v) => Math.ceil(v / niceStep(v / 10)) * niceStep(v / 10);

  const MAKERS = {
    facts: [
      () => { const a = rand(2, 9), b = rand(2, 9); return Q(`${a} × ${b}`, a * b, 0, 100, 10, 4, `${a} × ${b} = ${a * b}`); },
      () => { const a = rand(3, 12), b = rand(3, 12); return Q(`${a} × ${b}`, a * b, 0, 150, 10, 6, `${a} × ${b} = ${a * b}`); },
      () => { const a = rand(12, 49), b = rand(3, 9); const r = Math.round(a / 10) * 10;
        return Q(`${a} × ${b}`, a * b, 0, 500, 50, 20, `Round first: ${a} × ${b} is close to ${r} × ${b} = ${r * b}`); },
      () => { const a = rand(11, 39), b = rand(11, 29); const ra = Math.round(a / 10) * 10, rb = Math.round(b / 10) * 10;
        return Q(`${a} × ${b}`, a * b, 0, 1200, 100, 50, `Round both: ${ra} × ${rb} = ${ra * rb}. The exact answer is ${f(a * b)}.`); },
    ],
    integers: [
      () => { const a = rand(-10, 10), b = rand(-10, 10) || 3; return Q(`${f(a)} + ${b < 0 ? "(" + f(b) + ")" : b}`, a + b, -20, 20, 5, 1, `${f(a)} + ${b < 0 ? "(" + f(b) + ")" : b} = ${f(a + b)}`); },
      () => { const a = rand(-9, 9) || 4, b = rand(-9, 9) || -3; return Q(`${f(a)} × ${b < 0 ? "(" + f(b) + ")" : b}`, a * b, -100, 100, 20, 6, `${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(a * b)}, and the sign is ${a * b < 0 ? "negative" : "positive"}.`); },
      () => { const a = rand(-15, 15), b = rand(1, 15), c = rand(1, 15); return Q(`${f(a)} ${M()} ${b} + ${c}`, a - b + c, -40, 40, 10, 3, `Left to right: ${f(a)} ${M()} ${b} = ${f(a - b)}, then + ${c} = ${f(a - b + c)}`); },
      () => { const a = -(rand(1, 6) + pick([0.25, 0.5, 0.75])), b = pick([1.5, 2, 2.5, 3]);
        return Math.random() < 0.5 ? Q(`${f(a)} + ${f(b)}`, a + b, -10, 10, 1, 0.4, `${f(a)} + ${f(b)} = ${f(a + b)}`)
          : Q(`${f(a)} × 2`, a * 2, -15, 5, 1, 0.5, `Double ${f(-a)} is ${f(-a * 2)}, and it's negative.`); },
    ],
    fdp: [
      () => { const d = rand(2, 10), n = rand(1, d - 1); return Q(`${n}/${d}`, n / d, 0, 1, 0.1, 0.04, `${n}/${d} = ${f(n / d)}`); },
      () => { const p = rand(6, 94), n = 20 * rand(3, 20); const r = Math.round(p / 10) * 10;
        return Q(`${p}% of ${n}`, (p * n) / 100, 0, niceMax(n), niceStep(n / 10), n * 0.05, `${p}% is close to ${r}%. 10% of ${n} is ${f(n / 10)}, so about ${f((r * n) / 100)}.`); },
      () => { if (Math.random() < 0.5) { const d = pick([2, 3, 4, 5, 8]), n = rand(d + 1, d * 4 - 1); return Q(`${n}/${d}`, n / d, 0, 4, 0.5, 0.12, `${n} ÷ ${d} = ${f(n / d)}`); }
        const v = rand(5, 39) / 10 + pick([0, 0.05]); return Q(f(v), v, 0, 4, 0.5, 0.1, `${f(v)} is between ${Math.floor(v)} and ${Math.floor(v) + 1}.`); },
      () => { const price = 4 * rand(5, 40), p = pick([15, 20, 25, 30, 40, 50]); const sale = price * (1 - p / 100);
        return Q(`$${price} with ${p}% off`, sale, 0, niceMax(price), niceStep(price / 10), price * 0.04, `You pay ${100 - p}% of $${price}, which is $${f(sale)}.`); },
    ],
    exponents: [
      () => { const n = rand(2, 15); return Q(`${n}²`, n * n, 0, 250, 25, 10, `${n}² = ${n} × ${n} = ${n * n}`); },
      () => { let n; do { n = rand(2, 200); } while (Number.isInteger(Math.sqrt(n))); const lo = Math.floor(Math.sqrt(n));
        return Q(`√${n}`, Math.sqrt(n), 0, 15, 1, 0.4, `√${n} is between √${lo * lo} = ${lo} and √${(lo + 1) ** 2} = ${lo + 1}. It's about ${f(Math.round(Math.sqrt(n) * 100) / 100)}.`); },
      () => { const [b, e] = pick([[2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10], [3, 3], [3, 4], [3, 5], [3, 6], [5, 3], [4, 4], [4, 5]]);
        return Q(`${b}${P().sup(e)}`, b ** e, 0, 1100, 100, 35, `${b}${P().sup(e)} = ${f(b ** e)}`); },
      () => { const m = pick([1.2, 2.5, 3.4, 4.8, 6.3, 7.1, 8.9, 9.5]), e = pick([2, 3, 3, 3]);
        return Q(`${f(m)} × 10${P().sup(e)}`, m * 10 ** e, 0, 10000, 1000, 350, `10${P().sup(e)} moves the decimal ${e} places: ${f(m * 10 ** e)}`); },
    ],
  };

  MML.games.line = {
    mixes: {
      6: [["facts", 1], ["fdp", 1], ["integers", 1], ["facts", 2], ["exponents", 1], ["facts", 3], ["fdp", 2]],
      7: [["facts", 2], ["integers", 1], ["fdp", 1], ["integers", 2], ["fdp", 2], ["facts", 3], ["fdp", 3], ["exponents", 2]],
      8: [["integers", 2], ["fdp", 2], ["exponents", 1], ["exponents", 2], ["facts", 4], ["integers", 4], ["fdp", 4], ["exponents", 3], ["exponents", 4]],
      school: [["facts", 1], ["integers", 1], ["fdp", 1], ["facts", 2], ["exponents", 1]],
    },
    rules: () => [
      "Drag or click on the line to place your guess, or use <kbd>←</kbd> <kbd>→</kbd> (hold <kbd>shift</kbd> to move faster).",
      "Press <kbd>Enter</kbd> or click Lock it in before time runs out.",
      "Land close enough to count as right. Closer means more points.",
      "Missing by too much costs a life.",
    ],
    make: (t, l) => MAKERS[t][l - 1](),
    create(S) {
      const C = S.C;
      let q = null, guess = 0, moved = false, phase = "idle", t = 0, limit = 20, scroll = 0, reveal = 0, dragging = false, answeredN = 0, result = null;
      const bar = document.createElement("div");
      bar.className = "line-bar";
      bar.innerHTML = `<div class="timebar"><span id="lnBar"></span></div><button type="button" class="btn btn-primary" id="lnLock">Lock it in</button><button type="button" class="btn btn-primary" id="lnNext" hidden>Next</button>`;
      bar.hidden = true;
      S.ui.appendChild(bar);
      const $ = (id) => bar.querySelector("#" + id);

      const geo = () => ({ x0: S.W * 0.08, x1: S.W * 0.92, y: S.H * 0.55 });
      const toX = (v) => { const g = geo(); return g.x0 + ((v - q.min) / (q.max - q.min)) * (g.x1 - g.x0); };
      const toV = (x) => { const g = geo(); return q.min + Math.max(0, Math.min(1, (x - g.x0) / (g.x1 - g.x0))) * (q.max - q.min); };

      function newQ() {
        const [tp, lv] = S.content();
        q = Object.assign(MML.games.line.make(tp, lv), { strand: tp, level: lv });
        guess = (q.min + q.max) / 2; moved = false; phase = "aim"; t = 0; result = null;
        limit = S.arcade ? Math.max(8, 20 - answeredN * 0.5) : 24 - S.level * 2;
        $("lnLock").hidden = false; $("lnNext").hidden = true;
        S.problem(q.prompt);
      }
      function lock() {
        if (phase !== "aim" || S.state !== "playing") return;
        phase = "reveal"; reveal = 0; answeredN++;
        const err = Math.abs(guess - q.value), ok = err <= q.tol;
        const rec = { prompt: q.prompt, answer: f(Math.round(q.value * 100) / 100), strand: q.strand, level: q.level, tip: q.tip };
        result = { ok, err };
        $("lnLock").hidden = true;
        if (ok) {
          const m = S.record(rec, true, { review: false });
          const pts = Math.round((10 + 40 * (1 - err / q.tol)) * m);
          S.addScore(pts); S.addCoins(m);
          S.float(err <= q.tol * 0.25 ? `Bullseye! +${pts}` : `+${pts}`, toX(q.value), geo().y - 80, C.sun);
          S.burst(toX(q.value), geo().y, C.mint, 20); S.sfx.right();
          setTimeout(() => { if (phase === "reveal" && S.state === "playing") newQ(); }, 1300);
        } else {
          S.record(rec, false, { review: false });
          S.sfx.wrong();
          S.note(`${q.prompt} ${Math.abs(q.value - Math.round(q.value * 100) / 100) < 1e-9 ? "=" : "≈"} ${rec.answer}. You were off by ${f(Math.round(err * 100) / 100)}.`, q.tip, 60000);
          const life = S.loseLife();
          if (life.saved) S.float("Shield saved you", S.W / 2, geo().y - 120, C.mint);
          if (!life.alive) { S.endSoon(2200); return; }
          $("lnNext").hidden = false; $("lnNext").focus();
        }
        if (S.count >= 3) S.fadeHint();
      }
      function nextQ() {
        if (phase !== "reveal" || S.state !== "playing") return;
        document.getElementById("tipPanel").hidden = true;
        newQ();
      }
      $("lnLock").onclick = (e) => { e.currentTarget.blur(); lock(); };
      $("lnNext").onclick = (e) => { e.currentTarget.blur(); nextQ(); };
      const setFromPointer = (e) => { if (phase === "aim" && S.state === "playing") { guess = toV(e.clientX); moved = true; } };
      S.canvas.addEventListener("pointerdown", (e) => { dragging = true; setFromPointer(e); });
      S.canvas.addEventListener("pointermove", (e) => { if (dragging) setFromPointer(e); });
      ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => S.canvas.addEventListener(ev, () => (dragging = false)));

      function tickLabel(v) {
        if (Math.abs(q.max - q.min) <= 4 && q.major < 1) return f(Math.round(v * 100) / 100);
        return f(Math.round(v * 100) / 100);
      }

      return {
      debug: () => ({ q, phase, guess }),
        start() { answeredN = 0; bar.hidden = false; S.hint("Drag or use <kbd>←</kbd> <kbd>→</kbd>, then <kbd>Enter</kbd>"); newQ(); },
        onEnd() { bar.hidden = true; phase = "idle"; },
        onKey(e) {
          const k = e.key;
          if (phase === "aim") {
            const step = (q.max - q.min) / (e.shiftKey ? 20 : 200);
            if (k === "ArrowLeft") { guess = Math.max(q.min, guess - step); moved = true; }
            else if (k === "ArrowRight") { guess = Math.min(q.max, guess + step); moved = true; }
            else if ((k === "Enter" || k === " ") && !e.repeat) { e.preventDefault(); lock(); }
          } else if (phase === "reveal" && (k === "Enter" || k === " ") && !e.repeat && !$("lnNext").hidden) { e.preventDefault(); nextQ(); }
        },
        update(dt) {
          scroll += 20 * dt;
          if (phase === "aim") {
            t += dt;
            $("lnBar").style.width = Math.max(0, 100 - (t / limit) * 100) + "%";
            if (t >= limit) lock();
          } else if (phase === "reveal") reveal = Math.min(1, reveal + dt * 2.5);
        },
        idle(dt) { scroll += 15 * dt; },
        draw(ctx) {
          S.background(scroll);
          if (!q) return;
          const g = geo();
          // band + line
          ctx.fillStyle = "rgba(21,26,69,.55)";
          S.roundRect(g.x0 - 30, g.y - 70, g.x1 - g.x0 + 60, 140, 16); ctx.fill();
          ctx.strokeStyle = C.paper; ctx.lineWidth = 4; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(g.x0, g.y); ctx.lineTo(g.x1, g.y); ctx.stroke();
          // ticks
          ctx.fillStyle = C.paper; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = `600 14px ${S.FONT}`;
          const n = Math.round((q.max - q.min) / q.major);
          for (let i = 0; i <= n; i++) {
            const v = q.min + i * q.major, x = toX(v), big = i === 0 || i === n || Math.abs(v) < 1e-9 || n <= 12 || i % 2 === 0;
            ctx.strokeStyle = C.paper; ctx.lineWidth = big ? 3 : 2;
            ctx.beginPath(); ctx.moveTo(x, g.y - (big ? 12 : 7)); ctx.lineTo(x, g.y + (big ? 12 : 7)); ctx.stroke();
            if (big) ctx.fillText(tickLabel(v), x, g.y + 18);
          }
          // reveal: the true answer and the "close enough" zone
          if (phase === "reveal" || S.state === "ending") {
            const a = reveal;
            ctx.globalAlpha = a * 0.35; ctx.fillStyle = C.mint;
            ctx.fillRect(toX(Math.max(q.min, q.value - q.tol)), g.y - 26, toX(Math.min(q.max, q.value + q.tol)) - toX(Math.max(q.min, q.value - q.tol)), 52);
            ctx.globalAlpha = a; ctx.fillStyle = C.mint; ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
            const ax = toX(q.value);
            ctx.beginPath(); ctx.moveTo(ax, g.y + 6); ctx.lineTo(ax - 12, g.y + 34); ctx.lineTo(ax + 12, g.y + 34); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.font = `700 18px ${S.FONT}`; ctx.fillStyle = C.mint; ctx.textBaseline = "top";
            ctx.fillText(f(Math.round(q.value * 100) / 100), ax, g.y + 40);
            ctx.globalAlpha = 1;
          }
          // the player's ship is the marker
          const gx = toX(guess);
          ctx.strokeStyle = result && !result.ok ? C.pink : C.sun; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
          ctx.beginPath(); ctx.moveTo(gx, g.y - 60); ctx.lineTo(gx, g.y); ctx.stroke(); ctx.setLineDash([]);
          S.ship(gx, g.y - 8, 0.8, { rotate: Math.PI, flame: 10 + (S.reduced ? 0 : Math.sin(S.time * 20) * 3) });
          if (phase === "aim" && !moved) {
            ctx.font = `600 15px ${S.FONT}`; ctx.fillStyle = C.paper; ctx.textBaseline = "bottom";
            ctx.fillText("Drag me to your guess", gx, g.y - 110);
          }
        },
      };
    },
  };
})();
