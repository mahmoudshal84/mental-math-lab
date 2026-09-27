# Mental Math Lab

Mental math games for grades 6–8: Lane Runner, Type to Blast, Running Total, Number Line,
Make the Target, and Class Boss Battle. Student accounts, stars, leaderboards, and a ship shop.
Runs on free services: GitHub Pages (the website) and Firebase (logins and data).

## Try it first (demo mode)

Until you add your Firebase settings, the site runs in **demo mode**: everything saves in the
browser, and sample classmates fill the leaderboards so you can see how they look.

Unzip, then double-click `index.html`.

- Student login: **SamD** / **demo123**
- Teacher login: `admin.html`, any email and password

## Go live

You need three things: the site files (hosted on GitHub Pages), a Firebase project (logins and saved data),
and your admin account's ID copied into three places. Budget about 45 minutes the first time.

### Part A. Create the Firebase project
1. Go to console.firebase.google.com → **Create a project**. Name it (e.g. `mental-math-lab`). Turn **off** Google Analytics.
2. **Build → Authentication → Get started → Sign-in method → Email/Password →** turn on the first switch → **Save**.
3. **Authentication → Users → Add user.** Enter your own email and a strong password. This is your teacher login.
   Copy the **User UID** shown in the list (a long code). This is your *admin UID*.
