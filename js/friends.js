/* Mental Math Lab: Friends page
   Students add each other by username. A request has to be accepted before two
   students are friends. There's no chat: the only things students can send each
   other are friend requests. The teacher can see and remove any friendship. */
(async function () {
  const B = MML.backend, AV = MML.avatar;
  const $ = (id) => document.getElementById(id);
  const user = await B.requireStudent();
  MML.siteLock.start(user);
  MML.help.mount(document.querySelector(".nav"));

  let prog;
  try { prog = await B.loadProgress(user.uid); }
  catch (e) { $("loading").textContent = e.message; return; }
  AV.applySite(prog.avatar.site);
  await B.people.sync(user, prog.avatar);
  $("myName").textContent = user.profile.username;
  $("loading").hidden = true; $("main").hidden = false;

  let list = [], people = {}, busy = false;
  const nameOf = (uid) => (people[uid] ? people[uid].name : "A classmate");

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.hidden = true), 2200);
  }

  async function refresh() {
    if (busy) return;
    try {
      list = await B.friends.list(user);
      people = await B.people.get([...new Set(list.map((f) => f.other))]);
      $("err").textContent = "";
    } catch (e) { $("err").textContent = e.message; }
    render();
  }

  function shipFor(uid, size) {
    const p = people[uid];
    const av = p ? p.avatar : AV.defaults();
    return AV.miniCanvas(av, size, { theme: av.theme, flame: 12 });
  }
  function gradeChip(uid) {
    const g = document.createElement("span");
    g.className = "grade-chip"; g.textContent = people[uid] ? `Grade ${people[uid].grade}` : "";
    return g;
  }

  function render() {
    const incoming = list.filter((f) => f.status === "pending" && f.to === user.uid).sort((a, b) => b.at - a.at);
    const friends = list.filter((f) => f.status === "accepted" && people[f.other])
      .sort((a, b) => (people[b.other].online - people[a.other].online) || nameOf(a.other).localeCompare(nameOf(b.other)));
    const sent = list.filter((f) => f.from === user.uid && f.status !== "accepted");

    // Friend requests
    $("reqPanel").hidden = !incoming.length;
    const rl = $("reqList"); rl.innerHTML = "";
    for (const f of incoming) {
      const li = document.createElement("li");
      const who = document.createElement("div"); who.className = "req-who";
      const nm = document.createElement("b"); nm.textContent = nameOf(f.other);
      who.append(nm, " ", gradeChip(f.other));
      const acts = document.createElement("div"); acts.className = "actions";
      const yes = document.createElement("button"); yes.type = "button"; yes.className = "btn btn-primary"; yes.textContent = "Accept";
      const no = document.createElement("button"); no.type = "button"; no.className = "btn btn-ghost"; no.textContent = "No thanks";
      yes.onclick = () => answer(f, true, [yes, no]);
      no.onclick = () => answer(f, false, [yes, no]);
      acts.append(yes, no);
      li.append(shipFor(f.other, 52), who, acts);
      rl.appendChild(li);
    }

    // Requests this student sent that haven't been accepted yet
    $("sentBox").hidden = !sent.length;
    const sl = $("sentList"); sl.innerHTML = "";
    for (const f of sent) {
      const li = document.createElement("li"); li.textContent = nameOf(f.other);
      sl.appendChild(li);
    }

    // Friends
    const online = friends.filter((f) => people[f.other].online).length;
    $("friendCount").textContent = friends.length ? `${friends.length} friend${friends.length > 1 ? "s" : ""}, ${online} online` : "";
    const grid = $("palGrid"); grid.innerHTML = "";
    if (!friends.length) {
      const e = document.createElement("div"); e.className = "pal-empty";
      e.innerHTML = "<p><b>No friends yet.</b></p><p>Ask a classmate for their username, type it in <b>Add a friend</b>, and they'll see your request the next time they're on the site.</p>";
      grid.appendChild(e);
      return;
    }
    for (const f of friends) {
      const p = people[f.other];
      const card = document.createElement("article"); card.className = "pal" + (p.online ? " on" : "");
      const bay = document.createElement("div"); bay.className = "pal-bay"; bay.appendChild(shipFor(f.other, 96));
      const bg = AV.item("theme", p.avatar.theme).bg; // fill the rest of the bay with the friend's game background
      bay.style.background = Array.isArray(bg) ? `linear-gradient(${bg.join(", ")})` : bg;
      const body = document.createElement("div"); body.className = "pal-body";
      const nm = document.createElement("h3"); nm.textContent = p.name;
      const st = document.createElement("p"); st.className = "pal-status";
      st.innerHTML = `<span class="dot" aria-hidden="true"></span>${p.online ? "Online now" : "Offline"}`;
      const rm = document.createElement("button"); rm.type = "button"; rm.className = "mini"; rm.textContent = "Remove";
      rm.onclick = () => remove(f, rm);
      body.append(nm, gradeChip(f.other), st, rm);
      card.append(bay, body);
      grid.appendChild(card);
    }
  }

  async function answer(f, accept, buttons) {
    buttons.forEach((b) => (b.disabled = true));
    busy = true;
    try {
      await B.friends.answer(user, f.id, accept);
      toast(accept ? `You and ${nameOf(f.other)} are friends now!` : "Request removed");
    } catch (e) { toast(e.message); }
    busy = false;
    refresh();
  }

  async function remove(f, btn) {
    if (!confirm(`Remove ${nameOf(f.other)} from your friends? You can add each other again later.`)) return;
    btn.disabled = true; busy = true;
    try { await B.friends.remove(user, f.id); toast(`Removed ${nameOf(f.other)}`); }
    catch (e) { toast(e.message); btn.disabled = false; }
    busy = false;
    refresh();
  }

  $("addForm").onsubmit = async (e) => {
    e.preventDefault();
    const typed = $("addName").value.trim(), msg = $("addMsg");
    if (!typed) return;
    const say = (text, good) => { msg.textContent = text; msg.className = "add-msg " + (good ? "good" : "bad"); };
    if (list.filter((f) => f.status === "accepted" || f.from === user.uid).length >= B.maxFriends)
      return say(`You've reached ${B.maxFriends} friends and requests. Remove someone to add someone new.`);
    $("addBtn").disabled = true; busy = true;
    say("Looking…", true);
    try {
      const r = await B.friends.request(user, typed);
      const nm = r.person ? r.person.name : "";
      if (r.kind === "notfound") say(`There's no student with the username "${typed}". Check the spelling. If it's right, your friend may need to log in once first.`);
      else if (r.kind === "self") say("That's your own username!");
      else if (r.kind === "already") say(`You and ${nm} are already friends.`);
      else if (r.kind === "waiting") say(`Your request to ${nm} is still waiting for them to accept.`, true);
      else if (r.kind === "accepted") { say(`${nm} had already asked you, so you're friends now!`, true); $("addName").value = ""; }
      else { say(`Friend request sent to ${nm}!`, true); $("addName").value = ""; }
    } catch (err) { say(err.message); }
    $("addBtn").disabled = false; busy = false;
    refresh();
  };

  await refresh();
  // Keep the online dots fresh while the page is showing
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
})();
