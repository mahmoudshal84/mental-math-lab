/* Mental Math Lab: list of games (used by the hub, leaderboards, and game pages)
   round: questions in one level round. Finish the round to earn stars. Change a number to make that game's rounds shorter or longer. */
window.MML = window.MML || {};
MML.gameInfo = {
  order: ["lane", "blast", "total", "line", "target"],
  lane: { name: "Lane Runner", blurb: "Steer into the lane with the right answer. Hold space to go faster.", supports: null, round: 20 },
  blast: { name: "Type to Blast", blurb: "Type answers to blow up falling problems before they land.", supports: null, round: 20 },
  total: { name: "Running Total", blurb: "Keep a number in your head as it changes, one step at a time.", supports: ["facts", "integers", "fdp", "exponents"], round: 10 },
  line: { name: "Number Line", blurb: "Estimate where the answer lands on the number line.", supports: ["facts", "integers", "fdp", "exponents"], round: 20 },
  target: { name: "Make the Target", blurb: "Combine the numbers with +, −, ×, and ÷ to hit the target.", supports: ["facts", "integers"], round: 8 },
};

// "20 in Lane Runner, Type to Blast, and Number Line, 10 in Running Total, and 8 in Make the Target"
MML.roundText = function () {
  const GI = MML.gameInfo, groups = {};
  for (const id of GI.order) (groups[GI[id].round] = groups[GI[id].round] || []).push(GI[id].name);
  const join = (a) => (a.length < 3 ? a.join(" and ") : a.slice(0, -1).join(", ") + ", and " + a[a.length - 1]);
  const parts = Object.keys(groups).sort((a, b) => b - a).map((n) => `${n} in ${join(groups[n])}`);
  return parts.length === 1 ? parts[0].replace(/ in .*/, "") : join(parts);
};
