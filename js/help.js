/* Mental Math Lab: help guide
   MML.help.mount(navElement) adds a "Help" button that opens a guide to the whole site.
   Numbers come from the game settings, so the guide stays accurate if they change. */
window.MML = window.MML || {};
MML.help = (function () {
  let dialog = null;

  function content() {
    const PR = MML.progress, GI = MML.gameInfo;
    const rounds = MML.roundText();
    const games = GI.order.map((g) => `<li><b>${GI[g].name}.</b> ${GI[g].blurb}</li>`).join("");
    return [
      ["🚀", "Getting started", `
        <p>Every time you play, you make three choices:</p>
        <ol><li><b>A topic</b>, like Quick facts or Integers.</li>
        <li><b>A level</b>. Level 1 is the easiest, and each level after that is harder.</li>
        <li><b>A game.</b> Every game works on the same math in a different way.</li></ol>
        <p>Then click <b>Play</b>.</p>`],
      ["🔓", "Levels and unlocking", `
        <p>Each level is one <b>round</b> of questions: ${rounds}. The bar at the top of the game shows how far you've gotten.
        Answer them all and you'll see <b>Level complete!</b> There are no lives in level rounds, so you always get to finish.</p>
        <p>At first, only level 1 of each topic is open. Earn a star on a level, in any game, and the next level unlocks.</p>`],
      ["⭐", "Stars", `
        <p>Every level round starts with <b>★★★</b> at the top of the screen.</p>
        <ul><li>Your <b>first miss is free</b>.</li>
        <li>The 2nd miss empties a star, the 3rd empties another, and the 4th empties the last one.</li></ul>
        <p>You always get to finish the round. Whatever stars are left at the end are yours, and at least 1 star unlocks the next level.
        If you click <b>End run</b> before the round is over, you don't get stars that time.</p>
        <p>Each game has its own stars for every level, so there's always another star to chase. You keep your best, so a bad run never takes stars away.</p>`],
      ["📈", "XP", `
        <p>XP only comes from <b>new</b> stars. Each new star is worth <b>10 XP × the level number</b>, so a star on level 3 is worth 30 XP.</p>
        <p>Beating your own star count on a level earns XP for the new stars only. XP puts you on your grade's XP leaderboard.</p>`],
      ["🎮", "During a game", `
        <ul>
          <li><b>Stars:</b> in a level round, misses empty your stars (see Stars above).</li>
          <li><b>Lives (Arcade only):</b> you have 3, and a wrong answer costs one. 8 right in a row gives you a shield that saves your next life.</li>
          <li><b>Streaks:</b> 5 right in a row doubles your points. 10 in a row triples them.</li>
          <li><b>Mistakes:</b> when you get one wrong, you'll see the right answer and a tip. Questions you miss come back later so you can try again.</li>
          <li><b>Pause:</b> press <kbd>Esc</kbd> anytime.</li>
          <li><b>Review:</b> at the end, "Review these" lists the questions you missed.</li>
        </ul>`],
      ["🕹️", "The games", `<ul>${games}</ul>
        <p>Not every game works with every topic. If a game is grayed out, pick a different topic.</p>`],
      ["🏆", "Arcade and leaderboards", `
        <p><b>Arcade</b> is endless and gets harder the longer you last. Every game has its own Arcade.</p>
        <ul><li><b>Grade mix:</b> problems picked for your grade. Your score goes on your grade's board.</li>
        <li><b>School mix:</b> everyone in every grade gets the same problems. Your score goes on the school board.</li></ul>
        <p>The <b>Leaderboards</b> page has three boards: your grade's XP, your grade's Arcade record, and the school's Arcade record.
        Use the buttons at the top to switch between Arcade games, or between this week and all time. This week's boards reset every Monday.</p>`],
      ["🪙", "Coins and the Hangar", `
        <p>You earn coins for right answers: 1 coin each, or 2 to 3 on a streak. Make the Target pays double.</p>
        <p>Spend coins in the <b>Hangar</b> on your ship's shape, color, decoration, and trail, a background for the games, and a background for the whole website.
        You can try anything on before you buy it.</p>
        <p>Everything in the Hangar is just for looks. It never makes the math easier or harder.</p>`],
      ["👾", "Class Boss Battles", `
        <p>Your teacher starts a battle, and everyone who clicks <b>Join the battle</b> fights the same boss together.</p>
        <ul><li>A right answer deals 10 damage, or 20 to 30 on a streak.</li>
        <li>A wrong answer heals the boss 5, so think before you click.</li>
        <li>Beat the boss before time runs out. If you got at least 5 right, you earn a 50 coin bonus.</li></ul>
        <p>Every battle you join goes on your <b>boss trophy</b> shelf on the home page. It shows which levels your class has beaten and how much damage you've dealt.
        Some bosses were drawn by students!</p>`],
      ["🔒", "When the site is closed", `
        <p>Your teacher decides when Mental Math Lab is open. If you see a lock screen, check back during class.
        Your teacher can also close just the Arcade, and you can still play levels.</p>`],
    ];
  }

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "help-dialog";
    dialog.setAttribute("aria-labelledby", "helpTitle");
    const sections = content().map(([icon, title, html], i) =>
      `<details${i === 0 ? " open" : ""}><summary><span class="help-ico" aria-hidden="true">${icon}</span>${title}</summary><div class="help-body">${html}</div></details>`).join("");
    dialog.innerHTML = `
      <div class="help-head"><h2 id="helpTitle">How Mental Math Lab works</h2>
      <button type="button" class="help-close" aria-label="Close help">✕</button></div>
      <p class="help-intro">Click any topic below to open it.</p>
      <div class="help-sections">${sections}</div>
      <div class="help-foot"><button type="button" class="btn btn-primary help-done">Got it!</button></div>`;
    document.body.appendChild(dialog);
    const close = () => dialog.close();
    dialog.querySelector(".help-close").onclick = close;
    dialog.querySelector(".help-done").onclick = close;
    dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); }); // click outside
  }

  function open() {
    if (!dialog) build();
    dialog.showModal();
    dialog.querySelector(".help-sections").scrollTop = 0;
  }

  function mount(nav) {
    if (!nav || nav.querySelector(".help-btn")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "help-btn";
    b.innerHTML = '<span aria-hidden="true">?</span> Help';
    b.onclick = open;
    nav.prepend(b);
  }

  return { mount, open };
})();
