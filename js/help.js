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
          <li><b>No pausing:</b> the game keeps going even if you switch tabs, so stay on the game until your round is over.</li>
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
      ["🤝", "Friends", `
        <p>On the <b>Friends</b> page, type a classmate's username (like MayaR) to send them a friend request.
        When they accept, you'll see each other in your friends list, along with a green dot when they're online.</p>
        <p>A red number on the <b>Friends</b> button means someone sent you a request. You can accept it or say no thanks.
        You can have up to ${MML.backend.maxFriends} friends, and you can remove a friend at any time.</p>
        <p>Your teacher can see everyone's friends list.</p>`],
      ["🏁", "Versus", `
        <p>Click <b>Play Versus</b> on the home page, pick a game, and start a match, or join one with a 4-letter room code.
        The player who starts a match can invite friends. Every match uses a mix of all six topics, levels 1 and 2.</p>
        <p><b>Blast Battle</b> is for 2 to 4 players, everyone for themselves. The same 20 problems fall on everyone's screen at the same time.
        The first player to type the answer and press Enter blasts it and gets the point. Problems that hit the ground don't count for anyone. Most points wins.</p>
        <p><b>Race to 5</b> is a team race:</p>
        <ul><li><b>Teams:</b> 1 vs 1, 2 vs 2, or 3 vs 3. Both teams need the same number of players.</li>
        <li><b>Same problems:</b> both teams get the same board, with 5 problems for each player on the team.</li>
        <li><b>Type and press Enter:</b> your answer clears whichever problem it matches. Anyone on your team can clear any problem.</li>
        <li><b>Don't guess:</b> an answer that isn't on your board freezes your typing for a moment.</li>
        <li><b>Best of 3:</b> the first team to clear its board wins the round, and the first team to win 2 rounds wins the match.</li></ul>
        <p>In both games, an answer that doesn't match anything freezes your typing for a moment, so don't guess.
        You earn 1 coin for every problem you clear or blast. Versus doesn't change your stars, XP, or leaderboard scores.</p>
        <p>Your <b>record</b> (wins and losses) is on the home page. A match counts as soon as it starts, so leaving early counts as a loss.
        In Blast Battle, a tie for first counts as a win for everyone tied.</p>`],
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