4. **Build → Firestore Database → Create database.** Pick a location near you (e.g. `nam5 (United States)`,
   which can't be changed later) and **production mode**.
5. **Build → Realtime Database → Create database.** Pick **United States** and **Start in locked mode**.
6. **Project settings** (gear icon) **→ General → Your apps →** the **</>** (Web) button. Name it, leave
   "Firebase Hosting" unchecked, **Register app**. Copy the `firebaseConfig = { ... }` block it shows.
   It should include a `databaseURL` line. If it doesn't, copy the link at the top of the Realtime Database page.

### Part B. Fill in the files (before uploading)
1. `js/config.js`: replace `firebase: null` with `firebase: { ...everything between the braces you copied... }`
   (make sure `databaseURL` is in there), and replace `PASTE_YOUR_ADMIN_UID_HERE` with your admin UID.
2. `firestore.rules`: replace `PASTE_YOUR_ADMIN_UID_HERE` with your admin UID.
3. `database.rules.json`: replace `PASTE_YOUR_ADMIN_UID_HERE` with your admin UID.

### Part C. Publish the security rules
1. Firebase console → **Firestore Database → Rules** tab. Delete what's there, paste all of `firestore.rules`, **Publish**.
2. **Realtime Database → Rules** tab. Delete what's there, paste all of `database.rules.json`, **Publish**.

### Part D. Put the site on GitHub Pages
1. github.com → **New repository** → name it `mental-math-lab` → **Public** → **Create repository**.
2. Click **uploading an existing file**. Open the unzipped `mental-math-lab` folder and drag everything inside it
   (all the files plus the `css` and `js` folders) onto the page. **Commit changes.**
3. Repository **Settings → Pages →** Source: **Deploy from a branch**, Branch: **main**, folder **/ (root)** → **Save**.
4. Wait a minute or two, refresh, and your address appears: `https://YOUR-USERNAME.github.io/mental-math-lab/`

(Vercel works too: **Add New → Project →** import the repository, Framework **Other**, no build command, **Deploy**.
Use it if your school's filter blocks github.io. Then use the vercel.app address in Part E.)

### Part E. Allow your site in Firebase
Firebase console → **Authentication → Settings → Authorized domains → Add domain →** `YOUR-USERNAME.github.io`.

### Part F. Test it
1. Open `https://YOUR-USERNAME.github.io/mental-math-lab/admin.html` and log in with your teacher email and password.
   The yellow "Demo mode" bar should be gone.
2. Add one test student, then open the site in an incognito window and log in as that student.
3. Play a round. The end screen should say **Saved**. Check the Leaderboards.
4. Start a short boss battle from the admin page and join it as the test student.
5. Try **Lock the site** and watch the student window lock within a few seconds. Then open it again.
6. Try it on a school Chromebook on the school network, to make sure the filter allows it.
7. Add your real students (bulk add is fastest) and print login cards.

### Updating the site later
Upload the changed files to the repository the same way (**Add file → Upload files**); files with the same name are replaced.
Keep your filled-in `js/config.js`. If a new version changes `firestore.rules` or `database.rules.json`,
put your admin UID in and publish them again.

Your Firebase settings in `js/config.js` are meant to be public; the security rules are what protect the data.

## Files

| File | What it does |
|---|---|
| `index.html`, `js/hub.js` | Student login and home page |
| `play.html`, `js/game-shell.js` | Runs every game: lives, streaks, the answered counter, stars, saving |
| `js/game-lane.js`, `game-blast.js`, `game-total.js`, `game-line.js`, `game-target.js` | The five games |
| `js/boss-maker.js` | Cleans up scanned drawings for boss drawings |
| `js/help.js` | The Help guide for students |
| `js/lock.js` | The lock screen students see when you close the site or Arcade |
| `js/games.js` | Game names, which topics each game supports, answers needed for stars |
| `boss.html`, `js/boss.js`, `js/boss-art.js` | Class Boss Battle (student view, and `boss.html?screen=1` for the projector) |
| `lane-runner.html` | Forwards old Lane Runner links to `play.html` |
| `hangar.html`, `js/hangar.js` | Ship shop |
| `leaderboards.html`, `js/leaderboards.js` | Leaderboards |
| `admin.html`, `js/admin.js` | Teacher admin page |
| `js/problems.js` | All the math problems and the arcade mixes |
| `js/progress.js` | Rules for stars, XP, unlocking, weekly stats |
| `js/avatar.js` | Shop items, prices, and ship drawing |
| `js/backend.js` | Firebase connection (and demo mode) |
| `js/config.js` | Your Firebase settings |
| `firestore.rules` | Firestore security rules |
| `database.rules.json` | Realtime Database rules (boss battles) |

## How things work

- **Games and topics:** Lane Runner and Type to Blast work with every topic. Running Total and Number Line
  work with Quick facts, Integers, Fractions & percents, and Exponents. Make the Target works with Quick facts and Integers.
- **Levels are rounds:** 20 questions in Lane Runner, Type to Blast, and Number Line, 10 in Running Total,
  and 8 in Make the Target. The round ends with "Level complete!" after the last question. To change a game's round length, edit its `round` number in `js/games.js`.
- **Stars:** every level round starts with 3 stars at the top of the screen. The first miss is free; the 2nd, 3rd,
  and 4th misses each empty a star. There are no lives in level rounds, so students always finish, and they keep the
  stars left at the end. At least 1 star unlocks the next level. Each game has its own stars. (Lives and shields are Arcade only.)
  Each star is worth 10 XP × the level number. XP only comes from stars.
- **Unlocking:** a star on level N in any game opens level N + 1.
- **Question counter:** the top of every game shows "Question 8 of 20" and how many were right, with a progress bar.
  In Arcade it shows the total answered.
- **Weekly boards** reset Monday. All-time boards never reset.
- **Leaderboards:** three boards side by side: grade XP, grade Arcade record, and school Arcade record,
  with buttons to switch Arcade games and between this week and all time.
- **Help:** a Help button on the student home page, Hangar, and Leaderboards explains the whole site.
- **Arcade** exists for every game. It's endless and gets harder over time. Each game has its own boards;
  grade mix feeds the grade boards and school mix feeds the school board.
- **Site access (admin page, top):** "Lock the site" shows students a message instead of the games, on every page,
  within a couple of seconds. A run in progress ends and is saved. You can write your own message.
  "Lock Arcade" closes only Arcade; levels still work. A brand-new site starts open,
  so click "Lock the site" once after setup if you want it closed outside class.
  Boss battles need the site open.
- **Boss trophies:** each student's home page shows the bosses their class has beaten in battles they joined,
  which levels, their own damage against each boss (total, and their best single battle), and their recent battles.
  Damage from battles the class lost still counts. Students only ever see their own damage on the shelf.
- **Boss drawings (admin page):** each of the six bosses can use a student's drawing instead of the built-in art.
  Click "Upload drawing" on a boss's card and upload up to 3 poses that loop (1 → 2 → 3 → 2), so the boss looks
  animated. The paper is removed automatically; use the slider and checkboxes under the preview if it needs help.
  The drawing is used in every battle against that boss, on the projector, and on every student's trophy shelf,
  with "Drawn by ..." credit. "Use built-in art" switches back. Pictures are stored in Firestore (usually 50–400 KB
  per boss, plus small copies for the trophy shelf), so no paid Firebase storage is needed.
- **Website backgrounds:** students can buy a background for the whole site in the Hangar (the "Website" tab).
  "Game background" is the separate one used inside the games.
- **Boss battles:** start one from the admin page (pick a topic, level, how many students, and minutes).
  Boss health is set from those numbers. Right answers deal 10 damage (20 or 30 on a streak); wrong answers heal
  the boss 5. Students who get at least 5 right in a won battle earn a 50 coin bonus.
- **Coins** come from right answers in any mode and buy items in the Hangar (cosmetic only).
- **Passwords** are stored where only your admin account can read them, so you can look them up.
  This is intentionally simple, not bank-level security.
