/* Mental Math Lab: boss maker
   Turns scans or photos of student drawings into clean boss frames:
   removes the paper, crops to the drawing, lines the poses up, and shrinks them
   so they fit in the database. Runs entirely in the browser. */
window.MML = window.MML || {};
MML.bossMaker = (function () {
  const WORK = 1200;   // working size while cleaning (longest side)
  const OUT = 560;     // final size (longest side)
  const MAX_BYTES = 850000; // all frames together must stay under Firestore's 1 MB document limit

  function loadFile(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); res(im); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error(`Couldn't read ${file.name}. Use a JPG or PNG.`)); };
      im.src = url;
    });
  }

  // Draw an image into a canvas at working size; every frame uses the width of the first one
  function toCanvas(im, width) {
    const s = width ? width / im.naturalWidth : Math.min(1, WORK / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    return c;
  }

  // The paper color: the middle value of pixels around the edges
  function paperColor(d, w, h) {
    const rs = [], gs = [], bs = [], band = Math.max(4, Math.round(Math.min(w, h) * 0.03));
    const add = (x, y) => { const i = (y * w + x) * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); };
    for (let x = 0; x < w; x += 3) for (let y = 0; y < band; y += 2) { add(x, y); add(x, h - 1 - y); }
    for (let y = 0; y < h; y += 3) for (let x = 0; x < band; x += 2) { add(x, y); add(w - 1 - x, y); }
    const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
    return [med(rs), med(gs), med(bs)];
  }

  /* Make the paper see-through. strength 0 to 100: higher removes more (good for shadowy photos).
     keepInside: only remove paper connected to the edge of the page, so white that's
     surrounded by the drawing (eyes, teeth, shine) stays white. */
  function clean(c, strength, keepInside = true) {
    const ctx = c.getContext("2d"), w = c.width, h = c.height, n = w * h;
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    const [pr, pg, pb] = paperColor(d, w, h);
    const lo = 12 + strength * 0.9, hi = lo + 45;
    const A = new Float32Array(n);
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      const dist = Math.sqrt((d[i] - pr) ** 2 + (d[i + 1] - pg) ** 2 + (d[i + 2] - pb) ** 2);
      A[p] = Math.max(0, Math.min(1, (dist - lo) / (hi - lo)));
    }
    // Find the paper that touches the edge of the page (flood fill through paper-like pixels)
    let outside = null;
    if (keepInside) {
      outside = new Uint8Array(n);
      const stack = new Int32Array(n);
      let top = 0;
      const push = (p) => { if (!outside[p] && A[p] < 0.5) { outside[p] = 1; stack[top++] = p; } };
      for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      while (top) {
        const p = stack[--top], x = p % w;
        if (x > 0) push(p - 1);
        if (x < w - 1) push(p + 1);
        if (p >= w) push(p - w);
        if (p < n - w) push(p + w);
      }
    }
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      let a = A[p];
      if (outside && !outside[p]) a = 1; // inside the drawing: keep it, even if it's white
      // Remove the paper tint from soft edges so there's no white halo
      if (a > 0 && a < 1) {
        d[i] = Math.max(0, Math.min(255, (d[i] - pr * (1 - a)) / a));
        d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] - pg * (1 - a)) / a));
        d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] - pb * (1 - a)) / a));
      }
      d[i + 3] = Math.round(a * 255);
      if (a > 0.35) { const x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    ctx.putImageData(img, 0, 0);
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  /* images: loaded <img> elements (1 to 3). opts: { strength, center, keepInside }
     center = false keeps each drawing where it was on the page (best when poses were traced on top of each other).
     center = true centers each drawing and lines up the bottoms (best when poses were drawn anywhere on the page). */
  function process(images, opts = {}) {
    const strength = opts.strength ?? 40;
    const first = toCanvas(images[0]);
    const cans = images.map((im, i) => (i === 0 ? first : toCanvas(im, first.width)));
    const boxes = cans.map((c) => clean(c, strength, opts.keepInside !== false));
    if (boxes.some((b) => !b)) throw new Error("One of the pictures came out blank. Try moving the slider to the left.");
    const pad = 6;
    let W, H, place;
    if (opts.center) {
      W = Math.max(...boxes.map((b) => b.x1 - b.x0 + 1)) + pad * 2;
      H = Math.max(...boxes.map((b) => b.y1 - b.y0 + 1)) + pad * 2;
      place = (b) => [Math.round((W - (b.x1 - b.x0 + 1)) / 2), H - pad - (b.y1 - b.y0 + 1)];
    } else {
      const u = { x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)),
        x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) };
      W = u.x1 - u.x0 + 1 + pad * 2; H = u.y1 - u.y0 + 1 + pad * 2;
      place = (b) => [b.x0 - u.x0 + pad, b.y0 - u.y0 + pad];
    }
    const encode = (size, q) => {
      const s = Math.min(1, size / Math.max(W, H)), ow = Math.max(1, Math.round(W * s)), oh = Math.max(1, Math.round(H * s));
      return cans.map((c, i) => {
        const b = boxes[i], [px, py] = place(b), o = document.createElement("canvas");
        o.width = ow; o.height = oh;
        const x = o.getContext("2d");
        x.imageSmoothingQuality = "high";
        x.drawImage(c, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, px * s, py * s, (b.x1 - b.x0 + 1) * s, (b.y1 - b.y0 + 1) * s);
        let url = o.toDataURL("image/webp", q);
        if (!url.startsWith("data:image/webp")) url = o.toDataURL("image/png");
        return url;
      });
    };
    let frames, size = OUT, q = 0.85;
    for (let tries = 0; tries < 6; tries++) {
      frames = encode(size, q);
      if (frames.reduce((n, f) => n + f.length, 0) <= MAX_BYTES) break;
      size = Math.round(size * 0.85); q = Math.max(0.6, q - 0.05);
    }
    const bytes = frames.reduce((n, f) => n + f.length, 0);
    if (bytes > MAX_BYTES) throw new Error("These pictures are too detailed to store. Try fewer poses or simpler drawings.");
    return { frames, bytes };
  }

  return { loadFile, process };
})();
