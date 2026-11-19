/* Mental Math Lab: math formatting for Answer Check
   Turns what the teacher types into nicely drawn math:
     3/4 → stacked fraction      2 3/4 → mixed number      x^2, 10^-3, 2^(n+1) → exponents
     sqrt(49), cbrt(8) → roots    0.1[6] → repeating bar     != <= >= ~= +- * → ≠ ≤ ≥ ≈ ± ×
     pi, deg, div, perp, para, cong, sim → π ° ÷ ⊥ ∥ ≅ ~
     seg AB, ray AB, line AB, angle ABC, triangle ABC → geometry names
   Every answer is plain text when saved; this file only changes how it's shown.
   The output is HTML with everything the teacher typed escaped, so it's safe to put on a page. */
window.MML = window.MML || {};
(function (MML) {
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

  const WORDS = { pi: "π", div: "÷", perp: "⊥", para: "∥", cong: "≅", sim: "~", deg: "°" };
  const OPS = [["!=", "≠"], ["<=", "≤"], [">=", "≥"], ["~=", "≈"], ["+-", "±"], ["=>", "⇒"]];
  // Geometry words that name points written in capital letters: seg AB, ray AB, line AB, angle ABC, triangle ABC
  const GEO = { seg: [2, 2], ray: [2, 2], line: [2, 2], angle: [1, 3], triangle: [3, 3] };
  const ALNUM = /[A-Za-z0-9.]/;

  function parse(s) {
    let i = 0;
    const peek = (k = 0) => s.charAt(i + k);

    // One "piece" of math: a number or word, a (group), or a root, plus any ^exponent after it
    function operand() {
      let node = null;
      if (s.startsWith("sqrt(", i) || s.startsWith("cbrt(", i)) {
        const k = s.startsWith("cbrt", i) ? 3 : 2; i += 5;
        node = { t: "root", k, kids: seq(")") };
      } else if (peek() === "√" || peek() === "∛") {
        const k = peek() === "∛" ? 3 : 2; i++;
        const inner = operand();
        node = inner ? { t: "root", k, kids: [inner] } : { t: "text", v: k === 3 ? "∛" : "√" };
      } else if (peek() === "(") {
        i++; node = { t: "group", kids: seq(")") };
      } else if (ALNUM.test(peek())) {
        let v = "";
        while (i < s.length && ALNUM.test(peek())) v += s.charAt(i++);
        node = word(v);
      } else if (peek() === "π") {
        i++; node = { t: "atom", v: "π" };
      }
      if (!node) return null;
      return power(node);
    }

    // A run of letters and digits: numbers, variables, and the shortcut words
    function word(v) {
      // repeating decimal: 0.1[6]
      if (/\./.test(v) && /^\d*\.\d*$/.test(v) && peek() === "[") {
        const m = /^\[(\d+)\]/.exec(s.slice(i));
        if (m) { i += m[0].length; return { t: "atom", v, rep: m[1] }; }
      }
      // π and ° can be part of a fraction or exponent (π/2); ÷ ⊥ ∥ ≅ ~ can't
      if (WORDS[v]) return { t: "atom", v: WORDS[v], sym: !["pi", "deg"].includes(v) };
      const m = /^(\d+(?:\.\d+)?|\.\d+)(pi|deg)$/.exec(v);
      if (m) return { t: "atom", v: m[1] + WORDS[m[2]] };
      if (GEO[v] && peek() === " ") {
        const g = /^ ([A-Z]+)(?![A-Za-z0-9])/.exec(s.slice(i));
        if (g && g[1].length >= GEO[v][0] && g[1].length <= GEO[v][1]) { i += g[0].length; return { t: "geo", kind: v, v: g[1] }; }
      }
      return { t: "atom", v };
    }

    function power(node) {
      while (peek() === "^") {
        const save = i; i++;
        let exp = null;
        if (peek() === "(") { i++; exp = { t: "group", kids: seq(")") }; }
        else {
          const m = /^([-−+]?)(\d+(?:\.\d+)?|[A-Za-z]|π)/.exec(s.slice(i));
          if (m) { i += m[0].length; exp = { t: "atom", v: (m[1] === "-" ? "−" : m[1]) + m[2] }; }
        }
        if (!exp) { i = save; break; }
        node = { t: "sup", base: node, exp };
      }
      return node;
    }

    const fractionable = (n) => n && ["atom", "group", "sup", "root"].includes(n.t) && !n.sym;
    const startsOperand = () => ALNUM.test(peek()) || "(√∛π".includes(peek()) || s.startsWith("sqrt(", i) || s.startsWith("cbrt(", i);

    // A list of pieces, up to a closing bracket (or the end)
    function seq(end) {
      const out = [];
      while (i < s.length) {
        const c = peek();
        if (end && c === end) { i++; return out; }
        if (c === "/" && fractionable(out[out.length - 1])) {
          const save = i; i++;
          const den = startsOperand() ? operand() : null;
          if (den) {
            const num = out.pop();
            const f = { t: "frac", n: num, d: den };
            // mixed number: a whole number, one space, then a fraction of whole numbers (2 3/4)
            const sp = out[out.length - 1], whole = out[out.length - 2];
            if (sp && sp.t === "sp" && whole && whole.t === "atom" && /^\d+$/.test(whole.v)
                && num.t === "atom" && /^\d+$/.test(num.v) && den.t === "atom" && /^\d+$/.test(den.v)) { out.pop(); out.pop(); f.whole = whole.v; }
            out.push(f);
            continue;
          }
          i = save;
        }
        const op = OPS.find(([a]) => s.startsWith(a, i));
        if (op) { out.push({ t: "text", v: op[1] }); i += op[0].length; continue; }
        if (c === " ") { i++; if (!out.length || out[out.length - 1].t !== "sp") out.push({ t: "sp" }); continue; }
        if (c === "*") { i++; out.push({ t: "text", v: "×" }); continue; }
        if (c === "-") {
          // a minus sign, except for hyphens inside words (two-thirds)
          const before = s.charAt(i - 1), after = s.charAt(i + 1);
          i++; out.push({ t: "text", v: /[A-Za-z]/.test(before) && /[A-Za-z]/.test(after) ? "-" : "−" });
          continue;
        }
        const n = operand();
        if (n) { out.push(n); continue; }
        // A ^ with nothing before it, or anything else: show it as typed
        out.push({ t: "text", v: c }); i++;
      }
      return timesX(out);
    }
    return seq(null);
  }

  // "1.5 x 10^6": an x on its own between two numbers means times
  function timesX(out) {
    const num = (n) => n && ((n.t === "atom" && /^[\d.]+$/.test(n.v)) || (n.t === "sup" && num(n.base)));
    for (let k = 2; k < out.length - 2; k++) {
      const n = out[k];
      if (n.t === "atom" && n.v === "x" && out[k - 1].t === "sp" && out[k + 1].t === "sp" && num(out[k - 2]) && num(out[k + 2])) out[k] = { t: "text", v: "×" };
    }
    return out;
  }

  const inner = (n) => (n.t === "group" ? list(n.kids) : node(n));
  function list(a) { return a.map(node).join(""); }
  function node(n) {
    switch (n.t) {
      case "sp": return " ";
      case "text": return esc(n.v);
      case "atom": return esc(n.v) + (n.rep ? `<span class="mf-rep">${esc(n.rep)}</span>` : "");
      case "group": return "(" + list(n.kids) + ")";
      case "sup": return node(n.base) + `<sup class="mf-sup">${inner(n.exp)}</sup>`;
      case "root": return `<span class="mf-root">${n.k === 3 ? '<span class="mf-idx">3</span>' : ""}<span class="mf-rsign">√</span><span class="mf-rad">${list(n.kids)}</span></span>`;
      case "frac": {
        const f = `<span class="mf-frac${n.whole ? " mf-mixed" : ""}" role="math" aria-label="${esc(plain(n.n))} over ${esc(plain(n.d))}"><span class="mf-num">${inner(n.n)}</span><span class="mf-den">${inner(n.d)}</span></span>`;
        // a mixed number stays on one line: 2 and 3/4
        return n.whole ? `<span class="mf-whole">${esc(n.whole)}${f}</span>` : f;
      }
      case "geo":
        if (n.kind === "angle") return "∠" + esc(n.v);
        if (n.kind === "triangle") return "△" + esc(n.v);
        return `<span class="mf-over mf-g-${n.kind}" aria-label="${n.kind} ${esc(n.v)}">${esc(n.v)}</span>`;
    }
    return "";
  }
  // Plain words for screen readers (used inside fraction labels)
  function plain(n) {
    if (!n) return "";
    if (n.t === "group") return n.kids.map(plain).join("");
    if (n.t === "atom" || n.t === "text") return n.v + (n.rep || "");
    if (n.t === "sp") return " ";
    if (n.t === "sup") return plain(n.base) + " to the power " + plain(n.exp);
    if (n.t === "root") return (n.k === 3 ? "cube root of " : "square root of ") + n.kids.map(plain).join("");
    if (n.t === "frac") return (n.whole ? n.whole + " and " : "") + plain(n.n) + " over " + plain(n.d);
    if (n.t === "geo") return n.kind + " " + n.v;
    return "";
  }

  // One answer → HTML. Each line is its own row; "a." / "b)" at the start of a line is shown in bold.
  function html(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.trim()).filter((l, k, a) => l || (k > 0 && k < a.length - 1));
    return lines.map((line) => {
      let label = "";
      const m = /^([a-z]|[ivx]{1,4})[.)]\s+/i.exec(line);
      if (m && line.length > m[0].length) { label = `<b class="mf-label">${esc(m[1])}.</b> `; line = line.slice(m[0].length); }
      let body = "";
      try { body = list(parse(line)); } catch (e) { body = esc(line); }
      return `<span class="mf-line">${label}${body}</span>`;
    }).join("");
  }

  // Buttons for the admin toolbar. ins = text to insert; at = where the cursor goes after;
  // wrap = what to do with selected text ("$" is replaced by the selection).
  const TOOLS = [
    { group: "Build", items: [
      { label: "a/b", title: "Fraction: type the top in the first ( ) and the bottom in the second ( ). For a mixed number, type the whole number and a space first, like 2 3/4.", ins: "()/()", at: 1, wrap: "($)/()", wrapAt: -1, show: "()/()" },
      { label: "xⁿ", title: "Exponent: x^2, 10^-3, or 2^(n+1)", ins: "^()", at: 2, wrap: "^($)" },
      { label: "√", title: "Square root: sqrt(49)", ins: "sqrt()", at: 5, wrap: "sqrt($)" },
      { label: "∛", title: "Cube root: cbrt(8)", ins: "cbrt()", at: 5, wrap: "cbrt($)" },
      { label: "0.3̅", title: "Repeating decimal: put the repeating digits in [ ], like 0.1[6]", ins: "[]", at: 1, wrap: "[$]" },
      { label: "∕", title: "A plain slash that won't become a fraction (like mi∕hr)", ins: "∕" },
    ] },
    { group: "Compare", items: [
      { label: "≠", ins: "≠", title: "Not equal (or type !=)" }, { label: "≤", ins: "≤", title: "Less than or equal (or type <=)" },
      { label: "≥", ins: "≥", title: "Greater than or equal (or type >=)" }, { label: "≈", ins: "≈", title: "About equal (or type ~=)" },
    ] },
    { group: "Operations", items: [
      { label: "×", ins: "×", title: "Times (or type *)" }, { label: "÷", ins: "÷", title: "Divided by (or type div)" },
      { label: "±", ins: "±", title: "Plus or minus (or type +-)" }, { label: "·", ins: "·", title: "Multiplication dot" },
    ] },
    { group: "Symbols", items: [
      { label: "π", ins: "π", title: "Pi (or type pi)" }, { label: "°", ins: "°", title: "Degrees (or type deg, like 45deg)" },
      { label: "¢", ins: "¢", title: "Cents" }, { label: "|x|", ins: "||", at: 1, wrap: "|$|", title: "Absolute value" },
    ] },
    { group: "Geometry", items: [
      { label: "∠", ins: "∠", title: "Angle (or type angle ABC)" }, { label: "△", ins: "△", title: "Triangle (or type triangle ABC)" },
      { label: "seg AB", ins: "seg ", title: "Segment: seg AB draws a bar over AB" }, { label: "ray AB", ins: "ray ", title: "Ray: ray AB" },
      { label: "line AB", ins: "line ", title: "Line: line AB" },
      { label: "⊥", ins: "⊥", title: "Perpendicular (or type perp)" }, { label: "∥", ins: "∥", title: "Parallel (or type para)" },
      { label: "≅", ins: "≅", title: "Congruent (or type cong)" }, { label: "~", ins: "~", title: "Similar" },
    ] },
  ];

  MML.mathfmt = { html, esc, TOOLS };
})(window.MML);
