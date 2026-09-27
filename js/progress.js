/* Mental Math Lab: progress rules
   This file only does the math on a student's progress object. Saving and
   loading happen in backend.js. */
window.MML = window.MML || {};
(function (MML) {
  const STAR_MIN = 20;                 // questions in a level round (each game can set its own "round" in games.js)
  // Level stars: start a round with 3. The first miss is free, then each miss empties one: 0-1 misses = 3, 2 = 2, 3 = 1, 4+ = 0.
  const FREE_MISSES = 1;
  const IMPROVE_MIN = 30;              // answers needed this week AND last week for "most improved"
  const REVIEW_CHANCE = 0.3;
  const REVIEW_MAX = 25;
  const starXp = (level) => 10 * level; // XP per star; harder levels are worth more

  function fresh() {
    return {
      coins: 0, xp: 0, stars: {}, review: {}, bests: {}, weekStats: {},
      arcade: {}, // { lane: { grade: best, school: best }, blast: {...}, ... }
      avatar: MML.avatar.defaults(), owned: MML.avatar.freeIds(),
      settings: { sound: false, topic: "facts", level: 1 }, lastActive: null,
      bosses: [], // boss battles this student took part in: { id, topic, level, won, dmg, at }
    };
  }
  function normalize(d) {
    const f = fresh();
    if (!d) return f;
    const p = Object.assign(f, d);
    p.settings = Object.assign(fresh().settings, d.settings || {});
    // Older saves kept one Lane Runner arcade score; move it under "lane"
    p.arcade = Object.assign({}, d.arcade || {});
    if (typeof p.arcade.grade === "number" || typeof p.arcade.school === "number") {
      p.arcade = { lane: { grade: p.arcade.grade || 0, school: p.arcade.school || 0 } };
    }
    p.weekStats = Object.assign({}, d.weekStats || {});
    for (const w of Object.values(p.weekStats)) {
      w.arc = w.arc || {};
      if ("arcade" in w || "school" in w) { w.arc.lane = { g: w.arcade || 0, s: w.school || 0 }; delete w.arcade; delete w.school; }
    }
    p.bosses = Array.isArray(d.bosses) ? d.bosses.slice(-60) : [];
    p.avatar = MML.avatar.clean(d.avatar);
    p.owned = Array.from(new Set([...(d.owned || []), ...MML.avatar.freeIds()]));
    return p;
  }

  /* ---------- Weeks (reset every Monday, local time) ---------- */
  function weekId(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y = t.getUTCFullYear();
    const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
    return `${y}-W${String(w).padStart(2, "0")}`;
  }
  const prevWeekId = () => weekId(new Date(Date.now() - 7 * 86400000));
  function week(p, id = weekId()) {
    if (!p.weekStats[id]) {
      p.weekStats[id] = { xp: 0, a: 0, c: 0, arc: {} };
      const keep = [id, prevWeekId()];
      for (const k of Object.keys(p.weekStats)) if (!keep.includes(k)) delete p.weekStats[k];
    }
    return p.weekStats[id];
  }
  function improvement(p) {
    const cur = p.weekStats[weekId()], prev = p.weekStats[prevWeekId()];
    if (!cur || !prev || cur.a < IMPROVE_MIN || prev.a < IMPROVE_MIN) return null;
    return Math.round((cur.c / cur.a - prev.c / prev.a) * 1000) / 10;
  }

  /* ---------- Stars and levels ---------- */
  const starKey = (game, strand, level) => `${game}:${strand}:${level}`;
  // Stars need a finished round: every question answered, without running out of lives
  const starMin = (game) => (MML.gameInfo && MML.gameInfo[game] ? MML.gameInfo[game].round : STAR_MIN);
  // Stars left after this many misses (the round has to be finished for them to count)
  const starsFor = (wrong) => Math.max(0, Math.min(3, 3 + FREE_MISSES - wrong));
  function hasStar(p, strand, level) {
    const end = `:${strand}:${level}`;
    return Object.keys(p.stars).some((k) => k.endsWith(end) && p.stars[k] > 0);
  }
  // Levels unlock in order: a star on level N (in any game) opens level N + 1
  function unlocked(p, strand) {
    const max = MML.problems.strands[strand].levels.length;
    let n = 1;
    while (n < max && hasStar(p, strand, n)) n++;
    return n;
  }
  const totalStars = (p) => Object.values(p.stars).reduce((a, b) => a + b, 0);

  /* ---------- Problems ---------- */
  function nextProblem(p, strand, lv, recent) {
    const list = (p.review[strand] || []).filter((r) => r.level <= lv && !recent.includes(r.prompt));
    if (list.length && Math.random() < REVIEW_CHANCE) {
      const r = list[Math.floor(Math.random() * list.length)];
      return { prompt: r.prompt, answer: r.answer, wrong: r.wrong, tip: r.tip, review: true };
    }
    let q;
    for (let i = 0; i < 12; i++) { q = MML.problems.generate(strand, lv); if (!recent.includes(q.prompt)) break; }
    return q;
  }
  // opts.review = false: count it for accuracy but don't add it to the review list
  function record(p, strand, lv, q, ok, opts = {}) {
    const w = week(p);
    w.a++; if (ok) w.c++;
    if (opts.review === false) return;
    const list = (p.review[strand] = p.review[strand] || []);
    const i = list.findIndex((r) => r.prompt === q.prompt);
    if (ok) { if (i >= 0 && ++list[i].hits >= 2) list.splice(i, 1); }
    else if (i >= 0) list[i].hits = 0;
    else {
      list.unshift({ prompt: q.prompt, answer: q.answer, wrong: q.wrong, tip: q.tip, level: lv, hits: 0 });
      list.length = Math.min(list.length, REVIEW_MAX);
    }
  }

  /* ---------- End of a run ---------- */
  function finishLevel(p, game, strand, level, run) {
    const before = unlocked(p, strand);
    const stars = run.complete ? starsFor(run.answered - run.correct) : 0;
    const key = starKey(game, strand, level), prev = p.stars[key] || 0;
    let xpGained = 0;
    if (stars > prev) {
      xpGained = (stars - prev) * starXp(level);
      p.stars[key] = stars;
      p.xp += xpGained;
      week(p).xp += xpGained;
    }
    p.coins += run.coins;
    const after = unlocked(p, strand);
    return { stars, prev, best: Math.max(stars, prev), xpGained, unlockedLevel: after > before ? after : null };
  }
  function finishArcade(p, game, mix, score, coins) {
    p.coins += coins;
    const w = week(p), school = mix === "school";
    const all = (p.arcade[game] = p.arcade[game] || { grade: 0, school: 0 });
    const wk = (w.arc[game] = w.arc[game] || { g: 0, s: 0 });
    const slot = school ? "school" : "grade", wslot = school ? "s" : "g";
    const oldAll = all[slot], oldWeek = wk[wslot];
    all[slot] = Math.max(oldAll, score);
    wk[wslot] = Math.max(oldWeek, score);
    return { allTimeBest: score > oldAll && score > 0, weekBest: score > oldWeek && score > 0, week: wk[wslot], ever: all[slot] };
  }
  const weekArcade = (p, game, mix) => { const a = week(p).arc[game]; return a ? a[mix === "school" ? "s" : "g"] : 0; };

  /* ---------- Leaderboard entries written after each run ---------- */
  function boardEntries(p, profile) {
    const W = weekId(), w = week(p), g = "g" + profile.grade;
    const base = { name: profile.displayName, avatar: p.avatar, grade: profile.grade };
    const games = MML.gameInfo.order;
    const pick = (fn) => Object.fromEntries(games.map((id) => [id, fn(id)]));
    const weekly = Object.assign({}, base, { xp: w.xp, answered: w.a, correct: w.c },
      pick((id) => (w.arc[id] ? w.arc[id].g : 0)));
    const out = [
      { path: ["weeks", W, g], data: weekly },
      { path: ["alltime", g, "players"], data: Object.assign({}, base, { xp: p.xp }, pick((id) => (p.arcade[id] ? p.arcade[id].grade : 0))) },
    ];
    // School-wide boards: XP plus the school-mix Arcade scores
    const wSchool = pick((id) => (w.arc[id] ? w.arc[id].s : 0)), aSchool = pick((id) => (p.arcade[id] ? p.arcade[id].school : 0));
    if (w.xp > 0 || Object.values(wSchool).some((v) => v > 0)) out.push({ path: ["weeks", W, "school"], data: Object.assign({}, base, { xp: w.xp }, wSchool) });
    if (p.xp > 0 || Object.values(aSchool).some((v) => v > 0)) out.push({ path: ["alltime", "school", "players"], data: Object.assign({}, base, { xp: p.xp }, aSchool) });
    return out;
  }

  MML.progress = {
    STAR_MIN, FREE_MISSES, IMPROVE_MIN, fresh, normalize, weekId, prevWeekId, week, improvement,
    starKey, starsFor, starMin, unlocked, totalStars, nextProblem, record, finishLevel, finishArcade, weekArcade, boardEntries, starXp,
  };
})(window.MML);
