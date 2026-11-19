/* Mental Math Lab: Answer Check (answers.html)
   No login needed. Shows 30 numbered cards; each one reveals its answer when tapped.
   The teacher edits the answers on the admin page, and this page updates by itself. */
(function () {
  const B = MML.backend, F = MML.mathfmt;
  const $ = (id) => document.getElementById(id);
  const N = (B.answers && B.answers.count) || 30;
  const COLORS = ["#ff4f8b", "#ff8a3d", "#ffd23f", "#2ee6a6", "#3fb6ff", "#7b6bff"];
  const OPEN_KEY = "mml-answer-check-open";

  let data = null;        // { lesson, items, changedAt }
  let open = new Set();   // which cards this student has revealed
  const cards = [];

  // Remember which cards are open, so a refresh doesn't close them (until the teacher changes the answers)
  function saveOpen() {
    try { sessionStorage.setItem(OPEN_KEY, JSON.stringify({ at: data ? data.changedAt : 0, open: [...open] })); } catch (e) { }
  }
  function loadOpen(at) {
    try {
      const s = JSON.parse(sessionStorage.getItem(OPEN_KEY));
      if (s && s.at === at && Array.isArray(s.open)) return new Set(s.open.filter((k) => Number.isInteger(k) && k >= 0 && k < N));
    } catch (e) { }
    return new Set();
  }

  function build() {
    const grid = $("acGrid");
    for (let k = 0; k < N; k++) {
      const card = document.createElement("section");
      card.className = "ac-card";
      card.style.setProperty("--c", COLORS[Math.floor(k / 5) % COLORS.length]);
      card.setAttribute("aria-label", "Problem " + (k + 1));
      card.innerHTML = `<span class="ac-num" aria-hidden="true">${k + 1}</span>
        <div class="ac-ans" aria-live="polite"></div>
        <button class="ac-btn" type="button"></button>`;
      const btn = card.querySelector(".ac-btn");
      btn.onclick = () => {
        if (!data || !data.items[k]) return;
        if (open.has(k)) open.delete(k); else open.add(k);
        saveOpen();
        draw(k, true);
        drawCount();
        if (open.has(k)) btn.focus();
      };
      grid.appendChild(card);
      cards.push(card);
    }
  }

  function draw(k, animate) {
    const card = cards[k], btn = card.querySelector(".ac-btn"), ans = card.querySelector(".ac-ans");
    const text = data.items[k], shown = !!text && open.has(k);
    card.classList.toggle("empty", !text);
    card.classList.toggle("shown", shown);
    card.classList.toggle("pop", shown && !!animate);
    ans.innerHTML = shown ? F.html(text) : "";
    btn.disabled = !text;
    btn.textContent = !text ? "Not posted yet" : shown ? "Hide" : "Reveal answer";
    btn.setAttribute("aria-label", !text ? `Problem ${k + 1}: not posted yet` : shown ? `Hide answer ${k + 1}` : `Reveal answer ${k + 1}`);
  }
  function drawCount() {
    const posted = data.items.filter(Boolean).length;
    const opened = [...open].filter((k) => data.items[k]).length;
    $("acCount").textContent = posted ? `You've checked ${opened} of ${posted}` : "";
  }

  function drawAll() {
    const lesson = data.lesson.trim();
    $("acLesson").textContent = lesson ? (/^\d+$/.test(lesson) ? `Lesson ${lesson}` : lesson) + " · Written Practice" : "Written Practice";
    const posted = data.items.some(Boolean);
    $("acStatus").hidden = posted;
    $("acStatus").textContent = "Your teacher hasn't posted the answers yet. Check back soon!";
    $("acGrid").hidden = !posted;
    for (let k = 0; k < N; k++) draw(k, false);
    drawCount();
  }

  function flashUpdate() {
    const u = $("acUpdate");
    u.hidden = false;
    clearTimeout(flashUpdate.t);
    flashUpdate.t = setTimeout(() => (u.hidden = true), 6000);
  }

  build();
  if (!B.answers) { $("acStatus").textContent = "This page needs a refresh. Press Ctrl+Shift+R."; return; }
  B.answers.watch((d, err) => {
    if (err) {
      if (!data) $("acStatus").innerHTML = "The answers can't load right now. <button type='button' class='ac-retry' onclick='location.reload()'>Try again</button>";
      return;
    }
    const changed = data && JSON.stringify([d.lesson, d.items]) !== JSON.stringify([data.lesson, data.items]);
    if (!data) open = loadOpen(d.changedAt);
    else if (changed) { open = new Set(); if (data.items.some(Boolean)) flashUpdate(); }
    data = d;
    saveOpen();
    drawAll();
  }).catch(() => { $("acStatus").innerHTML = "The answers can't load right now. <button type='button' class='ac-retry' onclick='location.reload()'>Try again</button>"; });
})();
