/* Mental Math Lab: the calculator on the Answer Check page (answers.html)
   A pocket calculator: it works LEFT TO RIGHT (2 + 3 × 4 = 20), except that anything in
   parentheses is worked out first (2 + (3 × 4) = 14). %, 1/x, √x, and x² change the number
   on the screen right away. Students can click the keys or type on the keyboard.
   Nothing is saved; a refresh clears it. */
window.MML = window.MML || {};
(function (MML) {
  const MAX_DIGITS = 12, MAX_DEPTH = 8;

  /* ---------- The math (no page needed, so it can be tested on its own) ---------- */
  function Engine() {
    let frames, cur, mode, tokens, label, labelIn, histDone, starts;
    // frames: one per open parenthesis, each { acc, op } (running total and the operator waiting for a number)
    // cur: the number on the screen, as text ("-12.5")
    // mode: "entering" (typing a number), "result" (a finished number, like after √ or ")"),
    //       "op" (just pressed + − × ÷ or "(", waiting for a number), "done" (after =), "error"
    // tokens: what has been entered so far, shown on the small line ("200", "×", "(3 + 4)")
    // label: how the number on the screen is written on that line ("√25", "15%"); labelIn: it's already the last token
    function clear() {
      frames = [{ acc: null, op: null }]; cur = "0"; mode = "entering"; tokens = []; label = null; labelIn = false; histDone = ""; starts = [];
    }
    clear();

    const top = () => frames[frames.length - 1];
    const tidy = (x) => (Object.is(x, -0) ? 0 : Number(x.toPrecision(12)));
    function fmt(x) {
      if (!isFinite(x)) return "Error";
      x = tidy(x);
      const a = Math.abs(x);
      if (a !== 0 && (a >= 1e12 || a < 1e-9)) return x.toExponential(6).replace(/\.?0+e/, "e").replace("e+", "e");
      let s = String(x);
      if (s.includes("e")) s = x.toFixed(12);
      if (s.includes(".")) {
        // round long decimals so they fit on the screen
        const whole = s.split(".")[0].replace("-", "").length;
        s = String(Number(x.toFixed(Math.max(0, MAX_DIGITS - whole))));
      }
      return s;
    }
    const num = () => Number(cur);
    const needsWrap = (L) => /[\s+×÷−-]/.test(L.replace(/^-/, "")) && !/^\(.*\)$/.test(L);
    const wrap = (L) => (needsWrap(L) ? `(${L})` : L);
    const show = (s) => String(s).replace(/-/g, "−");
    function fail() { mode = "error"; cur = "Error"; frames = [{ acc: null, op: null }]; tokens = []; starts = []; label = null; labelIn = false; histDone = ""; }
    function apply(a, op, b) {
      const r = op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : b === 0 ? NaN : a / b;
      return isFinite(r) ? tidy(r) : NaN;
    }
    // Put the number on the screen into the running total of the innermost parentheses
    function commit() {
      const f = top(), v = num();
      if (!labelIn) tokens.push(label || show(cur));
      f.acc = f.op ? apply(f.acc, f.op, v) : v;
      f.op = null;
      return !isNaN(f.acc);
    }
    function freshIfDone() { if (mode === "done" || mode === "error") { const keep = mode === "done" ? cur : "0"; clear(); cur = keep; mode = "result"; label = show(keep); } }

    const keys = {
      digit(d) {
        if (mode === "done" || mode === "error") clear();
        if (mode === "result" && labelIn) keys.op("×"); // (3 + 4)5 means (3 + 4) × 5
        if (mode !== "entering") { cur = d === "." ? "0." : d; mode = "entering"; label = null; labelIn = false; return; }
        if (d === "." && cur.includes(".")) return;
        if (cur.replace(/[-.]/g, "").length >= MAX_DIGITS) return;
        if (cur === "0" && d !== ".") cur = d;
        else if (cur === "-0" && d !== ".") cur = "-" + d;
        else cur += d;
        label = null;
      },
      op(o) {
        if (mode === "error") return;
        if (mode === "done") freshIfDone();
        const f = top();
        if (mode === "op") {
          // changed their mind: 5 + × → 5 ×
          if (f.op && tokens.length && "+−×÷".includes(tokens[tokens.length - 1])) { f.op = o; tokens[tokens.length - 1] = o; }
          // right after "(", − starts a negative number: (−3 + 5)
          else if (o === "−") { cur = "-0"; mode = "entering"; label = null; }
          return;
        }
        if (!commit()) return fail();
        f.op = o; tokens.push(o);
        cur = fmt(f.acc); mode = "op"; label = null; labelIn = false;
      },
      open() {
        if (mode === "error" || mode === "done") clear();
        if (frames.length > MAX_DEPTH) return;
        // a number right before "(" means times: 2(3 + 4) = 2 × (3 + 4)
        if (mode === "result" || (mode === "entering" && !(cur === "0" && !tokens.length))) {
          keys.op("×");
          if (mode === "error") return;
        }
        starts.push(tokens.length); tokens.push("(");
        frames.push({ acc: null, op: null });
        mode = "op"; label = null; labelIn = false;
      },
      close() {
        if (frames.length < 2 || mode === "error") return;
        const f = top();
        if (mode === "op") {
          if (f.acc == null) return;                 // "()" with nothing inside
          tokens.pop(); f.op = null;                 // (3 + ) → (3)
        } else if (!commit()) return fail();
        frames.pop();
        const s = starts.pop();
        const group = "(" + tokens.slice(s + 1).join(" ") + ")";
        tokens.splice(s, tokens.length - s, group);
        cur = fmt(f.acc); mode = "result"; label = group; labelIn = true;
      },
      // %, 1/x, √x, x², (−): change the number on the screen
      fn(name) {
        if (mode === "error") return;
        if (name === "neg" && (mode === "entering" || mode === "op")) {
          if (mode === "op") { cur = "-0"; mode = "entering"; label = null; return; }
          cur = cur.startsWith("-") ? cur.slice(1) : "-" + cur;
          if (label) label = null;
          return;
        }
        if (mode === "done") freshIfDone();
        const v = num();
        const L = label || show(cur);
        let r, nl;
        if (name === "pct") { r = v / 100; nl = wrap(L) + "%"; }
        else if (name === "inv") { r = v === 0 ? NaN : 1 / v; nl = "1/" + wrap(L); }
        else if (name === "sqrt") { r = v < 0 ? NaN : Math.sqrt(v); nl = "√" + wrap(L); }
        else if (name === "sq") { r = v * v; nl = (L.startsWith("−") || needsWrap(L) ? `(${L.replace(/^\((.*)\)$/, "$1")})` : L) + "²"; }
        else if (name === "neg") { r = -v; nl = "−" + wrap(L); }
        if (!isFinite(r)) return fail();
        cur = fmt(r);
        if (cur === "Error") return fail();
        if (labelIn) tokens[tokens.length - 1] = nl;
        label = nl; mode = "result";
      },
      back() {
        if (mode !== "entering") return;
        cur = cur.slice(0, -1);
        if (cur === "" || cur === "-") cur = "0";
      },
      equals() {
        if (mode === "error" || mode === "done") return;
        // close any parentheses that are still open
        while (frames.length > 1) {
          if (mode === "op" && top().acc == null) { frames.pop(); tokens.splice(starts.pop()); continue; } // an empty "(" is dropped
          keys.close();
          if (mode === "error") return;
        }
        const f = top();
        if (mode === "op") { if (f.op) { tokens.pop(); f.op = null; } }
        else if (!commit()) return fail();
        if (f.acc == null) return;
        const r = fmt(f.acc);
        if (r === "Error") return fail();
        histDone = tokens.join(" ") + " =";
        frames = [{ acc: null, op: null }]; tokens = []; starts = [];
        cur = r; mode = "done"; label = null; labelIn = false;
      },
      clear,
    };

    return {
      press(k) {
        if (/^[0-9.]$/.test(k)) keys.digit(k);
        else if ("+−×÷".includes(k) && k.length === 1) keys.op(k);
        else if (k === "(") keys.open();
        else if (k === ")") keys.close();
        else if (k === "=") keys.equals();
        else if (k === "C") keys.clear();
        else if (k === "⌫") keys.back();
        else if (k === "%") keys.fn("pct");
        else if (k === "1/x") keys.fn("inv");
        else if (k === "√x") keys.fn("sqrt");
        else if (k === "x²") keys.fn("sq");
        else if (k === "(−)") keys.fn("neg");
      },
      // What the screen shows: the big number, and the small line above it
      screen() {
        // what's been entered, plus a number changed by %, 1/x, √x, or x² (like √25) that isn't on the line yet
        const parts = mode === "result" && label && !labelIn ? tokens.concat(label) : tokens;
        const line = (mode === "done" ? histDone : parts.join(" ")).replace(/\( /g, "(");
        return { big: show(cur), line, open: frames.length - 1, error: mode === "error" };
      },
      value: () => (mode === "error" ? NaN : num()),
    };
  }

  /* ---------- The calculator on the page ---------- */
  const LAYOUT = [
    ["C", "fn green"], ["⌫", "fn"], ["(", "fn"], [")", "fn"],
    ["%", "fn"], ["1/x", "fn green"], ["√x", "fn"], ["x²", "fn"],
    ["7"], ["8"], ["9"], ["÷", "op"],
    ["4"], ["5"], ["6"], ["×", "op"],
    ["1"], ["2"], ["3"], ["−", "op"],
    ["(−)"], ["0"], ["."], ["+", "op"],
    ["=", "op eq"],
  ];
  const NAMES = { "⌫": "Delete last digit", "1/x": "One over x", "√x": "Square root", "x²": "Squared", "(−)": "Make negative or positive", "C": "Clear", "%": "Percent", "÷": "Divide", "×": "Times", "−": "Minus", "+": "Plus", "=": "Equals", "(": "Open parenthesis", ")": "Close parenthesis" };
  const KEYMAP = { "+": "+", "-": "−", "*": "×", "x": "×", "X": "×", "/": "÷", "÷": "÷", "×": "×", "Enter": "=", "=": "=", "Backspace": "⌫", "Escape": "C", "Delete": "C", "(": "(", ")": ")", "%": "%", ".": ".", ",": "." };

  function mount() {
    let box = document.getElementById("acCalc");
    if (!box) { // an older answers.html without the calculator spot
      const grid = document.getElementById("acGrid");
      if (!grid) return;
      box = document.createElement("aside"); box.id = "acCalc"; box.className = "ac-calc";
      const body = document.createElement("div"); body.className = "ac-body";
      grid.before(body); body.append(grid, box);
      const st = document.getElementById("acStatus"); if (st) grid.before(st);
    }
    box.setAttribute("aria-label", "Calculator");
    box.innerHTML = `<div class="ac-calc-in">
        <p class="ac-calc-title">Calculator</p>
        <div class="ac-calc-screen">
          <div class="ac-calc-line" aria-hidden="true"></div>
          <div class="ac-calc-big" role="status" aria-live="polite">0</div>
        </div>
        <div class="ac-calc-keys"></div>
        <p class="ac-calc-hint">Works left to right: 2 + 3 × 4 = 20. Use ( ) to do a part first.</p>
      </div>`;
    const E = Engine(), keysBox = box.querySelector(".ac-calc-keys"), buttons = {};
    for (const [k, cls] of LAYOUT) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "ac-key " + (cls || "num");
      b.innerHTML = k === "x²" ? "x<sup>2</sup>" : k;
      if (NAMES[k]) b.setAttribute("aria-label", NAMES[k]);
      b.addEventListener("mousedown", (e) => e.preventDefault()); // don't move focus off the cards
      b.onclick = () => press(k);
      keysBox.appendChild(b); buttons[k] = b;
    }
    const big = box.querySelector(".ac-calc-big"), line = box.querySelector(".ac-calc-line");
    function draw() {
      const s = E.screen();
      big.textContent = s.big;
      big.classList.toggle("err", s.error);
      big.style.fontSize = s.big.length > 13 ? "1.45rem" : s.big.length > 10 ? "1.9rem" : "";
      line.textContent = s.line.length > 32 ? "…" + s.line.slice(-31) : s.line; // keep the newest part in view
      line.title = s.line;
      buttons[")"].classList.toggle("ready", s.open > 0);
      buttons[")"].setAttribute("aria-label", s.open ? `Close parenthesis (${s.open} open)` : "Close parenthesis");
    }
    function press(k) { E.press(k); draw(); }
    function flash(k) {
      const b = buttons[k]; if (!b) return;
      b.classList.add("down"); setTimeout(() => b.classList.remove("down"), 120);
    }
    // Keyboard: works anywhere on the page, except Enter/Space on a focused button (like Reveal answer)
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.key === "Enter" || e.key === " ") && t && t.tagName === "BUTTON" && !t.classList.contains("ac-key")) return;
      if (calcHidden()) return;
      const k = /^[0-9]$/.test(e.key) ? e.key : KEYMAP[e.key];
      if (!k) return;
      e.preventDefault();
      press(k); flash(k);
    });

    // Narrow screens: a button in the corner opens and closes the calculator
    const toggle = document.createElement("button");
    toggle.type = "button"; toggle.className = "ac-calc-toggle"; toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "🧮 Calculator";
    toggle.onclick = () => {
      const open = !box.classList.contains("open");
      box.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "✕ Close calculator" : "🧮 Calculator";
    };
    document.body.appendChild(toggle);
    const narrow = window.matchMedia("(max-width: 899px)");
    const calcHidden = () => narrow.matches && !box.classList.contains("open");
    draw();
  }

  MML.answerCalc = { Engine };
  if (typeof document !== "undefined" && document.addEventListener) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  }
})(window.MML);
