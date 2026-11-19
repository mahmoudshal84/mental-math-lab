/* Mental Math Lab: Answer Check panel on the admin page
   Builds itself inside #acAdmin once the teacher is logged in (admin.js doesn't need to call it).
   A lesson label + 30 answer boxes, a math symbol toolbar, live previews, "paste all", and Save. */
(function () {
  const B = MML.backend, F = MML.mathfmt;
  const $ = (id) => document.getElementById(id);
  let started = false;

  // Wait until the teacher is logged in and the admin page is showing
  const t = setInterval(() => {
    const u = B.user && B.user(), view = $("adminView");
    if (u && u.isAdmin && view && !view.hidden && $("acAdmin")) { clearInterval(t); start(); }
  }, 300);

  function start() {
    if (started) return;
    started = true;
    const box = $("acAdmin");
    if (!B.answers) { box.innerHTML = "<p class='error'>Refresh this page (Ctrl+Shift+R) to load Answer Check.</p>"; return; }
    const N = B.answers.count, MAX = B.answers.max;

    box.innerHTML = `
      <div class="ac-top">
        <label class="field" style="max-width:260px">Lesson <input id="acLessonIn" maxlength="60" placeholder="Like 47" autocomplete="off"></label>
        <a class="btn btn-ghost" href="answers.html" target="_blank" rel="noopener" style="margin-bottom:8px">Open the student page ↗</a>
        <p class="note" id="acSaved" style="margin:0 0 14px"></p>
      </div>
      <div class="ac-tools" id="acTools" aria-label="Math symbols"></div>
      <div class="ac-fields" id="acFields"></div>
      <details class="ac-paste">
        <summary>Paste all 30 at once</summary>
        <p class="note">One answer per line, in order. Numbers at the start are fine (<code>1. 3/4</code>, <code>2) 12</code>);
          if your list is numbered, each answer goes into the box with its number, and a line without a number
          is added to the answer above it (for answers with parts a and b).</p>
        <textarea id="acPasteIn" placeholder="1. 3/4&#10;2. 2 1/2&#10;3. x^2&#10;4. 45deg&#10;…"></textarea>
        <div class="actions" style="margin-top:8px"><button class="btn btn-ghost" id="acPasteBtn" type="button">Fill the boxes</button></div>
        <p class="note" id="acPasteNote" role="status"></p>
      </details>
      <details>
        <summary>Typing shortcuts</summary>
        <p class="note">You can click the buttons above, or type these. The preview under each box shows what students will see.</p>
        <table class="ac-cheat">
          <tr><th>Type</th><th>Students see</th><th>Type</th><th>Students see</th></tr>
          ${[["3/4", "2 3/4"], ["(x+1)/3", "x^2"], ["10^-3", "2^(n+1)"], ["sqrt(49)", "cbrt(8)"], ["0.1[6]", "1.5 x 10^6"], ["x != 5", "x <= 3"], ["y >= 2", "~= 3.14"],
             ["+-4", "3 * 4"], ["12 div 4", "2pi"], ["45deg", "angle ABC"], ["triangle ABC", "seg AB"], ["ray AB", "line AB"], ["AB perp CD", "AB para CD"], ["cong", "a. 5 (Enter) b. 7"]]
            .map((r) => "<tr>" + r.map((c) => `<td><code>${F.esc(c)}</code></td><td>${F.html(c.replace(" (Enter) ", "\n"))}</td>`).join("") + "</tr>").join("")}
        </table>
        <p class="note">A slash between two numbers always makes a fraction. For a plain slash (like mi∕hr), use the <b>∕</b> button.
          Press Enter inside a box to put part of an answer on a new line.</p>
      </details>
      <div class="ac-save-row">
        <button class="btn btn-primary" id="acSave" type="button">Save and show students</button>
        <button class="btn btn-ghost" id="acClear" type="button">Clear all</button>
        <span class="note" id="acDirty" role="status"></span>
      </div>
      <p class="error" id="acErr" role="alert"></p>`;

    // ---------- 30 boxes ----------
    const inputs = [], previews = [], fields = [];
    for (let k = 0; k < N; k++) {
      const f = document.createElement("div");
      f.className = "ac-field";
      f.innerHTML = `<b>${k + 1}</b><textarea rows="1" maxlength="${MAX}" aria-label="Answer ${k + 1}" spellcheck="false" autocomplete="off"></textarea><div class="ac-prev" aria-hidden="true"></div>`;
      $("acFields").appendChild(f);
      const ta = f.querySelector("textarea");
      ta.addEventListener("input", () => { preview(k); grow(ta); markDirty(); });
      ta.addEventListener("focus", () => { last = k; $("acTarget").textContent = `Adds to box ${k + 1}`; });
      inputs.push(ta); previews.push(f.querySelector(".ac-prev")); fields.push(f);
    }
    const lessonIn = $("acLessonIn");
    lessonIn.addEventListener("input", markDirty);

    function grow(ta) { ta.style.height = "auto"; ta.style.height = Math.max(40, ta.scrollHeight + 4) + "px"; }
    function preview(k) { previews[k].innerHTML = inputs[k].value.trim() ? F.html(inputs[k].value) : ""; }

    // ---------- Toolbar ----------
    let last = 0;
    const tools = $("acTools");
    for (const g of F.TOOLS) {
      const grp = document.createElement("div");
      grp.className = "ac-tg";
      grp.innerHTML = `<span>${g.group}</span>`;
      for (const it of g.items) {
        const b = document.createElement("button");
        b.type = "button";
        b.title = it.title || "";
        b.innerHTML = it.label === "seg AB" || it.label === "ray AB" || it.label === "line AB" ? F.html(it.label).replace(/<\/?span class="mf-line">/g, "") : F.esc(it.label);
        b.addEventListener("mousedown", (e) => e.preventDefault()); // keep the cursor in the answer box
        b.onclick = () => insert(it);
        grp.appendChild(b);
      }
      tools.appendChild(grp);
    }
    const tgt = document.createElement("span");
    tgt.className = "ac-target"; tgt.id = "acTarget"; tgt.textContent = "Click a box, then a button";
    tools.appendChild(tgt);

    function insert(it) {
      const ta = document.activeElement === lessonIn ? null : inputs[last];
      if (!ta) return;
      const a = ta.selectionStart, b = ta.selectionEnd, sel = ta.value.slice(a, b);
      let text, caret;
      if (sel && it.wrap) {
        text = it.wrap.replace("$", sel);
        caret = it.wrapAt === -1 ? text.length - 1 : text.length;
      } else {
        text = it.ins;
        caret = it.at != null ? it.at : text.length;
      }
      if ((ta.value.length - (b - a) + text.length) > MAX) return;
      ta.focus();
      ta.setRangeText(text, a, b, "end");
      ta.selectionStart = ta.selectionEnd = a + caret;
      ta.dispatchEvent(new Event("input"));
    }

    // ---------- Saved copy, unsaved changes ----------
    let saved = null, dirty = false, savedMsgUntil = 0;
    const current = () => ({ lesson: lessonIn.value.trim(), items: inputs.map((ta) => ta.value.replace(/\s+$/g, "").replace(/^\s+/g, "")) });
    function markDirty() {
      if (!saved) return;
      const c = current();
      dirty = c.lesson !== saved.lesson || c.items.some((v, k) => v !== saved.items[k]);
      fields.forEach((f, k) => f.classList.toggle("changed", c.items[k] !== saved.items[k]));
      if (dirty || Date.now() > savedMsgUntil) $("acDirty").textContent = dirty ? "You have changes students can't see yet. Click Save." : "";
    }
    function fill(d) {
      lessonIn.value = d.lesson;
      inputs.forEach((ta, k) => { ta.value = d.items[k]; preview(k); grow(ta); });
    }
    function savedNote(d) {
      const n = d.items.filter(Boolean).length;
      const when = d.changedAt ? new Date(d.changedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
      $("acSaved").textContent = `Students see ${n} of ${N} answers` + (d.lesson ? ` for ${/^\d+$/.test(d.lesson) ? "Lesson " + d.lesson : d.lesson}` : "") + (when ? `. Last saved ${when}.` : ".");
    }

    B.answers.watch((d, err) => {
      if (err) { $("acErr").textContent = err.message; return; }
      $("acErr").textContent = "";
      const first = !saved;
      saved = { lesson: d.lesson, items: d.items };
      if (first || !dirty) fill(d); // don't wipe out what the teacher is typing
      savedNote(d);
      markDirty();
    }).catch((e) => ($("acErr").textContent = e.message));

    async function save() {
      const btn = $("acSave");
      btn.disabled = true; $("acErr").textContent = "";
      const c = current();
      try {
        await B.answers.save(c);
        saved = c; dirty = false;
        savedNote(Object.assign({ changedAt: Date.now() }, c));
        markDirty();
        $("acDirty").textContent = "Saved! Students see the new answers now.";
        savedMsgUntil = Date.now() + 4000;
        setTimeout(() => { if (!dirty) $("acDirty").textContent = ""; }, 4000);
      } catch (e) { $("acErr").textContent = e.message; }
      btn.disabled = false;
    }
    $("acSave").onclick = save;
    box.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); save(); }
    });
    $("acClear").onclick = () => {
      if (!confirm("Empty all 30 boxes and the lesson? Students won't see the change until you click Save.")) return;
      lessonIn.value = "";
      inputs.forEach((ta, k) => { ta.value = ""; preview(k); grow(ta); });
      markDirty();
    };
    window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

    // ---------- Paste all ----------
    $("acPasteBtn").onclick = () => {
      const r = parsePaste($("acPasteIn").value, N);
      if (!r.count) { $("acPasteNote").textContent = "There's nothing to fill in. Paste your answers into the box first."; return; }
      r.values.forEach((v, k) => { if (v != null) { inputs[k].value = v.slice(0, MAX); preview(k); grow(inputs[k]); } });
      markDirty();
      const untouched = r.values.map((v, k) => (v == null ? k + 1 : 0)).filter(Boolean);
      $("acPasteNote").textContent = `Filled ${r.count} box${r.count === 1 ? "" : "es"}.`
        + (untouched.length && untouched.length < N ? ` ${rangeText(untouched)} weren't in your list, so they still have their old answers.` : "")
        + (r.extra ? ` ${r.extra} extra line${r.extra === 1 ? " was" : "s were"} left out (there are only ${N} boxes).` : "")
        + " Check the previews, then click Save.";
    };
  }

  // "1. 3/4" / "2) 12" / "#3: x^2" → numbered; otherwise one answer per line, in order
  function parsePaste(text, N) {
    const lines = String(text).replace(/\r/g, "").split("\n").map((l) => l.replace(/\t/g, " ").trim());
    const LABEL = /^#?\s*(\d{1,2})\s*[.):]\s+(.*)$/;
    const labeled = lines.filter((l) => LABEL.test(l)).length, nonEmpty = lines.filter(Boolean).length;
    const values = new Array(N).fill(null);
    let count = 0, extra = 0;
    if (labeled && labeled >= nonEmpty / 2) {
      let cur = -1;
      for (const l of lines) {
        if (!l) continue;
        const m = LABEL.exec(l);
        if (m && +m[1] >= 1) {
          cur = +m[1] - 1;
          if (cur >= N) { extra++; cur = -2; continue; }
          if (values[cur] == null) count++;
          values[cur] = m[2].trim();
        } else if (cur >= 0) values[cur] += "\n" + l;
      }
    } else {
      const list = lines.filter(Boolean);
      list.forEach((l, k) => { if (k < N) { values[k] = l; count++; } else extra++; });
    }
    return { values, count, extra };
  }
  function rangeText(nums) {
    const parts = [];
    for (let k = 0; k < nums.length; k++) {
      let j = k; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      parts.push(j > k ? `${nums[k]}–${nums[j]}` : `${nums[k]}`); k = j;
    }
    return (nums.length === 1 ? "Box " : "Boxes ") + parts.join(", ");
  }
  MML.answersAdmin = { parsePaste };
})();
