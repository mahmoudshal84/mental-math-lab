/* Mental Math Lab: Lane Runner
   Three answers come down three lanes. Steer into the right one. */
window.MML = window.MML || {};
MML.games = MML.games || {};
MML.games.lane = {
  rules: () => [
    "Steer with <kbd>←</kbd> <kbd>→</kbd> (or <kbd>A</kbd> <kbd>D</kbd>, or click a lane).",
    "Fly through the right answer.",
    "Sure of your answer? Hold <kbd>space</kbd> to go faster and earn bonus points.",
    "Five right in a row doubles your points. Ten triples them.",
  ],
  create(S) {
    const C = S.C, AV = MML.avatar;
    const BASE = S.arcade ? 8 : 7 + S.level * 0.6 + (S.topic === "fdp" && S.level === 3 ? 2 : 0) + (S.topic === "ratios" ? 1.5 : 0);
    const FASTEST = BASE * (S.arcade ? 0.4 : 0.45), BOOST = 3.2, SPEED_UP = 0.95, SLOW_DOWN = S.arcade ? 1.1 : 1.25;
    let lane = 1, px = 0, scroll = 0, gate = null, spawnIn = 0.4, boost = false, travel = BASE;

    const L = () => {
      const W = S.W, H = S.H, roadW = Math.min(W - 32, 640), roadX = (W - roadW) / 2, laneW = roadW / 3;
      return { roadW, roadX, laneW, startY: Math.max(160, H * 0.24), hitY: H * 0.78,
        ph: Math.max(54, Math.min(88, H * 0.1)), laneX: (i) => roadX + laneW * (i + 0.5) };
    };
    function setLane(i) {
      if (S.state !== "playing") return;
      const n = Math.max(0, Math.min(2, i));
      if (n !== lane) { lane = n; S.sfx.move(); }
    }
    function spawn() {
      const q = S.nextQuestion();
      const wrong = q.wrong.slice(0, 4).sort(() => Math.random() - 0.5).slice(0, 2);
      const choices = [q.answer, ...wrong].sort(() => Math.random() - 0.5);
      gate = { q, choices, correct: choices.indexOf(q.answer), prog: 0, resolved: false, chosen: -1, after: 0, boosted: false };
      S.problem(q.prompt, { review: q.review });
    }
    function resolve(g) {
      const lay = L();
      g.resolved = true; g.chosen = lane;
      if (lane === g.correct) {
        const m = S.record(g.q, true);
        const pts = 10 * m + (g.boosted ? 5 * m : 0);
        S.addScore(pts); S.addCoins(m);
        travel = Math.max(FASTEST, travel * SPEED_UP);
        S.float("+" + pts, px, lay.hitY - 40, C.sun);
        S.burst(px, lay.hitY, C.mint, 18);
        S.sfx.right();
        S.problem(`${g.q.prompt} = ${g.q.answer}`, { solved: true });
      } else {
        travel = Math.min(BASE, travel * SLOW_DOWN);
        S.burst(px, lay.hitY, C.pink, 14);
        boost = false;
        S.miss(g.q, `You went through ${g.choices[g.chosen]}.`);
      }
      if (S.count >= 3) S.fadeHint();
    }

    S.canvas.addEventListener("pointerdown", (e) => {
      if (S.state !== "playing") return;
      const lay = L();
      const l = Math.max(0, Math.min(2, Math.floor((e.clientX - lay.roadX) / lay.laneW)));
      if (l === lane) boost = true; else setLane(l);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((t) => S.canvas.addEventListener(t, () => (boost = false)));
    addEventListener("blur", () => (boost = false));

    return {
      start() {
        lane = 1; px = L().laneX(1); gate = null; spawnIn = 0.4; boost = false; travel = BASE;
        S.hint("<kbd>←</kbd> <kbd>→</kbd> steer &nbsp; hold <kbd>space</kbd> to go faster");
      },
      onKey(e) {
        const k = e.key;
        if (k === "ArrowLeft" || k === "a" || k === "A") setLane(lane - 1);
        else if (k === "ArrowRight" || k === "d" || k === "D") setLane(lane + 1);
        else if (k === "1" || k === "2" || k === "3") setLane(+k - 1);
        else if (k === " " || k === "ArrowUp" || k === "w" || k === "W") boost = true;
      },
      onKeyUp(e) { if ([" ", "ArrowUp", "w", "W"].includes(e.key)) boost = false; },
      onPause() { boost = false; },
      update(dt) {
        const lay = L(), g = gate;
        const speed = boost && g && !g.resolved ? BOOST : 1;
        scroll += ((lay.hitY - lay.startY) / travel) * speed * dt;
        if (g) {
          if (!g.resolved) {
            g.prog += (dt / travel) * speed;
            if (speed > 1) g.boosted = true;
            if (g.prog >= 1) { g.prog = 1; resolve(g); }
          } else {
            g.after += dt; g.prog += (dt / travel) * 1.4;
            if (g.after > 0.5) { gate = null; spawnIn = 0.3; }
          }
        } else if ((spawnIn -= dt) <= 0) spawn();
        px += (lay.laneX(lane) - px) * Math.min(1, dt * 14);
      },
      idle(dt) {
        const lay = L();
        if (S.state === "ready") scroll += 60 * dt;
        px = px || lay.laneX(1);
        px += (lay.laneX(lane) - px) * Math.min(1, dt * 14);
      },
      onEnd() { gate = null; boost = false; },
      draw(ctx) {
        const lay = L(), W = S.W, H = S.H;
        S.background(scroll);
        AV.drawRoad(ctx, S.theme(), lay.roadX, lay.roadW, H, scroll, lane);
        if (boost && S.state === "playing" && !S.reduced) {
          ctx.strokeStyle = "rgba(246,247,255,.35)"; ctx.lineWidth = 2; ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const side = i % 2 ? lay.roadX - 20 - Math.random() * 60 : lay.roadX + lay.roadW + 20 + Math.random() * 60;
            const y = Math.random() * H;
            ctx.moveTo(side, y); ctx.lineTo(side, y + 40 + Math.random() * 60);
          }
          ctx.stroke();
        }
        const g = gate;
        if (g) {
          const bottom = lay.startY + g.prog * (lay.hitY - lay.startY);
          ctx.globalAlpha = g.resolved ? Math.max(0, 1 - Math.max(0, g.after - 0.2) / 0.3) : Math.min(1, g.prog * 8);
          for (let i = 0; i < 3; i++) {
            const x = lay.roadX + lay.laneW * i + 8, w = lay.laneW - 16, y = bottom - lay.ph;
            let fill = C.paper;
            if (g.resolved) fill = i === g.correct ? C.mint : i === g.chosen ? C.pink : "rgba(246,247,255,.45)";
            ctx.fillStyle = C.ink; S.roundRect(x + 4, y + 4, w, lay.ph, 10); ctx.fill();
            ctx.fillStyle = fill; S.roundRect(x, y, w, lay.ph, 10); ctx.fill();
            S.fitFont(g.choices[i], w - 18, Math.round(lay.ph * 0.46));
            ctx.fillStyle = C.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(g.choices[i], x + w / 2, y + lay.ph / 2 + 1);
          }
          ctx.globalAlpha = 1;
        }
        const tilt = Math.max(-0.35, Math.min(0.35, (lay.laneX(lane) - px) / 250));
        const boosting = boost && S.state === "playing";
        S.ship(px, lay.hitY, Math.max(0.9, Math.min(1.25, H / 700)), {
          rotate: tilt, flame: 14 + (S.reduced ? 4 : Math.random() * 8) + (boosting ? 26 : 0) + (S.mult() - 1) * 6,
        });
      },
    };
  },
};
