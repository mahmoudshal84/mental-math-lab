/* Mental Math Lab: MAP Practice
   42 untimed multiple-choice questions from all 8 topics, getting harder in 7 stages.
   A miss shows a worked explanation, then a similar ("twin") question. The student moves on
   after getting it right, or after 3 misses on the same question.
   Saved in progress/{uid}.map:
     best      fewest wrong attempts in a finished run (null until one is finished)
     bestAt    when that best was set
     finished  number of finished runs
     last      { wrong, first, coins, at } for the most recent finished run
     run       the run in progress (null when there isn't one), saved after every answer */
(async function () {
  const B = MML.backend, MQ = MML.mapQuestions;
  const $ = (id) => document.getElementById(id);
  const COINS_FIRST_TRY = 2, FINISH_BONUS = 30, MAX_TRIES = 3;
  const TOTAL = MQ.TOTAL, STAGES = MQ.STAGES, PER_STAGE = MQ.PER_STAGE;
  const STAGE_COLORS = ["#ff4f8b", "#ff8a3d", "#ffd23f", "#2ee6a6", "#3fb6ff", "#7b6bff", "#c36bff"];
  const LETTERS = ["A", "B", "C", "D"];
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const user = await B.requireStudent();
  let prog;
  try { prog = await B.loadProgress(user.uid); }
  catch (e) { $("loading").textContent = "Couldn't load your progress: " + e.message; return; }
  MML.avatar.applySite(prog.avatar.site);
  if (MML.help) MML.help.mount(document.querySelector("#mapNav"));

  const M = (prog.map = cleanMap(prog.map));
  function cleanMap(m) {
    m = m && typeof m === "object" ? m : {};
    const r = m.run;
    const runOk = r && Array.isArray(r.plan) && r.plan.length === TOTAL && r.i >= 0 && r.i < TOTAL && r.cur && Array.isArray(r.cur.choices);
    return {
      best: typeof m.best === "number" ? m.best : null,
      bestAt: m.bestAt || null,
      finished: m.finished || 0,
      last: m.last || null,
      run: runOk ? r : null,
    };
  }

  /* ---------- Saving: one save at a time; changes made during a save go out right after ---------- */
  let saving = null, again = false;
  function save() {
    if (saving) { again = true; return saving; }
    saving = (async () => {
      do {
        again = false;
        try { await B.saveProgress(user, prog); $("saveNote").textContent = ""; }
        catch (e) { $("saveNote").textContent = `Couldn't save just now (${e.message}). It will try again after your next answer.`; }
      } while (again);
      saving = null;
    })();
    return saving;
  }

  // If the teacher locks the site, the student's place is already saved
  MML.siteLock.start(user, {
    onLock() { save(); return M.run ? "Your place is saved, so you can pick up where you left off." : ""; },
  });

  /* ---------- Views ---------- */
  function view(name) {
    for (const v of ["startView", "runView", "endView"]) $(v).hidden = v !== name;
    $("loading").hidden = true;
    $("main").hidden = false;
    window.scrollTo(0, 0);
  }

  function showStart() {
    view("startView");
    $("startBest").textContent = M.best === null ? "You haven't finished a run yet."
      : `Your best: ${plural(M.best, "wrong attempt")}. Fewer is better.`;
    const r = M.run;
    $("startBtn").textContent = r ? `Continue: question ${r.i + 1} of ${TOTAL}` : "Start MAP Practice";
    $("startOver").hidden = !r;
    $("startBtn").focus();
  }
  $("startBtn").onclick = () => (M.run ? showQuestion() : newRun());
  $("startOver").onclick = () => {
    if (!confirm("Start a new run? Your unfinished run will be erased. Only finished runs count toward your best.")) return;
    newRun();
  };
  $("againBtn").onclick = newRun;

  function newRun() {
    const plan = MQ.plan().map(([t, s]) => `${t}:${s}`); // strings, because Firestore can't store arrays inside arrays
    M.run = { id: Date.now(), plan, i: 0, wrong: 0, first: 0, coins: 0, tries: 0, phase: "ask", marks: [], topics: {}, cur: null };
    M.run.cur = makeQuestion(0);
    save();
    showQuestion();
  }
  function makeQuestion(i) {
    const [t, s] = M.run.plan[i].split(":");
    return MQ.generate(t, +s);
  }

  /* ---------- The question screen ---------- */
  let selected = null, busy = false;
  function showQuestion() {
    const r = M.run, q = r.cur;
    view("runView");
    selected = null; busy = false;
    drawTrack();
    $("qNum").textContent = `Question ${r.i + 1} of ${TOTAL}`;
    $("qStage").textContent = `Stage ${q.stage} of ${STAGES}`;
    $("qWrong").textContent = `Wrong attempts: ${r.wrong}`;
    $("qBest").textContent = M.best === null ? "No best yet" : `Your best: ${M.best}`;
    $("qTopic").textContent = q.label;
    $("qSimilar").hidden = !q.twin;
    $("qPrompt").textContent = q.prompt;
    $("qFig").innerHTML = q.figure || "";
    $("qFig").hidden = !q.figure;
    const box = $("qChoices");
    box.innerHTML = "";
    q.choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "map-choice";
      b.setAttribute("role", "radio"); b.setAttribute("aria-checked", "false");
      const k = document.createElement("span"); k.className = "map-letter"; k.textContent = LETTERS[i]; k.setAttribute("aria-hidden", "true");
      const t = document.createElement("span"); t.className = "map-choice-text"; t.textContent = c;
      b.append(k, t);
      b.setAttribute("aria-label", `${LETTERS[i]}: ${c}`);
      b.onclick = () => choose(i);
      box.appendChild(b);
    });
    $("qFb").textContent = ""; $("qFb").className = "map-fb";
    $("checkBtn").disabled = true;
    $("checkBtn").hidden = false;
    $("explain").hidden = true;
    // Coming back to a question they already missed: show the explanation again
    if (r.phase === "explain" || r.phase === "maxed") { lockChoices(null); showExplain(); }
    else $("qPrompt").focus();
  }
  function choose(i) {
    if (busy || M.run.phase !== "ask") return;
    selected = i;
    [...$("qChoices").children].forEach((b, k) => { b.classList.toggle("sel", k === i); b.setAttribute("aria-checked", String(k === i)); });
    $("checkBtn").disabled = false;
  }
  function lockChoices(picked) {
    const q = M.run.cur;
    [...$("qChoices").children].forEach((b, k) => {
      b.disabled = true;
      if (q.choices[k] === q.answer) b.classList.add("right");
      else if (k === picked) b.classList.add("wrong");
    });
    $("checkBtn").hidden = true;
  }

  $("checkBtn").onclick = check;
  function check() {
    const r = M.run, q = r.cur;
    if (busy || selected === null || r.phase !== "ask") return;
    busy = true;
    const ok = q.choices[selected] === q.answer;
    if (ok) {
      const firstTry = r.tries === 0;
      [...$("qChoices").children].forEach((b, k) => { b.disabled = true; if (k === selected) b.classList.add("right"); });
      $("checkBtn").hidden = true;
      if (firstTry) { r.first++; r.coins += COINS_FIRST_TRY; prog.coins += COINS_FIRST_TRY; }
      $("qFb").textContent = firstTry ? `Correct! +${COINS_FIRST_TRY} coins` : "You got it! On to the next question.";
      $("qFb").className = "map-fb good";
      finishQuestion(firstTry ? 1 : 2);
      setTimeout(next, firstTry ? 900 : 1400);
    } else {
      r.wrong++; r.tries++;
      r.phase = r.tries >= MAX_TRIES ? "maxed" : "explain";
      $("qWrong").textContent = `Wrong attempts: ${r.wrong}`;
      lockChoices(selected);
      save();
      showExplain();
      busy = false;
    }
  }
  function showExplain() {
    const r = M.run, q = r.cur, maxed = r.phase === "maxed";
    $("exTitle").textContent = maxed ? "Here's the worked answer" : "Not quite. Here's how to solve it";
    const ol = $("exSteps"); ol.innerHTML = "";
    for (const s of q.steps) { const li = document.createElement("li"); li.textContent = s; ol.appendChild(li); }
    const a = $("exAnswer"); a.textContent = "So the answer is ";
    const b = document.createElement("b"); b.textContent = q.answer; a.append(b, ".");
    $("exNote").textContent = maxed ? "That's 3 tries on this one, so let's move on. You'll see this kind of question again in a future run."
      : "Now try a similar question with new numbers.";
    $("nextBtn").textContent = maxed ? "Next question" : "Try a similar question";
    $("explain").hidden = false;
    $("nextBtn").focus();
  }
  $("nextBtn").onclick = afterExplain;
  function afterExplain() {
    const r = M.run;
    if (!r || busy) return;
    if (r.phase === "maxed") { finishQuestion(3); next(); return; }
    if (r.phase !== "explain") return;
    r.cur = MQ.twin(r.cur);
    r.phase = "ask";
    save();
    showQuestion();
  }

  // mark: 1 = right on the first try, 2 = right after help, 3 = moved on after 3 misses
  function finishQuestion(mark) {
    const r = M.run, t = r.cur.topic, tp = (r.topics[t] = r.topics[t] || { r: 0, n: 0 });
    tp.n++; if (mark === 1) tp.r++;
    r.marks.push(mark);
    r.i++; r.tries = 0; r.phase = "ask";
    if (r.i >= TOTAL) return finishRun();
    r.cur = makeQuestion(r.i);
    save();
  }
  function next() { if (M.run) showQuestion(); else showEnd(); }

  /* ---------- Finishing a run ---------- */
  let result = null;
  function finishRun() {
    const r = M.run, prevBest = M.best, isBest = prevBest === null || r.wrong < prevBest;
    r.coins += FINISH_BONUS; prog.coins += FINISH_BONUS;
    if (isBest) { M.best = r.wrong; M.bestAt = Date.now(); }
    M.finished++;
    M.last = { wrong: r.wrong, first: r.first, coins: r.coins, at: Date.now() };
    result = { wrong: r.wrong, first: r.first, coins: r.coins, topics: r.topics, isBest, prevBest };
    M.run = null;
    save();
  }
  function showEnd() {
    view("endView");
    const res = result;
    $("endWrong").textContent = res.wrong;
    $("endWrongLabel").textContent = res.wrong === 1 ? "wrong attempt" : "wrong attempts";
    $("endBest").textContent = res.isBest
      ? (res.prevBest === null ? "That's your first finished run, so it's your best so far!" : `New best! Your old best was ${res.prevBest}.`)
      : `Your best is still ${M.best}. Fewer wrong attempts is better.`;
    $("endBest").className = "map-end-best" + (res.isBest ? " new" : "");
    $("endFirst").textContent = `${res.first} of ${TOTAL}`;
    $("endCoins").textContent = `+${res.coins}`;
    const list = $("endTopics"); list.innerHTML = "";
    let weakest = null;
    for (const t of MQ.ORDER) {
      const tp = res.topics[t] || { r: 0, n: 0 };
      if (!tp.n) continue;
      const share = tp.r / tp.n;
      if (!weakest || share < weakest.share) weakest = { t, share };
      const li = document.createElement("li");
      const nm = document.createElement("span"); nm.textContent = MQ.LABELS[t];
      const bar = document.createElement("span"); bar.className = "map-bar"; bar.setAttribute("aria-hidden", "true");
      const fill = document.createElement("i"); fill.style.width = Math.round(share * 100) + "%"; bar.appendChild(fill);
      const ct = document.createElement("b"); ct.textContent = `${tp.r} of ${tp.n}`;
      li.append(nm, bar, ct);
      li.setAttribute("aria-label", `${MQ.LABELS[t]}: ${tp.r} of ${tp.n} right on the first try`);
      list.appendChild(li);
    }
    $("endTip").textContent = weakest && weakest.share < 1
      ? `Your trickiest topic this run was ${MQ.LABELS[weakest.t]}. ` + (MML.problems && MML.problems.strands && MML.problems.strands[weakest.t]
        ? "Practicing it in the games will help." : "Read the worked explanations closely when you miss one.")
      : "Every topic right on the first try. Amazing!";
    $("againBtn").focus();
  }

  /* ---------- Progress track: 7 stages of 6 ---------- */
  function drawTrack() {
    const r = M.run, box = $("track");
    box.innerHTML = "";
    for (let s = 0; s < STAGES; s++) {
      const g = document.createElement("div");
      g.className = "map-stage"; g.style.setProperty("--c", STAGE_COLORS[s]);
      for (let k = 0; k < PER_STAGE; k++) {
        const i = s * PER_STAGE + k, pip = document.createElement("span");
        const m = r.marks[i];
        pip.className = "map-pip" + (i === r.i ? " now" : m === 1 ? " first" : m === 2 ? " help" : m === 3 ? " missed" : "");
        g.appendChild(pip);
      }
      box.appendChild(g);
    }
    $("trackText").textContent = `${r.i} of ${TOTAL} done, ${r.first} right on the first try.`;
  }

  /* ---------- Keyboard: 1-4 or A-D picks an answer, Enter checks or continues ---------- */
  addEventListener("keydown", (e) => {
    if ($("runView").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const r = M.run;
    if (!r) return;
    const k = e.key.toLowerCase(), idx = "1234".indexOf(k) >= 0 ? "1234".indexOf(k) : "abcd".indexOf(k);
    if (r.phase === "ask" && idx >= 0 && k.length === 1) { choose(idx); return; }
    if (e.key === "Enter" && !e.repeat) {
      const onChoice = e.target && e.target.classList && e.target.classList.contains("map-choice");
      if (e.target && e.target.tagName === "BUTTON" && !onChoice) return; // Check / Next buttons handle Enter themselves
      e.preventDefault();
      if (r.phase === "ask") check(); else afterExplain();
    }
  });

  window.mmlMap = { get map() { return M; } }; // read-only hook for testing
  showStart();
})();
