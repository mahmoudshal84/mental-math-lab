/* Mental Math Lab: Type to Blast
   Problems fall from the sky. Type an answer and press Enter to blast the matching one. */
window.MML = window.MML || {};
MML.games = MML.games || {};
MML.games.blast = {
  rules: () => [
    "Problems fall toward the ground. Type an answer and press <kbd>Enter</kbd> to blast it.",
    "Blast them high up for bonus points. Each one that lands costs a life.",
    "A typed answer that matches nothing counts as a wrong answer, so don't guess.",
    "Type fractions like <b>3/4</b>, negatives like <b>-5</b>, and powers like <b>x^7</b> or <b>10^3</b>.",
  ],
  create(S) {
    const C = S.C, P = MML.problems;
    const MAX_ROCKS = 5;
    let rocks = [], spawnIn = 0, every = 4, fall = 12, scroll = 0, beam = null, aim = 0;
    const baseFall = S.arcade ? 13 : 11 + S.level * 0.4 + (S.topic === "fdp" && S.level === 3 ? 3 : 0) + (["ratios", "geometry", "data"].includes(S.topic) ? 2 : 0);

    // Answer box
    const form = document.createElement("form");
    form.className = "type-bar";
    form.innerHTML = `<input id="blastIn" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Your answer" placeholder="Type an answer, press Enter"><button type="submit">Blast</button>`;
    S.ui.appendChild(form);
    const input = form.querySelector("input");
    form.hidden = true;
    const ground = () => S.H - 130;
    const shipY = () => S.H - 175;

    function spawn() {
      const q = S.nextQuestion((x) => P.typable(x.answer));
      S.ctx.font = `700 26px ${S.FONT}`;
      const w = Math.min(S.W * 0.42, S.ctx.measureText(q.prompt).width + 40), h = 58;
      let x, tries = 0;
      do { x = S.W * 0.06 + Math.random() * (S.W * 0.88 - w); tries++; }
      while (tries < 12 && rocks.some((r) => Math.abs(r.x - x) < (r.w + w) / 2 + 10 && r.y < 120));
      rocks.push({ q, x, y: -h, w, h, speed: (ground() + h) / fall, dead: false, t: 0 });
    }
    function submit(e) {
      e.preventDefault();
      const val = input.value.trim();
      if (!val || S.state !== "playing") return;
      input.value = "";
      const live = rocks.filter((r) => !r.dead).sort((a, b) => b.y - a.y);
      const hit = live.find((r) => P.matches(val, r.q.answer));
      if (hit) {
        hit.dead = true; hit.t = 0;
        const m = S.record(hit.q, true);
        const height = Math.max(0, 1 - hit.y / ground());
        const pts = Math.round((10 + 10 * height) * m);
        S.addScore(pts); S.addCoins(m);
        beam = { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2, life: 0.25 };
        aim = Math.atan2(beam.x - S.W / 2, shipY() - beam.y);
        S.float("+" + pts, beam.x, beam.y - 20, C.sun);
        S.burst(beam.x, beam.y, C.mint, 22);
        S.sfx.right();
        every = Math.max(S.arcade ? 1.4 : 1.8, every * 0.96);
        fall = Math.max(baseFall * 0.55, fall * 0.98);
      } else if (live.length) {
        S.record(live[0].q, false, { review: false, missed: false });
        form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
        S.float("No match", S.W / 2, S.H - 190, C.pink);
        S.sfx.wrong();
      }
      if (S.count >= 3) S.fadeHint();
    }
    form.addEventListener("submit", submit);
    S.canvas.addEventListener("pointerdown", () => { if (S.state === "playing") input.focus(); });

    return {
      debug: () => ({ rocks }),
      start() {
        rocks = []; spawnIn = 0.3; every = S.arcade ? 4 : 4.4; fall = baseFall; beam = null; aim = 0;
        form.hidden = false; input.value = "";
        S.hideProblem();
        S.hint("Type the answer and press <kbd>Enter</kbd>");
      },
      focus() { if (S.state === "playing") input.focus(); },
      onEnd() { form.hidden = true; input.blur(); },
      update(dt) {
        scroll += 40 * dt;
        if ((spawnIn -= dt) <= 0) {
          if (rocks.filter((r) => !r.dead).length < MAX_ROCKS) spawn();
          spawnIn = every;
        }
        if (!rocks.some((r) => !r.dead) && spawnIn > 0.6) spawnIn = 0.6;
        for (const r of rocks) {
          if (r.dead) { r.t += dt; continue; }
          r.y += r.speed * dt;
          if (r.y + r.h >= ground()) {
            r.dead = true; r.t = 0; r.landed = true;
            S.record(r.q, false);
            S.burst(r.x + r.w / 2, ground(), C.pink, 20);
            S.sfx.boom();
            S.note(`${r.q.prompt} = ${r.q.answer}`, r.q.tip);
            const life = S.loseLife();
            if (life.saved) S.float("Shield saved you", S.W / 2, S.H - 220, C.mint);
            if (!life.alive) { form.hidden = true; S.endSoon(1500); }
          }
        }
        rocks = rocks.filter((r) => !r.dead || r.t < 0.4);
        if (beam) { beam.life -= dt; if (beam.life <= 0) beam = null; }
      },
      idle(dt) { if (S.state === "ready") scroll += 30 * dt; },
      draw(ctx) {
        const W = S.W, H = S.H, gy = ground();
        S.background(scroll);
        // ground
        ctx.fillStyle = "rgba(21,26,69,.55)"; ctx.fillRect(0, gy, W, H - gy);
        ctx.fillStyle = C.pink; ctx.fillRect(0, gy, W, 3);
        // falling problems
        for (const r of rocks) {
          const danger = Math.max(0, (r.y + r.h - gy * 0.55) / (gy * 0.45));
          ctx.globalAlpha = r.dead ? Math.max(0, 1 - r.t / 0.4) : 1;
          const scale = r.dead && !r.landed ? 1 + r.t : 1;
          ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(scale, scale);
          ctx.fillStyle = C.ink; S.roundRect(-r.w / 2 + 4, -r.h / 2 + 4, r.w, r.h, 12); ctx.fill();
          ctx.fillStyle = r.dead && !r.landed ? C.mint : r.landed ? C.pink : C.paper;
          S.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 12); ctx.fill();
          if (!r.dead && danger > 0) { ctx.strokeStyle = `rgba(255,79,139,${Math.min(1, danger)})`; ctx.lineWidth = 4; ctx.stroke(); }
          S.fitFont(r.q.prompt, r.w - 20, 26);
          ctx.fillStyle = C.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(r.q.prompt, 0, 1);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        // laser
        if (beam) {
          ctx.strokeStyle = C.sun; ctx.lineWidth = 5 * (beam.life / 0.25) + 1;
          ctx.beginPath(); ctx.moveTo(W / 2, shipY()); ctx.lineTo(beam.x, beam.y); ctx.stroke();
        }
        S.ship(W / 2, shipY() - 20, 1, { rotate: aim * 0.8, flame: 10 + (S.reduced ? 2 : Math.random() * 5) });
        aim *= 0.9;
      },
    };
  },
};
