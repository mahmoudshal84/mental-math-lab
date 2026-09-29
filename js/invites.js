/* Mental Math Lab: Versus invites
   When a friend invites this student to a match, a card pops up in the corner with
   Join and No thanks. Invites expire after 3 minutes. Started by lock.js on pages
   that load this file (not during games or boss battles, so nobody gets interrupted). */
window.MML = window.MML || {};
MML.invites = (function () {
  const EXPIRE_MS = 3 * 60000;
  let box = null, started = false;
  const dismissed = new Set();

  function start(user) {
    if (started || !user || user.isAdmin || !MML.backend.invites) return;
    started = true;
    const B = MML.backend;
    let latest = [];
    const draw = () => {
      const here = new URLSearchParams(location.search).get("room") || (MML.versusRoom || "");
      const now = Date.now();
      const list = MML.versusBusy ? [] // no pop-ups in the middle of a race
        : latest.filter((i) => !dismissed.has(i.id) && now - i.at < EXPIRE_MS && i.code !== here && MML.siteLock.current.versusOpen !== false);
      // Old invites are tidied away quietly
      latest.filter((i) => now - i.at >= EXPIRE_MS).forEach((i) => { dismissed.add(i.id); B.invites.remove(i.id); });
      if (!box) {
        box = document.createElement("div");
        box.className = "invite-stack"; box.setAttribute("aria-live", "polite");
        document.body.appendChild(box);
      }
      box.innerHTML = "";
      for (const inv of list.slice(0, 3)) {
        const card = document.createElement("div"); card.className = "invite-card"; card.setAttribute("role", "alert");
        const p = document.createElement("p");
        const b = document.createElement("b"); b.textContent = inv.name;
        p.append("🏁 ", b, " invited you to a Versus match!");
        const acts = document.createElement("div"); acts.className = "actions";
        const join = document.createElement("a"); join.className = "btn btn-primary"; join.textContent = "Join";
        join.href = "versus.html?room=" + encodeURIComponent(inv.code);
        join.onclick = () => { B.invites.remove(inv.id); };
        const no = document.createElement("button"); no.type = "button"; no.className = "btn btn-ghost"; no.textContent = "No thanks";
        no.onclick = () => { dismissed.add(inv.id); B.invites.remove(inv.id); draw(); };
        acts.append(join, no);
        card.append(p, acts);
        box.appendChild(card);
      }
    };
    B.invites.watch(user, (list) => { latest = list; draw(); }).catch(() => { });
    setInterval(draw, 15000);
  }

  return { start };
})();
