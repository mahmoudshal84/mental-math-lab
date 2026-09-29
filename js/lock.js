/* Mental Math Lab: site lock
   Watches the teacher's settings and covers the page with a message when the
   site (or Arcade, on Arcade pages) is closed. The teacher is never locked out.
   Use: MML.siteLock.start(user, { arcade: true/false, onLock(kind), onSettings(s) }) */
window.MML = window.MML || {};
MML.siteLock = {
  current: { open: true, arcadeOpen: true, message: "" },
  start(user, hooks = {}) {
    if (!user || user.isAdmin) return;
    const B = MML.backend;
    if (B.people) B.people.heartbeat(user); // keeps the "Online now" dot on the Friends page up to date
    let box = null, shownKind = null;

    function show(kind, s) {
      const note = hooks.onLock ? hooks.onLock(kind) : "";
      if (!box) {
        box = document.createElement("div");
        box.className = "overlay lock-screen";
        box.setAttribute("role", "alertdialog");
        box.setAttribute("aria-labelledby", "lockTitle");
        box.innerHTML = `<div class="card"><div class="lock-icon" aria-hidden="true">🔒</div>
          <h1 id="lockTitle"></h1><p id="lockMsg"></p><p class="note" id="lockNote" hidden></p>
          <div class="actions" id="lockActions"></div></div>`;
        document.body.appendChild(box);
      }
      box.querySelector("#lockTitle").textContent = kind === "site" ? "Mental Math Lab is closed right now" : "Arcade is closed right now";
      box.querySelector("#lockMsg").textContent = kind === "site"
        ? s.message || "Your teacher will open it during class. Check back then!"
        : "Your teacher has closed Arcade for now. You can still play levels.";
      const n = box.querySelector("#lockNote");
      n.textContent = note || ""; n.hidden = !note;
      const acts = box.querySelector("#lockActions");
      acts.innerHTML = "";
      if (kind === "site") {
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn btn-ghost"; b.textContent = "Log out";
        b.onclick = async () => { await B.logout(); location.href = "index.html"; };
        acts.appendChild(b);
      } else {
        const a = document.createElement("a");
        a.className = "btn btn-primary"; a.href = "index.html"; a.textContent = "Back to games";
        acts.appendChild(a);
      }
      box.hidden = false;
      shownKind = kind;
    }
    function hide() { if (box) box.hidden = true; shownKind = null; }

    B.settings.watch((s) => {
      MML.siteLock.current = s;
      if (hooks.onSettings) hooks.onSettings(s);
      const kind = !s.open ? "site" : hooks.arcade && !s.arcadeOpen ? "arcade" : null;
      if (kind) { if (kind !== shownKind) show(kind, s); else box.querySelector("#lockMsg").textContent = kind === "site" ? s.message || "Your teacher will open it during class. Check back then!" : box.querySelector("#lockMsg").textContent; }
      else hide();
    }).catch(() => { });
  },
};
