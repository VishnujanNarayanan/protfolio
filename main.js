/* ============================================================
   Portfolio behaviour — vanilla JS, rewritten from scratch.
   Loaded with `defer` on every page; each feature guards on the
   elements it needs, so the same file is safe on sub-pages.
   ============================================================ */
/* Per-LETTER reel structure for a CTA pill. Lives at file scope because BOTH the
   homepage (where the hero zoom also flips the letters' colour world) and every
   sub-page (hover reel only) need it — it used to be defined inside the `if
   (hero)` block, so on sub-pages the pills were plain text and hovering them did
   nothing. The roll itself is CSS on :hover; this only builds the markup. */
/* The same reel for a PLAIN text link or button — one that has no .pill-btn-span
   wrapper and no colour world to flip, so each letter needs only the hover roller
   (__col) and the identical clone (__c) rising from below. The cert gallery's Back
   button grew this inline first; the footer email link and the socials links want
   the identical effect, so it lives here once. CSS does the roll on :hover — see the
   .cert-gallery__back / .lfooter__email / .callout-socials-link block in styles.css.
   An aria-label already on the element is left alone (Back to home says something
   different from its visible text); otherwise the visible text becomes the label,
   because the letters themselves are split into aria-hidden spans. */
function buildLinkReel(el) {
  if (!el || el.querySelector(".pill-char")) return el;   // missing or already built
  var txt = el.textContent.trim();
  if (!txt) return el;
  if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", txt);
  el.textContent = "";
  for (var i = 0; i < txt.length; i++) {
    var clip = document.createElement("span");
    clip.className = "pill-char"; clip.setAttribute("aria-hidden", "true");
    clip.style.setProperty("--hd", (i * 0.022).toFixed(3) + "s");   // left→right stagger
    var col  = document.createElement("span"); col.className  = "pill-char__col";
    var face = document.createElement("span"); face.className = "pill-char__face"; face.textContent = txt[i];
    var c    = document.createElement("span"); c.className    = "pill-char__c";    c.textContent    = txt[i];
    col.appendChild(face); col.appendChild(c); clip.appendChild(col); el.appendChild(clip);
  }
  return el;
}

/* Footer email link + the three links under the socials cards get that reel. Both are
   plain <a>s, present on every page (the email) or the homepage only (the socials),
   so this runs unconditionally and no-ops on whatever is absent. */
(function buildTextLinkReels() {
  buildLinkReel(document.querySelector(".lfooter__email"));
  Array.prototype.forEach.call(document.querySelectorAll(".callout-socials-link"), buildLinkReel);
})();

function buildPillReel(pill) {
  if (!pill) return null;
  var span = pill.querySelector(".pill-btn-span"); if (!span) return null;
  if (span.querySelector(".pill-char")) return span;   // already built
  var txt = span.textContent;
  span.setAttribute("aria-label", txt); span.textContent = "";
  for (var i = 0; i < txt.length; i++) {
    var clip = document.createElement("span"); clip.className = "pill-char"; clip.setAttribute("aria-hidden", "true");
    clip.style.setProperty("--d", (i * 0.03).toFixed(3) + "s");   // world-flip stagger, no word gap
    clip.style.setProperty("--hd", (i * 0.022).toFixed(3) + "s"); // hover-reel stagger (local to the pill)
    var ch = txt[i] === " " ? " " : txt[i];
    // __col = hover roller; inside it __face (the world-flip clip: __a/__b) + __c (a same-colour
    // self-reel clone, color:inherit → always legible). Hover rolls __col up to reveal __c.
    var col = document.createElement("span"); col.className = "pill-char__col";
    var face = document.createElement("span"); face.className = "pill-char__face";
    var a = document.createElement("span"); a.className = "pill-char__a"; a.textContent = ch;
    var b = document.createElement("span"); b.className = "pill-char__b"; b.textContent = ch;
    var cl = document.createElement("span"); cl.className = "pill-char__c"; cl.textContent = ch;
    face.appendChild(a); face.appendChild(b);
    col.appendChild(face); col.appendChild(cl);
    clip.appendChild(col);
    span.appendChild(clip);
  }
  return span;   // colour is driven on the span; the __a letters inherit it
}

/* ---------- Shared TYPE-IN builder (blog intro, socials heading) ----------------
   Splits each element into per-character spans — SPACES stay plain text nodes, so the
   text still breaks across lines exactly where it did — and hides them behind
   `host.is-typing`. start() then reveals them one at a time, carrying the terminal
   block cursor along, and drops every class at the end so the markup goes back to
   plain text. Every glyph keeps its final box throughout (the reveal is opacity-only),
   so nothing reflows as the text arrives.
   runs: [{ el, step }] in typing order; opts: { gap } between runs, { hold } for how
   long the cursor keeps blinking at the end, or { keep: true } to leave it blinking at
   the end of the last line for good — a terminal sitting at its prompt. Returns null
   when there is nothing to type, so callers can treat "no type-in" as a plain absence. */
function makeTypeIn(host, runs, opts) {
  if (!host || !runs || !runs.length) return null;
  opts = opts || {};
  var gap = opts.gap == null ? 160 : opts.gap;
  var hold = opts.hold == null ? 1400 : opts.hold;
  var seq = [], at = 0, any = false;
  // Walk the element's own child NODES rather than flattening textContent: a run may
  // wrap part of itself in markup (the footer's highlighted word, a link) and that
  // wrapper has to survive with its characters still inside it.
  function split(node, step) {
    Array.prototype.slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var text = n.nodeValue, frag = document.createDocumentFragment();
        for (var i = 0; i < text.length; i++) {
          var ch = text[i];
          if (ch === " " || ch === "\n" || ch === "\t" || ch === "\u00a0") { frag.appendChild(document.createTextNode(ch)); continue; }
          var sp = document.createElement("span");
          sp.className = "wtype-c"; sp.textContent = ch;
          frag.appendChild(sp);
          seq.push({ c: sp, at: at });
          at += step;
        }
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1) split(n, step);
    });
  }
  runs.forEach(function (r) {
    if (!r.el) return;
    split(r.el, r.step);
    at += gap; any = true;
  });
  if (!any) return null;
  var runMs = seq.length ? seq[seq.length - 1].at : 0;
  host.classList.add("is-typing");
  var started = false, done = false;
  function finish() {
    if (done) return;
    done = true;
    host.classList.remove("is-typing");
    seq.forEach(function (t) { t.c.classList.remove("is-typed", "is-cursor"); });
  }
  return {
    start: function () {
      if (started || done) return;
      started = true;
      seq.forEach(function (t, i) {
        setTimeout(function () {
          if (i) seq[i - 1].c.classList.remove("is-cursor");
          t.c.classList.add("is-typed", "is-cursor");
        }, t.at);
      });
      if (!opts.keep) setTimeout(finish, runMs + hold);   // keep → the cursor stays, blinking
    },
    ms: runMs,                                      // when the last letter lands, for chaining
    reveal: finish,                                 // give up and show the text as it is
    // Put the run back to its pre-start state (letters hidden again, cursor cleared) so
    // start() types it out afresh. The spans are already split, so this is cheap — it is
    // what lets a section replay its type-in instead of the started/done latch swallowing
    // the second play.
    rearm: function () {
      if (!started) return;
      started = false; done = false;
      host.classList.add("is-typing");
      seq.forEach(function (t) { t.c.classList.remove("is-typed", "is-cursor"); });
    },
    ran: function () { return started; }
  };
}

(function () {
  "use strict";

  /* ---------- Lenis smooth scroll (CDN global: Lenis) ---------- */
  var lenis = null;
  // ?nolenis — dev switch to measure what smooth scroll costs on this page. Lenis
  // applies the scroll itself every rAF, and on a document this tall with this many
  // sticky/composited layers that work is charged to its raf callback. Loading with
  // ?nolenis falls back to native scrolling so the two can be compared directly;
  // nothing else changes, since every handler is driven by scroll position, not by
  // Lenis events.
  var noLenis = /[?&]nolenis\b/.test(location.search);
  if (typeof Lenis !== "undefined" && !noLenis && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    window.__lenis = lenis; // exposed so flow.js can drive click-to-jump
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }

  /* ---------- ?novideo — dev switch, same spirit as ?nolenis ----------
     Skips the fullscreen hero video entirely. This is what isolated the hero's frame
     cost from the rest of the page: the hero is the only section with a fullscreen
     video decoding, and loading with ?novideo is what proved it was the video and not
     the canvases or the text transition. Kept so the comparison can be re-run. */
  (function () {
    if (!/[?&]novideo\b/.test(location.search)) return;
    var hv = document.querySelector(".hero-video");
    if (hv) { hv.autoplay = false; hv.preload = "none"; try { hv.pause(); } catch (e) {} hv.removeAttribute("src"); hv.style.visibility = "hidden"; }
  })();

  /* ---------- Linux terminal boot loader + asset/animation warming ----------
     Holds an opaque "pip install" terminal over the page while the critical
     first-view assets decode and the deferred inits (Three.js bg shader,
     flow.js WebGL, Lenis, scroll listeners) finish. Resolves window.__bootReady
     when it lifts, which drives the hero entrance below. A quick minimum display
     time keeps the animation readable when assets are already cached; if assets
     are still loading it EXTENDS past the minimum until they resolve.

     ONCE PER SESSION. The loader is an intro, so it earns ~3.5s the first time a
     visitor reaches the homepage and never again: the assets it waits on are in the
     HTTP cache from then on, so replaying it on every return from /blog/ is pure
     delay. A sessionStorage flag records that it has run, which covers both routes
     in — landing on the homepage first, or arriving from an external link straight
     to a blog post and only meeting the homepage later (they still get it once, on
     that first homepage view). An explicit reload replays it, since that reads as
     asking for the page from scratch; back/forward and in-site links do not.

     HASH ON ENTRY. html.boot-active sets overflow:hidden AND height:100%, so while
     the loader is up the document cannot scroll and the browser's own jump to
     location.hash is impossible — which is why arriving from a sub-page at
     /#contact or /#socials used to dump you on the hero. The hash is re-applied
     here once the page is scrollable again (both paths, loader or not). */
  (function () {
    var bootResolve;
    window.__bootReady = new Promise(function (res) { bootResolve = res; });
    var docEl = document.documentElement;

    // Did the loader actually play this load? The header type-in below rides on the
    // loader's coat-tails (it is the first thing you see once it lifts), so it plays
    // exactly when the loader plays — once per session, not on every return from /blog/.
    window.__bootShown = false;

    var boot = document.getElementById("boot-loader");
    if (!boot) { bootResolve(); return; }

    var out    = document.getElementById("boot-out");
    var fill   = boot.querySelector(".boot-bar__fill");
    var pctEl  = boot.querySelector(".boot-bar__pct");
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var MIN_MS = reduce ? 600 : 3200;
    var start  = (window.performance && performance.now) ? performance.now() : Date.now();
    var now    = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };

    var SEEN_KEY = "vj:boot-seen";
    function seen(v) {
      try { if (v === undefined) return sessionStorage.getItem(SEEN_KEY) === "1"; sessionStorage.setItem(SEEN_KEY, "1"); }
      catch (e) { return false; }                        // private mode / storage blocked → always show
    }
    function isReload() {
      try {
        var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
        if (nav) return nav.type === "reload";
        return !!(performance.navigation && performance.navigation.type === 1);
      } catch (e) { return false; }
    }
    // Scroll to location.hash once the document can actually scroll.
    //
    // Arriving from a sub-page (/#contact, /#socials) is NOT the same as clicking the
    // same link on the homepage. The in-page case is a plain fragment scroll and always
    // worked; the cross-document case has to survive a page load, and several things
    // there will happily put you back at 0 — html.boot-active makes the document
    // unscrollable while the loader is up, so the browser's own jump to the fragment is
    // silently dropped, and Lenis keeps its own scroll value that it re-asserts every
    // frame from whatever it captured at startup.
    //
    // So this does not trust a single well-timed scroll. The hash is read ONCE at script
    // start (in case it is cleared later) and then re-asserted on a few retries until the
    // target is actually at the top — giving up the moment the visitor scrolls themselves,
    // so it can never fight a real gesture. '#top' is the spec's "top of document"
    // fragment and has no element, so it is skipped along with an empty hash.
    // The target is carried EITHER as a fragment (same-page links on the homepage) or
    // as ?go=<id> (links from a sub-page — see {{TO}} in scripts/gen-partials.mjs;
    // a fragment does not survive that cross-document trip). Read once, at script
    // start, before anything can clear it.
    var wantHash = (function () {
      var m = /[?&]go=([\w-]+)/.exec(location.search);
      return m ? "#" + m[1] : location.hash;
    })();
    var userScrolled = false;
    // pointerdown counts as "the visitor took over" too, not just scrolling. Arriving from a
    // sub-page (/?go=contact) the retries below keep re-asserting the target for ~1.5s, and a
    // CLICK on another nav anchor is a native jump the loop knew nothing about — it pulled the
    // page straight back to the arrival target, so the first click after landing appeared to do
    // nothing and only a second one, after the retries had run out, worked.
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (t) {
      addEventListener(t, function () { userScrolled = true; }, { passive: true, once: true });
    });
    // Socials is CENTRED in the viewport rather than aligned to its top edge. Aligning
    // the top put the fan wherever the leftover height happened to fall — a tall window
    // left a lot of empty room under the links, a short one cut the cards off — so where
    // the section sat depended on the browser. Centring makes the framing the same
    // everywhere: whatever height is spare is split evenly above and below.
    // Returns the delta (px) from the current position to the centred one, or null when
    // the hash is not one we place by hand.
    function centreDelta(el) {
      var r = el.getBoundingClientRect();
      return r.top - (window.innerHeight - r.height) / 2;
    }
    function applyHash() {
      if (!wantHash || wantHash === "#" || wantHash === "#top") return;
      var el = null;
      try { el = document.querySelector(wantHash); } catch (e) { return; }  // malformed selector
      if (!el) return;
      // Swap ?go=<id> out of the address bar for the clean /#<id> form. replaceState
      // does not scroll and leaves no extra history entry, so this is cosmetic only —
      // but it means the URL a visitor copies is the shareable one.
      if (location.search.indexOf("go=") > -1 && history.replaceState) {
        try {
          history.replaceState(null, "", location.pathname + location.search.replace(/[?&]go=[\w-]+/, "").replace(/^&/, "?") + wantHash);
        } catch (e) {}
      }
      var tries = 0;
      (function attempt() {
        if (userScrolled || tries++ > 8) return;
        // #contact IS the footer, and the footer is the last thing on the page: putting its
        // TOP at the top of the viewport leaves the email pill and the legal row below the
        // fold, which reads as "not quite there". Contact goes to the very bottom instead.
        var top = wantHash === "#contact"
          ? Math.max(0, document.documentElement.scrollHeight - window.innerHeight) - (window.scrollY || 0)
          : (wantHash === "#socials" ? centreDelta(el) : el.getBoundingClientRect().top);
        if (Math.abs(top) > 2) {
          var y = top + (window.scrollY || 0);
          if (window.__lenis && window.__lenis.scrollTo) window.__lenis.scrollTo(y, { immediate: true, force: true });
          window.scrollTo(0, y);                       // also move the real scroller, in case Lenis is absent
        }
        setTimeout(attempt, tries < 3 ? 60 : 220);     // quick at first, then slower while assets settle
      })();
    }
    // Late layout shifts (fonts, images, the JS-sized projects section) move the target
    // after the first attempts, so re-run once everything has actually loaded.
    addEventListener("load", function () { applyHash(); });

    // Repeat visit in this session (and not an explicit reload) → no loader at all.
    // The critical assets are cached, so the only thing still worth doing is priming
    // the hero video's decoder; that runs in the background instead of gating.
    if (seen() && !isReload()) {
      // Nothing to hide: #boot-loader is display:none until html.boot-active says
      // otherwise, which this path never sets. Hiding it from JS was too late — the
      // first frame had already painted it black.
      warmCritical();
      bootResolve();
      applyHash();
      return;
    }

    docEl.classList.add("boot-active");
    window.__bootShown = true;
    if (window.__lenis && window.__lenis.stop) window.__lenis.stop();

    /* ----- critical assets (gate the reveal) ----- */
    // pip-flavoured label → real asset. The label is what the terminal "collects".
    var IMG = [
      ["numpy",        "images/flow/data-collection.jpg"],
      ["pandas",       "images/flow/processing-storage.jpg"],
      ["scikit-learn", "images/flow/ml-analysis.jpg"],
      ["matplotlib",   "images/flow/build-ship.jpg"],
      ["fastapi",      "images/heading_area.webp"],
      ["uvicorn",      "images/messages_part.webp"],
      ["pydantic",     "images/product_image.webp"],
      ["httpx",        "images/bottom_part.webp"]
    ];

    function loadImage(src) {
      return new Promise(function (resolve) {
        var im = new Image(), done = function () { resolve(); };
        im.onload  = function () { if (im.decode) { im.decode().then(done, done); } else { done(); } };
        im.onerror = done;
        im.src = src;
        setTimeout(done, 8000); // never hang on a single asset
      });
    }
    // Fetch + decode, and PRIME the decoder: roll the video briefly here behind the
    // loader, then park it back at frame 0. Buffered bytes do not mean the decode
    // pipeline is spun up, and paying for that spin-up later — at the first scroll,
    // when the video is being revealed — would just move the stall somewhere visible.
    // Doing it under the loader is precisely what the loader is for.
    // Afterwards the video stays PAUSED until it is actually on screen (see setVidPlay).
    function loadVideo(src, prime) {
      return new Promise(function (resolve) {
        var v = document.querySelector('video[src="' + src + '"]'), done = function () { resolve(); };
        if (!v) { done(); return; }
        var warm = function () {
          if (!prime) { done(); return; }
          var park = function () { try { v.pause(); v.currentTime = 0; } catch (e) {} done(); };
          var pr;
          try { pr = v.play(); } catch (e) { park(); return; }
          if (pr && pr.then) pr.then(function () { setTimeout(park, 220); }, park);
          else setTimeout(park, 220);
        };
        if (v.readyState >= 3) { warm(); return; }
        v.preload = "auto";
        v.addEventListener("canplaythrough", warm, { once: true });
        v.addEventListener("loadeddata", warm, { once: true });
        try { v.load(); } catch (e) {}
        setTimeout(done, 8000);
      });
    }
    // Skip path only: no loader to hide behind, so nothing here may gate the reveal.
    // The images are already in the HTTP cache on a repeat visit, but the video's
    // DECODER is not — that is per-document — so it still needs priming or the hero
    // pays the spin-up at the first scroll. Fire and forget. (Both this and loadVideo
    // are function declarations, so this is callable from the early return above.)
    function warmCritical() { loadVideo("videos/interview_office.mp4", true); }

    // Ordered typing queue: [label, promise]. Labels drive the "Collecting …" lines.
    var tasks = [];
    tasks.push(["setuptools",    (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(function () {}) : Promise.resolve()]);
    tasks.push(["opencv-python", loadVideo("videos/interview_office.mp4", true)]);
    IMG.forEach(function (p) { tasks.push([p[0], loadImage(p[1])]); });

    // The reveal is gated ONLY on the curated first-view set above (fonts + hero video +
    // the hero product art). Every OTHER page image is warmed AFTER the reveal, staggered
    // during idle (see warmRest below) — decoding them all here at boot floods the main
    // thread exactly when the hero video needs to start, stuttering its first play.
    var total = tasks.length, resolved = 0;
    var assetsReady = Promise.all(tasks.map(function (t) { return t[1]; }));

    function setPct(f) {
      var p = Math.max(0, Math.min(100, Math.round(f * 100)));
      if (fill)  fill.style.width = p + "%";
      if (pctEl) pctEl.textContent = p + "%";
    }
    var HOME = "~", DIR = "~/portfolio-website";
    // Coloured prompt (green user@host, blue path). Output is plain white.
    function promptHTML(path) {
      return '<span class="b-usr">vishnu@portfolio</span>:<span class="b-path">' + path + '</span>$ ';
    }
    function appendLine(html) {
      var d = document.createElement("div");
      d.className = "boot-line";
      if (html != null) d.innerHTML = html;
      out.appendChild(d);
      out.scrollTop = out.scrollHeight;
      return d;
    }

    // Progress bar = overall readiness: the SLOWER of "time toward the minimum"
    // and "critical assets loaded", so it only reaches 100% right as we reveal
    // (not the instant the fast/cached assets resolve).
    tasks.forEach(function (t) { t[1].then(function () { resolved++; }); });
    var barTimer = setInterval(function () {
      var tp = Math.min(1, (now() - start) / MIN_MS);
      var ap = resolved / total;
      setPct(Math.min(tp, ap));
    }, 60);

    // Real-terminal script: each STEP is a prompt+command that TYPES OUT (quick),
    // then its output lines appear, THEN the next prompt shows — the pip step's
    // "Collecting/Successfully installed" only lands after the commands run.
    var collecting = tasks.map(function (t) { return "Collecting " + t[0] + " ... done"; });
    var STEPS = [
      { cwd: HOME, cmd: "git clone https://github.com/VishnujanNarayanan/portfolio-website.git", out: [
        "Cloning into 'portfolio-website'...",
        "remote: Enumerating objects: 1467, done.",
        "remote: Counting objects: 100% (1467/1467), done.",
        "remote: Compressing objects: 100% (842/842), done.",
        "Receiving objects: 100% (1467/1467), 18.42 MiB | 6.10 MiB/s, done.",
        "Resolving deltas: 100% (623/623), done." ] },
      { cwd: HOME, cmd: "cd portfolio-website", out: [] },
      { cwd: DIR, cmd: "python3 -m venv .venv", out: [] },
      { cwd: DIR, cmd: "source .venv/bin/activate", out: [] },
      { cwd: DIR, cmd: "python -m pip install --upgrade pip", out: ["Successfully installed pip-24.0"] },
      { cwd: DIR, cmd: "pip install -r requirements.txt", out:
        collecting.concat([
          "Building wheels for collected packages: numpy, pandas, scikit-learn ... done",
          "Successfully installed " + tasks.length + " packages" ]) }
    ];

    var OUT  = reduce ? 0 : 16;   // ms between output lines
    var RUN  = reduce ? 0 : 60;   // pause after Enter before output
    var GAP  = reduce ? 0 : 45;   // pause between commands

    var linesDone = false, finished = false, assetsDone = false;

    // Type a command over a CAPPED total duration (rAF, so no setTimeout clamp) —
    // this keeps long commands (the git-clone URL) roughly as quick as short ones,
    // instead of the line length dictating the speed.
    function typeCmd(step, done) {
      var line = appendLine(promptHTML(step.cwd));
      var typed = document.createElement("span"); typed.className = "b-cmd";
      var caret = document.createElement("span"); caret.className = "boot-caret";
      line.appendChild(typed); line.appendChild(caret);
      var c = step.cmd;
      var dur = reduce ? 0 : Math.min(210, 90 + c.length * 1.3); // ~90–210ms whole line
      var t0 = now();
      (function frame() {
        var p = dur ? Math.min(1, (now() - t0) / dur) : 1;
        typed.textContent = c.slice(0, Math.round(p * c.length));
        out.scrollTop = out.scrollHeight;
        if (p < 1) requestAnimationFrame(frame);
        else {
          caret.parentNode && caret.parentNode.removeChild(caret); // Enter pressed
          setTimeout(done, RUN);
        }
      })();
    }
    function showOut(step, done) {
      var j = 0, lines = step.out || [];
      (function tick() {
        if (j < lines.length) {
          var d = appendLine(); d.textContent = lines[j++]; // plain white output
          setTimeout(tick, OUT);
        } else { setTimeout(done, GAP); }
      })();
    }
    function runStep(k) {
      if (k >= STEPS.length) { linesDone = true; tryFinish(); return; }
      typeCmd(STEPS[k], function () { showOut(STEPS[k], function () { runStep(k + 1); }); });
    }
    runStep(0);

    function tryFinish() {
      if (finished) return;
      // Reveal only once BOTH hold: the commands have run out AND every critical
      // asset resolved (extends for slow loads); then honour the MIN_MS floor.
      if (!linesDone || !assetsDone) return;
      finished = true;
      var wait = Math.max(0, MIN_MS - (now() - start));
      setTimeout(function () {
        clearInterval(barTimer);
        setPct(1);
        typeCmd({ cwd: DIR, cmd: "xdg-open index.html" }, function () {
          boot.classList.add("is-done");
          setTimeout(function () {
            boot.style.display = "none";
            docEl.classList.remove("boot-active");
            if (window.__lenis && window.__lenis.start) window.__lenis.start();
            // Warm a layout pass so the first scroll pays no reflow cost.
            var f = document.querySelector(".flow");     if (f)  void f.offsetHeight;
            var ft = document.querySelector(".features"); if (ft) void ft.offsetHeight;
            seen(true);            // this session has now watched the intro — don't replay it
            bootResolve();
            applyHash();           // the page is scrollable again; honour /#contact, /#socials
          }, 480);
        });
      }, wait);
    }

    assetsReady.then(function () { assetsDone = true; tryFinish(); });
    setTimeout(function () { linesDone = true; assetsDone = true; tryFinish(); }, 14000); // hard cap

    // Non-gating background warm-up AFTER the reveal: every OTHER page image (socials/skills/
    // section art + certs) plus the runtime-fetched SVGs and the transition videos. Warmed
    // ONE AT A TIME on idle callbacks — each image loads + decodes, then schedules the next —
    // so at most one decode is ever in flight. That spreads the work across idle frames
    // instead of a burst that would stutter the hero video's first play or the first scroll,
    // while still getting the lower sections decoded before the user reaches them.
    window.__bootReady.then(function () {
      var idle = window.requestIdleCallback || function (cb) { return setTimeout(cb, 1); };
      var seen = {}, urls = [];
      function add(u) { if (u && !seen[u]) { seen[u] = 1; urls.push(u); } }
      Array.prototype.forEach.call(document.querySelectorAll("img[src]"),   function (im) { add(im.getAttribute("src")); });
      Array.prototype.forEach.call(document.querySelectorAll("[data-src]"), function (el) { add(el.getAttribute("data-src")); });
      add("images/footer-blobs.svg"); // fetched by the contour canvas at runtime
      add("images/footer-mask.svg");  // CSS background-image (not an <img>)
      var i = 0;
      (function warmNext() {
        if (i >= urls.length) return;
        var im = new Image(), go = function () { i++; idle(warmNext); };
        im.onload  = function () { if (im.decode) im.decode().then(go, go); else go(); };
        im.onerror = go;
        im.src = urls[i];
      })();
      ["videos/pullout_animation.mp4", "videos/recieve_animation.mp4"].forEach(function (s) {
        var v = document.querySelector('video[src="' + s + '"]');
        if (v) { v.preload = "auto"; try { v.load(); } catch (e) {} }
      });
    });
  })();

  /* ---------- Hero entrance reveal ---------- */
  var hero = document.querySelector(".hero");
  if (hero) {
    // Gate the entrance on the boot loader lifting (window.__bootReady). The boot
    // loader already waits on fonts + the hero video + key images, so by the time
    // it resolves the text renders in Roboto (no weight snap) over warm assets.
    var showHero = function () {
      requestAnimationFrame(function () {
        void hero.offsetWidth; // commit the pre-reveal state, then transition in
        hero.classList.add("show");
      });
      // Safety net (relative to the reveal): if the combined 3D-transform + opacity
      // transition stalls, force the end state so the hero is never left invisible.
      setTimeout(function () {
        var t = hero.querySelector(".hero__title");
        if (t && parseFloat(getComputedStyle(t).opacity) < 0.9 && window.scrollY < 4) {
          hero.querySelectorAll(".hero__title, .hero__subtitle").forEach(function (el) {
            el.style.transition = "none";
            el.style.opacity = "1";
            el.style.transform = "none";
          });
        }
      }, 1700);
    };
    var revealed = false;
    var go = function () { if (!revealed) { revealed = true; showHero(); } };
    if (window.__bootReady && window.__bootReady.then) {
      window.__bootReady.then(go);
    } else if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(go);
      setTimeout(go, 1200);
    } else {
      go();
    }

    // Hero exit is a scroll-SCRUBBED sequence, in three phases, no fade:
    //   Phase A (0 → vh): the hero and the video scroll up together as a rigid pair —
    //     the video (.hero-video) sits directly BELOW the hero with its top edge glued
    //     to the hero's bottom edge, so it rises into view from below (1:1 with scroll)
    //     rather than being uncovered in place. No zoom yet.
    //   Phase B (vh → 2vh): once the video fully covers the screen, the Lando zoom-out
    //     applies to the VIDEO — it scales DOWN from centre, 1 → EXIT_MIN_SCALE.
    //   Phase C (2vh → 3vh): the zoomed video rides UP with the page, handing over to
    //     the flow below. The video plays at normal speed through the pull-up, then DECELERATES
    //     with scroll through the zoom-out (slowing from 92% of the zoom, paused by 97%).
    // Purely scroll-linked, so scrolling back up reverses it exactly. The 3D text
    // entrance still plays on load at scroll 0 (no transform on .hero).
    var heroContent = hero.querySelector(".hero__content");
    var heroVid = document.querySelector(".hero-video");  // office video revealed beneath the hero
    // Scroll-controlled playback: rate ≤ 0 pauses; otherwise play at the given rate (clamped).
    // HIDDEN = PAUSED. .hero-video is a fixed, fullscreen element sitting at z-index 2,
    // and .hero__bg is an opaque fixed layer above it at z-index 3 — so until the hero
    // starts riding up (scrollY > 0) the video is completely invisible, yet it was
    // decoding and presenting a fullscreen frame on every single refresh. That is the
    // one per-frame cost the hero has and the rest of the page does not, which is why
    // only the hero stuttered; and it gets much worse in Armoury Crate's turbo mode,
    // where the panel runs at ~146Hz instead of ~62Hz (so ~2.4x the decodes per second)
    // and the MUX switch can hand the display to the dGPU, off the iGPU's video path.
    // Confirmed by A/B: loading with ?novideo makes the hero smooth in turbo.
    // The decoder is already primed under the boot loader (see loadVideo), so starting
    // playback on that first pixel of scroll costs nothing visible.
    function setVidPlay(rate) {
      if (!heroVid) return;
      if (rate > 0.001 && window.scrollY <= 0) rate = 0;   // fully covered by the hero → don't decode
      if (rate <= 0.001) { if (!heroVid.paused) heroVid.pause(); return; }
      heroVid.playbackRate = Math.max(0.1, Math.min(rate, 1));
      if (heroVid.paused) { var pr = heroVid.play(); if (pr && pr.catch) pr.catch(function () {}); }
    }
    var scrollCue = hero.querySelector(".hero__scroll-btn");  // vanishes (reverse of its entrance) on scroll
    // Header pieces that react to the zoom-out (color flip + shrink-to-edges).
    var hdr        = document.querySelector("header");
    var navLeft    = hdr && hdr.querySelector(".header__nav-left");
    var navRight   = hdr && hdr.querySelector(".header__nav-right");
    var navLinks   = hdr ? hdr.querySelectorAll(".header__nav-left a") : [];
    var glassPill  = hdr && hdr.querySelector(".pill-btn--glass");
    var darkPill   = hdr && hdr.querySelector(".pill-btn--dark");
    // Per-LETTER vertical REEL on each CTA pill: each letter is a clip with two copies — __a (the
    // current world, colour inherited from the span) and __b (the alt-world colour, fixed in CSS).
    // Letters stagger left→right (--d = i·step) like the nav, but with NO word gap, and BOTH pills
    // roll together (.is-rolled toggled on both at once) so the two buttons reel in unison.
    var glassSpan = buildPillReel(glassPill);  // Socials letters (__a inherits white in the dark world)
    var giSpan   = buildPillReel(darkPill);    // Get In Touch letters (__a inherits black in the dark world)
    var EXIT_MIN_SCALE = 0.35;      // IMAGE size: how far the page-rectangle recedes on zoom-out. The frozen
                                    // collapse frame uses this same rectangle, so the image is equal before/after.
    var hdrFlipped = null;          // header flip state — THRESHOLD-fired (not scroll-scrubbed); null so it inits
    var lastFlipY = window.scrollY; // previous scroll position, to tell a real scroll from an anchor jump
    // Header THEME for a light(he=0) → dark(he=1) world: nav + Hire-Me text black→white and the
    // dark "Get In Touch" pill inverting (bg #050419→#d0e1eb, text white→black) so it stays legible.
    // Shared so the reel thresholds (flow + blog, via __navLight) can flip the SAME two pills the
    // hero zoom does — exposed on window so the nav-reel IIFE can reach it.
    var reelSettleT = 0;            // pending post-reel __a repaint (see setHeaderTheme)
    function setHeaderTheme(he, ease) {
      // ease = reel-threshold flip (discrete) → animate colour + pill bg over ~.5s to match the
      // nav reel. Default (hero zoom) keeps the reference's snappy .3s colour (bg tracks scroll).
      var trans = ease ? "color .5s var(--ease-default),background-color .5s var(--ease-default)"
                       : "color .3s var(--ease-default)";
      var rolled = ease ? (he < 0.5) : false;
      clearTimeout(reelSettleT);                           // a new flip supersedes any pending repaint
      var c = Math.round(255 * he);                         // current text channel: 0 (black) → 255 (white)
      var c2 = Math.round(255 * (1 - he));                  // Get In Touch is inverted
      // When rolling TO the light world (ease + rolled), do NOT update __a letter colours — __a
      // must stay at its current (source) colour so the reel shows old→new, not new→new.
      // Only update __a when unrolling back to the dark world, so the returning letter arrives
      // in the correct dark-world colour.
      var rgb = "rgb(" + c + "," + c + "," + c + ")";
      if (!ease || !rolled) {
        navLinks.forEach(function (a) { a.style.transition = trans; a.style.color = rgb; });
        if (glassSpan) { glassSpan.style.transition = trans; glassSpan.style.color = rgb; }
        if (giSpan) { giSpan.style.transition = trans; giSpan.style.color = "rgb(" + c2 + "," + c2 + "," + c2 + ")"; }
      } else {
        // …EXCEPT the link under the cursor. It is rolled to its __c clone, and at the
        // top of the page header.is-hero forces that clone to currentColor — so leaving
        // the link's colour alone leaves that one word in the world we came FROM (white
        // on a black-lettered nav). It has no __a to reel anyway while it is hovered, so
        // it takes the new colour directly; that is the hovered word snapping, which is
        // what it does at every other crossing.
        navLinks.forEach(function (a) {
          if (a.matches(":hover")) { a.style.transition = trans; a.style.color = rgb; }
        });
        // …and once the reel has LANDED, the rolled-away __a copies are repainted to the
        // world we are now in. They are hidden behind __b at that point, so this is
        // invisible (transitions muted so it cannot animate) — but currentColor is what
        // header.is-hero hands the __c hover clone, so without it every word hovered
        // AFTER the reel comes up in the colour of the world we left. Hero only: below it
        // --hc owns the clone's colour and __a must keep the source colour for the reel back.
        if (hdr && hdr.classList.contains("is-hero")) {
          clearTimeout(reelSettleT);
          reelSettleT = setTimeout(function () {
            var els = Array.prototype.slice.call(navLinks);
            if (glassSpan) els.push(glassSpan);
            if (giSpan) els.push(giSpan);
            els.forEach(function (el) { el.style.transition = "none"; });
            navLinks.forEach(function (a) { a.style.color = rgb; });
            if (glassSpan) glassSpan.style.color = rgb;
            if (giSpan) giSpan.style.color = "rgb(" + c2 + "," + c2 + "," + c2 + ")";
            void hdr.offsetWidth;
            requestAnimationFrame(function () { els.forEach(function (el) { el.style.transition = ""; }); });
          }, 900);   // .5s roll + the letter stagger
        }
      }
      if (darkPill) {                                     // Get In Touch pill bg: dark #050419 → light #d0e1eb
        var dr = Math.round(5 + (208 - 5) * he), dg = Math.round(4 + (225 - 4) * he), db = Math.round(25 + (235 - 25) * he);
        darkPill.style.transition = trans; darkPill.style.backgroundColor = "rgb(" + dr + "," + dg + "," + db + ")";
      }
      if (glassPill) {                                    // Socials pill bg: the INVERSE of the above
        // Opaque, and travelling the opposite way so the two CTAs always read as a
        // light/dark pair: near-white #fcfcfc in the light world → #050419 over the
        // dark projects run. Matches the letter channel `c` (black at he 0, white at
        // he 1), so the label stays legible at both ends without its own ramp.
        var gr = Math.round(252 + (5 - 252) * he), gg = Math.round(252 + (4 - 252) * he), gb = Math.round(252 + (25 - 252) * he);
        glassPill.style.transition = trans; glassPill.style.backgroundColor = "rgb(" + gr + "," + gg + "," + gb + ")";
      }
      // Reel roll — only on the discrete threshold flips (ease): the LIGHT world rolls both pills up
      // to their __b copy, in unison. During the hero zoom (no ease) stay unrolled so __a's colour
      // interpolates smoothly with the scroll.
      if (glassPill) glassPill.classList.toggle("is-rolled", rolled);
      if (darkPill) darkPill.classList.toggle("is-rolled", rolled);
      // Hover-reel clone colour (--hc) = the FLIP target, ALWAYS kept current here:
      //  • CTA pills roll to the literal OPPOSITE colour (white<->black).
      //  • nav links roll to the opposite blue of the text (sky #4d8bff from white, deep blue
      //    #231d7a — the zone-3/4 title blue — from black). At reel thresholds __navLight owns the
      //    nav --hc; during the hero zoom (no ease) we set it here from the live text channel.
      // The HERO same-colour reel is now GATED by the header.is-hero class (CSS forces currentColor
      // while it's on), toggled in updateHeroExit — so --hc is set unconditionally, and the moment
      // you scroll off the hero the clone already carries the flip colour (no wait for a threshold).
      var WHITE = "#fcfcfc", BLACK = "#050419";
      var glassVis = rolled ? 0   : c;    // visible channel: glass __b is black(0)
      var giVis   = rolled ? 255 : c2;   // dark-pill __b is white(255)
      if (glassSpan) glassSpan.style.setProperty("--hc", glassVis >= 128 ? BLACK : WHITE);   // opposite of current
      if (giSpan)   giSpan.style.setProperty("--hc",   giVis   >= 128 ? BLACK : WHITE);
      if (!ease) navLinks.forEach(function (a) { a.style.setProperty("--hc", c >= 128 ? "#4d8bff" : "#231d7a"); });
    }
    window.__headerTheme = setHeaderTheme;
    // CHECKPOINT/DWELL: once the video reaches fullscreen (y = vh) it HOLDS there for an extra
    // HERO_DWELL·vh of scroll before the edge zoom-out (phase B) begins — so you have to scroll
    // again past the checkpoint to start it. Every hero-phase consumer (video, handwriting,
    // marquee, GitHub card, CTA lift) maps real scrollY through __heroY so they all dwell in
    // lock-step; the .hero-spacer is lengthened by the same amount to provide the scroll room.
    var HERO_DWELL = 0.16;
    function heroY(y, vh) { var d = vh * HERO_DWELL; return y < vh ? y : (y < vh + d ? vh : y - d); }
    window.__heroY = heroY;
    function updateHeroExit() {
      var vh = window.innerHeight;
      var y = window.scrollY;
      // The header reaction (text shrink + colour flip) fires a little BEFORE the video
      // reaches fullscreen — 4.5% of a viewport early. Tied to fullscreen (NOT the dwell), so
      // the checkpoint dwell doesn't shift the navbar switch.
      var HDR_FLIP = vh * 0.955;
      // Phase A (0 → vh): the hero rides UP 1:1 with scroll (linear, so the video glued
      // to its bottom edge tracks it exactly). Past vh it's parked off the top.
      if (heroContent) heroContent.style.transform = "";
      hero.style.transform = "translateY(" + (-Math.min(y, vh)) + "px)";
      // Phases B/C act on the video once it fully covers the screen (y ≥ vh):
      //   B (vh → 2vh): zoom OUT from the centre (camera pull-back), 1 → EXIT_MIN_SCALE.
      //   C (2vh → 3vh): ride UP with the page, handing over to the flow below.
      // Effective scroll with the checkpoint dwell removed — phases B/C read this so the video
      // stays fullscreen through the dwell, then resumes exactly where it would have.
      var ye = heroY(y, vh);
      if (heroVid) {
        // Y: below the fold (top edge at the hero's bottom) → 0 (full screen) over phase A,
        // locked at 0 through the zoom + the dwell, then rides up off the top in phase C.
        var vTy = (ye < vh) ? (vh - ye) : -Math.max(0, ye - 2 * vh);
        var scale, grey = 0, blue = 0;                 // grey 0→1 (greyed out); blue 0→1 (blue tint, kicks in later)
        if (ye < vh) {
          // Phase A CONTENT zoom (a normal camera zoom; object-fit:cover keeps it full-frame):
          // held zoomed-in 1.55 for the first 50% of the pull-up, then eased back to 1.0 (full
          // view) between 50% and 100% (reaching 1.0 at the top). Distinct from the edge zoom below.
          var zt = Math.max(0, Math.min((ye - 0.5 * vh) / (0.5 * vh), 1));
          var ze = zt * zt * (3 - 2 * zt);             // smoothstep
          scale = 1.55 - 0.55 * ze;                    // 1.55 → 1.0
          setVidPlay(1);                               // full speed through the pull-up
        } else {
          // Phase B EDGE zoom-out (shrinks the whole rectangle, uncovering the marquee around it).
          // `prog` ∈ [0,1] = zoom-out completion. It is SCROLL-driven up to the handwriting's
          // "thin24" threshold (window.__certWrite.pBThr); once the pen reaches that stroke the
          // cert IIFE fires a TIMED completion (cw.t 0→1) and the video finishes its zoom-out,
          // grey, blue tint and PAUSE on that same timer — threshold-driven, not scroll-driven —
          // so the video and the last strokes land together at the pop. Reverses on scroll-up.
          var pB = Math.max(0, Math.min((ye - vh) / vh, 1));
          var cw = window.__certWrite;
          var prog;
          if (cw && cw.crossed) {
            var ct = cw.t * cw.t * (3 - 2 * cw.t);                 // smoothstep on the timed factor
            prog = cw.pBThr + (1 - cw.pBThr) * ct;                 // threshold → 1 on the timer
          } else {
            prog = pB;                                             // scroll-driven up to the threshold
          }
          var eB = prog * prog * (3 - 2 * prog);       // smoothstep
          scale = 1 - (1 - EXIT_MIN_SCALE) * eB;       // 1 → EXIT_MIN_SCALE (no opacity change)
          grey = eB;                                   // greys MORE the further it recedes (stays grey in phase C)
          blue = Math.max(0, Math.min((prog - 0.8) / 0.1, 1)); // blue tint ramps only between 80% and 90% of the zoom-out
          // PLAYBACK decelerates through the zoom-out: full speed until 92%, then eases down
          // (gentle at first, steeper toward 97% via the squared ramp) and PAUSES at 97% (and
          // stays paused beyond, into phase C). Driven by `prog`, so it pauses on the timer once
          // the threshold has fired.
          var dt = (prog - 0.92) / 0.05;               // 0 at 92% of the zoom → 1 at 97%
          setVidPlay(prog >= 0.97 ? 0 : (prog <= 0.92 ? 1 : 1 - dt * dt));
        }
        heroVid.style.transformOrigin = "50% 50%";
        heroVid.style.transform = "translateY(" + vTy + "px) scale(" + scale + ")";
        // Desaturate + dim toward grey as it recedes (grey, from the start of the zoom), then re-tint
        // that grey toward BLUE only between 80% and 90% of the zoom-out (blue), at 0.33 strength so it
        // ends as a softer blue-grey (≈ #969ba8). grayscale/brightness ride grey; sepia+hue-rotate+
        // saturate (the blue tint) ride blue.
        // The paused hero image stays GREY while paused — hovering the cert CTA no longer
        // re-colours the video (only the handwriting text reacts to hover; see applyColor).
        var dg = 1;
        heroVid.style.filter =
          "grayscale(" + (grey * dg).toFixed(3) + ") brightness(" + (1 - 0.18 * grey * dg).toFixed(3) +
          ") sepia(" + (0.33 * blue * dg).toFixed(3) + ") hue-rotate(" + (185 * blue * dg).toFixed(1) +
          "deg) saturate(" + (1 + 0.33 * blue * dg).toFixed(3) + ")";
      }
      // Scroll cue plays its entrance in reverse the moment scrolling starts.
      if (scrollCue) scrollCue.classList.toggle("is-exiting", y > 0);
      // Hover-reel gate: through the whole pull-up (y < vh) the header stays in its hero
      // appearance, so the clone keeps the SAME colour (CSS forces currentColor). It only
      // flips once the edge zoom-out begins (--hc takes over) — same trigger as the theme below.
      if (hdr) hdr.classList.toggle("is-hero", y < HDR_FLIP);

      // Header reacts to the EDGE zoom-out (phase B), NOT to the initial pull-up. It's
      // THRESHOLD-fired (a timed flip, not scroll-scrubbed): the moment the video begins
      // zooming out from the edges (y ≥ vh) it plays its transition once, and reverses when
      // you scroll back above that line. Same look/speed as before, just one viewport later:
      //  - text colour flips as the light bg appears (CSS .3s color transition);
      //  - the left nav + right CTAs SHRINK in place, anchored to their page edges (.3s);
      //  - the dark "Get In Touch" pill inverts its bg (dark → light) so it stays legible.
      // While y > 2·vh the flow/blog reel thresholds own the theme (via window.__navLight),
      // so we only assert it up to the end of the edge zoom.
      var wantFlip = y >= HDR_FLIP;
      if (wantFlip !== hdrFlipped) {
        // JUMPED here (an in-page anchor — Home is #top — is a native instant jump, not a
        // scroll), so this crossing was never scrubbed: take the REEL form of the flip
        // instead of the snappy one. The difference that matters is that the eased form
        // leaves the __a letters at the colour they arrived in, so the nav can reel white
        // → black over its black __b copy; the plain form repaints __a first, which is
        // why clicking Home from the projects run went black and only then reeled.
        var jumped = Math.abs(y - lastFlipY) > vh * 0.5;
        hdrFlipped = wantFlip;
        if (ye <= 2 * vh) setHeaderTheme(wantFlip ? 1 : 0, jumped);   // timed (.3s), not scrubbed
        var hs = wantFlip ? 0.88 : 1;                        // shrink 1 ↔ 0.88 (subtle)
        if (navLeft)  { navLeft.style.transition  = "transform .3s var(--ease-default)"; navLeft.style.transformOrigin  = "left center";  navLeft.style.transform  = "scale(" + hs + ")"; }
        if (navRight) { navRight.style.transition = "transform .3s var(--ease-default)"; navRight.style.transformOrigin = "right center"; navRight.style.transform = "scale(" + hs + ")"; }
      }
      lastFlipY = y;                              // for the jump test on the next crossing
    }
    window.__updateHeroExit = updateHeroExit;   // cert IIFE drives this during its timed completion
    window.addEventListener("scroll", updateHeroExit, { passive: true });
    window.addEventListener("resize", updateHeroExit, { passive: true });
    updateHeroExit();
  }

  /* ---------- Handwritten "checkout my certificates" CTA over the hero video ----------
     The pen-stroke is laid down by scrubbing stroke-dashoffset against scroll, and the
     whole layer is given the SAME transform the .hero-video gets, so the writing rides
     with the (paused, shrunken) video as it recedes and drifts up. Fully reversible:
     scrolling up un-writes the ink and lowers the layer back. Mirrors the phase B/C math
     in updateHeroExit (kept in sync by formula, not by sharing state). */
  (function () {
    var layer = document.querySelector(".cert-layer");
    if (!layer) return;
    // The visible letters are a FILLED path; they're uncovered by a mask made of the traced
    // centre-line PEN PATH, split into ordered strokes (writing order). We measure each
    // stroke and reveal them in sequence by cumulative length, so the ink is laid down by a
    // pen tip travelling each stroke — true letter-by-letter writing, fully reversible.
    var segs = [].slice.call(layer.querySelectorAll(".cert-cta__seg"));
    if (!segs.length) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Clickability switches ON at the thin24 THRESHOLD (crossed) and stays on until you scroll back
    // above it. While active the video + cert text are clickable, and hovering de-greys the video +
    // turns the handwriting blue — gradually, gated by the writing completion (see applyColor below).
    var heroVid = document.querySelector(".hero-video");
    var link = layer.querySelector(".cert-cta");
    var fillEl = layer.querySelector(".cert-cta__fill");
    var active = false, hovering = false;
    // TEXT blue: WHILE the writing is still animating (cT<1) the hover blue eases in GRADUALLY
    // (hoverAmt 0→1 on its own rAF), gated by completion so it can only get as blue as cT allows.
    // Once popped (cT≥1, not animating) the hover blue SNAPS instead (uses the raw hover state).
    // VIDEO colour: always a QUICK-SNAP to true colour on hover, and ONLY at the pop (cT≥1 /
    // "100% or more"); below that, hovering doesn't touch the video.
    var hoverAmt = 0, colorRAF = 0, colorLast = 0, HOVER_DUR = 360;   // ms text-blue hover ease (while animating)
    function mixFill(t) {     // #fff → #3ddc84 (green) by t
      var r = Math.round(255 + (61 - 255) * t), g = Math.round(255 + (220 - 255) * t), b = Math.round(255 + (132 - 255) * t);
      return "rgb(" + r + "," + g + "," + b + ")";
    }
    function applyColor() {
      var anim = !reduce && cT < 0.999;                          // still writing → ease; popped → snap
      var h = frozen ? frozenHover : hovering;                   // on the frozen frame, hover = frozenHover
      var amt = anim ? hoverAmt : (h ? 1 : 0);
      if (fillEl) fillEl.style.fill = mixFill(amt * Math.max(0, Math.min(cT, 1)));
      window.__certColor = (h && cT >= 0.999) ? 1 : 0;           // video: snap to true colour, 100%+ only
    }
    function colorTick(now) {
      colorRAF = 0;
      var dt = colorLast ? (now - colorLast) : 16; colorLast = now;
      var target = hovering ? 1 : 0;
      if (reduce) hoverAmt = target;
      else if (hoverAmt < target) hoverAmt = Math.min(hoverAmt + dt / HOVER_DUR, target);
      else if (hoverAmt > target) hoverAmt = Math.max(hoverAmt - dt / HOVER_DUR, target);
      applyColor();
      if (hoverAmt !== target) colorRAF = requestAnimationFrame(colorTick); else colorLast = 0;
    }
    function setHover(on) {
      hovering = on && active;
      applyColor();                                       // snap the video immediately (binary, 100%+ only)
      if (window.__updateHeroExit) window.__updateHeroExit();
      if (!colorRAF) { colorLast = 0; colorRAF = requestAnimationFrame(colorTick); }   // ease the text blue
    }
    // The two transition clips (pull-in + closing, ~2.6MB together) are preload="none"
    // in the markup: neither is visible during the hero, and preload="auto" had them
    // competing with the autoplaying hero video for bandwidth AND the decoder on first
    // paint. They're fetched here instead — the moment the cert frame becomes CLICKABLE,
    // which is the earliest point a click is possible, and still well ahead of one.
    var warmed = false;
    function warmTransitionVideos() {
      if (warmed) return;
      warmed = true;
      [pullout, receive].forEach(function (v) {
        if (!v) return;
        v.preload = "auto";
        try { v.load(); } catch (e) { /* fetch is best-effort; play() would still work */ }
      });
    }
    function setActive(on) {
      if (on === active) return;
      active = on;
      if (on) warmTransitionVideos();
      layer.classList.toggle("is-active", on);
      if (heroVid) { heroVid.style.pointerEvents = on ? "auto" : "none"; heroVid.style.cursor = on ? "pointer" : ""; }
      if (!on) { setHover(false); pressCancel(heroVid); }   // clear any held press when the frame stops being clickable
    }
    // Frozen frame → frozenHover (text white off / blue on). Normal hero → hovering. During the closing
    // zoom (closing, not yet frozen) ignore hover so `hovering` can't get stuck true into the frozen state.
    // Snappy "press" on hover so the frame reads as CLICKABLE: a quick shrink to TROUGH, then it springs
    // back but RESTS a hair pressed (only 20% of the shrink recovered — REST), held while hovered and
    // released to full on leave. Uses the independent `scale` property (via WAAPI) so it composes with the
    // frame's inline transform (set by updateHeroExit / liftFrozen) instead of being clobbered by it.
    var TROUGH = "0.95";                          // dips a touch past the rest on the way down
    var REST   = "0.96";                          // springs back to 96% and holds while hovered
    // (leaves back to 100% on hover-out via pressRelease)
    var lastPress = 0, releaseTimer = 0;
    var perfNow = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
    function pressCancel(el) { if (el && el.__pressAnim) { try { el.__pressAnim.cancel(); } catch (e) {} el.__pressAnim = null; } }
    function animPress(el) {                       // shrink → settle at REST (held)
      if (!el || !el.animate) return;
      pressCancel(el);
      try {
        el.__pressAnim = el.animate([{ scale: "1" }, { offset: 0.5, scale: TROUGH }, { scale: REST }],
          { duration: 300, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
      } catch (e) {}
    }
    function animRelease(el) {                      // ease REST → full
      if (!el || !el.animate) return;
      pressCancel(el);
      try {
        var a = el.animate([{ scale: REST }, { scale: "1" }], { duration: 200, easing: "ease-out", fill: "forwards" });
        el.__pressAnim = a;
        a.onfinish = function () { pressCancel(el); };  // clear so `scale` unsets (no lingering shrink)
      } catch (e) {}
    }
    // Press/release ALL given frames together — when collapsed there's a frozen frame on top with the
    // hero behind it at the same rect, so pressing only the top one would reveal a full-size frame behind.
    function pressPulse() {
      if (reduce) return;
      if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = 0; }
      var t = perfNow(); if (t - lastPress < 320) return; lastPress = t;   // debounce cross-element re-enter
      for (var i = 0; i < arguments.length; i++) animPress(arguments[i]);
    }
    function pressRelease() {
      if (reduce) return;
      var els = Array.prototype.slice.call(arguments);
      if (releaseTimer) clearTimeout(releaseTimer);
      releaseTimer = setTimeout(function () {
        releaseTimer = 0;
        if (frozen ? frozenHover : hovering) return;   // moved onto the CTA text, not actually leaving
        els.forEach(animRelease);
      }, 90);
    }
    var onEnter = function () {
      if (frozen) { pressPulse(receive, heroVid); setFrozenHover(true); }
      else if (!closing) { pressPulse(heroVid); setHover(true); }
    };
    var onLeave = function () {
      if (frozen) { setFrozenHover(false); pressRelease(receive, heroVid); }
      else if (!closing) { setHover(false); pressRelease(heroVid); }
    };

    // ---- Pull-IN transition on click: zoom the pullout clip from the hero video's CURRENT
    // on-screen rectangle (position-aware) to full screen, the reverse of the scroll zoom-out,
    // playing videos/pullout_animation.mp4 exactly ONCE over its own duration. ----
    var pullout = document.querySelector(".pullout-video");
    var receive = document.querySelector(".receive-video");
    var pullActive = false, pullDone = false, pullRAF = 0;
    var pullStart = { s: 1, ty: 0 };          // hero rectangle the pull-in came from (closing returns here)
    var closing = false, closeRAF = 0;

    // ---- Certificate gallery (opens once the pull-in finishes). Each entry is one sticky,
    // full-screen slide; scrolling brings the next up to cover the previous (features-over-blog).
    // The certificates are shown as PNGs (rendered from the PDFs, page 1) so they display full
    // size cleanly; each keeps an "Open ↗" link to the original PDF. ----
    var CERT_DOCS = [
      { img: "images/certificates/dsa-python.webp",                  pdf: "images/certificates/Data Structures and Algorithms Using Python.pdf",       title: "Data Structures & Algorithms (Python)" },
      { img: "images/certificates/ibm-generative-ai.webp",           pdf: "images/certificates/IBM Generative AI Engineering Coursera 8R9Q0WU9IB5G.pdf", title: "IBM Generative AI Engineering" },
      { img: "images/certificates/intro-database-systems.webp",      pdf: "images/certificates/Introduction to Database systems.pdf",                  title: "Introduction to Database Systems" },
      { img: "images/certificates/google-advanced-data-scientist.webp", pdf: "images/certificates/GOOGLE ADVANCED DATA SCIENTIST N8G3041EJ7M6.pdf",    title: "Google Advanced Data Scientist" },
      { img: "images/certificates/modern-cpp.webp",                  pdf: "images/certificates/Programming in modern C++.pdf",                         title: "Programming in Modern C++" },
      { img: "images/certificates/google-capstone.webp",             pdf: "images/certificates/Google_capstone.pdf",                                  title: "Google Capstone" }
    ];
    var gallery = document.querySelector(".cert-gallery");
    var galleryScroll = gallery && gallery.querySelector(".cert-gallery__scroll");
    var galleryBuilt = false, loopVid = null;    // loopVid = the end slide's looping collapse video
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function buildGallery() {
      if (galleryBuilt || !galleryScroll) return;
      galleryBuilt = true;
      var slides = CERT_DOCS.map(function (c, i) {
        var title = esc(c.title || ("Certificate " + (i + 1)));
        // encodeURI: the PDF filenames have spaces. The PNG is shown; the link opens the real PDF.
        return '<div class="cert-slide"><figure class="cert-slide__fig">' +
          '<img class="cert-slide__img" src="' + encodeURI(c.img) + '" alt="' + title + '" loading="lazy">' +
          (c.pdf ? '<a class="cert-slide__open" href="' + encodeURI(c.pdf) + '" target="_blank" rel="noopener">Open ' + title + ' ↗</a>' : '') +
          '</figure></div>';
      }).join("");
      // Final slide: the collapse/receive video, looping. It cover-scrolls up like any certificate;
      // a scroll-down on it collapses the gallery. The close plays its OWN receive clip from the start
      // (only the rectangle position is remembered, not the frame you closed at).
      slides += '<div class="cert-slide cert-slide--end">' +
        '<video class="cert-slide__loop" src="' + encodeURI("videos/recieve_animation.mp4") +
        '" muted loop playsinline autoplay preload="auto" aria-hidden="true"></video></div>';
      galleryScroll.innerHTML = slides;
      loopVid = galleryScroll.querySelector(".cert-slide__loop");
    }
    function openCertGallery() {
      buildGallery();
      if (gallery) { gallery.classList.add("is-open"); gallery.setAttribute("aria-hidden", "false"); }
      if (galleryScroll) galleryScroll.scrollTop = 0;
      if (typeof updateHint === "function") updateHint();   // reset the "scroll to see more" prompt for the fresh scroll
      // Keep the end-slide loop running (free-running, no currentTime reset → a different frame each
      // visit) so the close — which continues from it — looks dynamically different every time.
      if (loopVid) { var lp = loopVid.play(); if (lp && lp.catch) lp.catch(function () {}); }
    }
    // ---- Closing transition: zoom the gallery back OUT to the hero rectangle it came from while
    // the receive clip plays. Triggered at the end of the scroll, on Esc, or via the back button. ----
    // The collapse clip is left FROZEN on its last frame, parked at the hero rectangle — that frozen
    // frame is the new pause image. We do NOT hand back to the live hero video here; instead the hero
    // video is reset to its start and revealed (playing from frame 0) on the next backward scroll.
    // ---- Frozen pause-frame state (after a collapse). The collapse clip is left paused at the hero
    // rectangle; the handwritten CTA sits on top; hovering re-colours the frame, otherwise it's
    // grey+blue (same look as the hero zoom-out). FORWARD scroll lifts the frozen frame + text up
    // together (never swaps); only a BACKWARD scroll snaps back to the real hero video (from start). ----
    var frozen = false, frozenHover = false, freezeY = 0;
    var heroHandoffArmed = false, lastPX = -1, lastPY = -1;
    var HERO_RESUME = 0.97;     // zoom-out progress at which the hero video pauses/resumes (updateHeroExit)
    var TEXT_SCALE = 0.85;      // CTA TEXT size — applied ALWAYS (independent of the image) so the text is the
                                // SAME size before AND after collapse. Lower = smaller text.
    // Frame/image size = the hero rectangle as-is → image is equal before & after; size set by EXIT_MIN_SCALE.
    function frameScale() { return pullStart.s; }
    function layerTransform() {                                        // CTA: remembered position + TEXT_SCALE
      var y = window.scrollY, vh = window.innerHeight;                 // (always — so the text size never changes
      var ye = window.__heroY ? window.__heroY(y, vh) : y;
      return "translateY(" + (-Math.max(0, ye - 2 * vh)).toFixed(2) + "px) scale(" + TEXT_SCALE + ")";  // before↔after)
    }
    // Mirror updateHeroExit's phase-B `prog` so we know when the office video would resume playing.
    function heroProg() {
      if (!crossed) return pBNow();
      var ct = cT * cT * (3 - 2 * cT);
      var pBT = pBThreshold();
      return pBT + (1 - pBT) * ct;
    }
    // Same grey + blue "blush" filter the hero zoom-out uses (see updateHeroExit). The paused/
    // frozen frame stays grey regardless of hover (colorOn kept for call-site compatibility).
    function vidFilter(grey, blue, colorOn) {
      var dg = 1;
      return "grayscale(" + (grey * dg).toFixed(3) + ") brightness(" + (1 - 0.18 * grey * dg).toFixed(3) +
        ") sepia(" + (0.33 * blue * dg).toFixed(3) + ") hue-rotate(" + (185 * blue * dg).toFixed(1) +
        "deg) saturate(" + (1 + 0.33 * blue * dg).toFixed(3) + ")";
    }
    function setFrozenHover(on) {
      frozenHover = on;
      if (receive) receive.style.filter = vidFilter(1, 1, on);   // hover → colour (snap), else grey+blue
      applyColor();                                              // text: blue on hover, white when not
    }
    function pointerOverFrame() {                                // is the cursor currently over the frame/CTA?
      if (lastPX < 0) return false;
      var el = document.elementFromPoint(lastPX, lastPY);
      return !!el && (el === receive || (link && (el === link || link.contains(el))));
    }
    function liftFrozen(y) {                                     // forward scroll: ride UP with the text
      if (!receive) return;
      var vh = window.innerHeight, hy = window.__heroY || function (v) { return v; };
      var lift = Math.max(0, hy(y, vh) - 2 * vh) - Math.max(0, hy(freezeY, vh) - 2 * vh);
      receive.style.transform = "translateY(" + (pullStart.ty - lift).toFixed(2) + "px) scale(" + frameScale().toFixed(4) + ")";
    }
    function heroHandoff() {
      if (!heroHandoffArmed) return;
      var y = window.scrollY || window.pageYOffset || 0;
      // The frozen frame STAYS through the whole paused zone (zoom-out ≥ 97%). It only switches to the
      // real hero video when a BACKWARD scroll drops the zoom-out below 97% — the exact point the office
      // video resumes playing. Forward scroll never crosses this (prog stays 1), so it never switches;
      // it just lifts the frozen frame up with the text.
      if (heroProg() < HERO_RESUME) {
        dismissFrozen();
        if (heroVid) { try { heroVid.pause(); heroVid.currentTime = 0; } catch (er) {} }
        if (window.__updateHeroExit) window.__updateHeroExit();
      } else {
        liftFrozen(y);
      }
    }
    function dismissFrozen() {
      frozen = false; frozenHover = false; hovering = false;   // clear any stuck hover before the hero takes over
      pressCancel(receive); pressCancel(heroVid);              // drop any held press so the resuming hero is full-size
      heroHandoffArmed = false;
      window.removeEventListener("scroll", heroHandoff);
      if (receive) {
        receive.classList.remove("is-playing");
        receive.style.transform = ""; receive.style.filter = "";
        receive.style.pointerEvents = ""; receive.style.cursor = "";
        try { receive.pause(); } catch (e) {}
      }
      if (layer) layer.classList.remove("is-collapsing");        // hand the CTA's z-index back to normal
    }
    function finishClose() {
      if (!closing) return;
      closing = false;
      if (closeRAF) { cancelAnimationFrame(closeRAF); closeRAF = 0; }
      // Freeze the collapse clip on WHATEVER frame the zoom-out ENDED on (not the video's final frame),
      // paused at the hero rectangle — dynamic, different each time = the new pause image.
      frozen = true; freezeY = window.scrollY || 0;
      if (receive) {
        try { receive.pause(); } catch (e) {}
        receive.style.transform = "translateY(" + pullStart.ty.toFixed(2) + "px) scale(" + frameScale().toFixed(4) + ")";
        receive.style.pointerEvents = "auto";                    // hoverable → re-colour
        setFrozenHover(pointerOverFrame());                      // at the END: if hovered, snap to colour
        // keep `.is-playing` so the frozen frame stays visible at the rectangle
      }
      // Keep the handwritten "Certificates" CTA on top of the frozen frame, at its remembered position
      // (render() left it at the click-time scroll spot), at its constant TEXT_SCALE size.
      if (layer) { layer.classList.add("is-collapsing"); layer.style.transform = layerTransform(); layer.style.opacity = "1"; }
      if (pullout) { pullout.classList.remove("is-playing"); pullout.style.transform = ""; pullout.style.filter = ""; try { pullout.pause(); } catch (e) {} }
      // Do NOT reveal the hero video here — heroHandoff swaps back ONLY on a backward scroll.
      pullDone = false; pullActive = false;
      lockScroll(false);
      heroHandoffArmed = true;
      window.addEventListener("scroll", heroHandoff, { passive: true });
    }
    function closeCertGallery() {
      if (!pullDone || closing) return;            // only meaningful while the gallery is open
      closing = true;
      if (receive) {
        receive.classList.add("is-playing");
        receive.style.transform = "translateY(0) scale(1)";   // start full screen (covers the gallery)
        // Play the collapse clip from its START (we only remember the rectangle position, not the
        // frame you closed at). loop = false so it ends and HOLDS its last frame — finishClose freezes
        // it there as the new pause image. 1× rate keeps the motion natural.
        try { receive.currentTime = 0; } catch (e) {}
        receive.loop = false;
        receive.playbackRate = 1;
        var rp = receive.play(); if (rp && rp.catch) rp.catch(function () {});
      }
      if (gallery) { gallery.classList.remove("is-open"); gallery.setAttribute("aria-hidden", "true"); }
      // Hide the pull-in clip NOW (it's still full-screen at z-50) so it isn't seen behind the
      // shrinking receive clip — only the hero scene should show around it.
      if (pullout) { pullout.classList.remove("is-playing"); pullout.style.transform = ""; pullout.style.filter = ""; try { pullout.pause(); } catch (e) {} }
      var DUR = 700;                               // snappy zoom-out, decoupled from the looping clip's length
      var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      function frame(now) {
        if (!closing) return;
        var t = Math.max(0, Math.min((now - t0) / DUR, 1));
        var e = t * t * (3 - 2 * t);               // smoothstep — reverse of the pull-in
        var s = 1 + (frameScale() - 1) * e;        // full screen → the (shrunk) hero rectangle's scale
        var ty = pullStart.ty * e;                 // 0 → the hero rectangle's offset
        if (receive) {
          receive.style.transform = "translateY(" + ty.toFixed(2) + "px) scale(" + s.toFixed(4) + ")";
          // Same grey + blue "blush" as the hero zoom-out: colour → grey+blue as it recedes.
          receive.style.filter = vidFilter(e, Math.max(0, Math.min((e - 0.8) / 0.1, 1)), false);
        }
        // Around the MIDPOINT of the collapse, fade the handwritten "Certificates" CTA in ON TOP of
        // the clip (lifted above it by .is-collapsing). The CTA keeps the position it had when the
        // gallery was opened (scroll is locked, so render() left it at the remembered click spot).
        if (layer) {
          layer.classList.add("is-collapsing");
          layer.style.transform = layerTransform();      // remembered position + constant TEXT_SCALE size
          layer.style.opacity = (t < 0.5 ? 0 : (t - 0.5) / 0.5).toFixed(3);
        }
        if (t < 1) closeRAF = requestAnimationFrame(frame); else finishClose();
      }
      closeRAF = requestAnimationFrame(frame);
    }
    function lockScroll(on) {
      var L = window.__lenis;
      if (on) { if (L && L.stop) L.stop(); } else { if (L && L.start) L.start(); }
      document.documentElement.style.overflow = on ? "hidden" : "";
    }
    // Decompose the hero video's live transform (only translateY + uniform scale, no rotation).
    function heroXf() {
      if (!heroVid) return { s: 1, ty: 0 };
      try { var m = new DOMMatrixReadOnly(getComputedStyle(heroVid).transform); return { s: m.a || 1, ty: m.f || 0 }; }
      catch (e) { return { s: 1, ty: 0 }; }
    }
    // Current hover-press factor (the independent `scale` property, separate from the transform above).
    function curScale(el) {
      if (!el) return 1;
      try { var s = getComputedStyle(el).scale; return (!s || s === "none") ? 1 : (parseFloat(s) || 1); }
      catch (e) { return 1; }
    }
    function playPullout() {
      if (!pullout || pullActive) return;
      pullActive = true;
      var pressScale = curScale(heroVid);         // the frame is pressed to REST (0.96) on hover — open from THAT size
      dismissFrozen();            // clear any frozen collapse frame left from a previous close (cancels the press)
      setHover(false);
      lockScroll(true);
      pullStart = heroXf();                       // clean hero rectangle — closing/frameScale rest here at 100% (unpressed)
      var start = { s: pullStart.s * pressScale, ty: pullStart.ty };   // OPEN zoom BEGINS from the pressed size, not 100%
      pullout.classList.add("is-playing");
      pullout.style.transform = "translateY(" + start.ty + "px) scale(" + start.s.toFixed(4) + ")";
      pullout.style.filter = vidFilter(1, 1, false);   // starts GREY (matches the paused frame), colours in as it opens
      var RATE = 1.2;                             // clip speed → shorter zoom-in
      try { pullout.currentTime = 0; } catch (e) {}
      pullout.playbackRate = RATE;
      var pr = pullout.play(); if (pr && pr.catch) pr.catch(function () {});
      // Drive the zoom on a wall-clock timer (NOT pullout.currentTime) so it starts the instant
      // you click — currentTime sits at 0 until the clip actually begins decoding, which read as a
      // delay. The video plays alongside; both finish at ~the same time.
      var DUR = ((pullout.duration || 1.5) / RATE) * 1000;
      var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      function frame(now) {
        if (!pullActive) return;
        var t = Math.max(0, Math.min((now - t0) / DUR, 1));
        var e = t * t * (3 - 2 * t);              // smoothstep — same easing feel as the zoom-out
        var s = start.s + (1 - start.s) * e;      // current scale → 1 (full screen)
        var ty = start.ty * (1 - e);              // current offset → 0
        pullout.style.transform = "translateY(" + ty.toFixed(2) + "px) scale(" + s.toFixed(4) + ")";
        // grey fades over the whole open; the BLUE tint clears EARLY (gone by ~30%), not gradually.
        pullout.style.filter = vidFilter(1 - e, Math.max(0, 1 - e / 0.3), false);
        if (t < 1) pullRAF = requestAnimationFrame(frame); else finishPullout();
      }
      pullRAF = requestAnimationFrame(frame);
      // Settle full-screen and open the gallery — driven by the zoom finishing (reliable, instant);
      // the clip's own `ended` is a fallback in case it stalls. Scroll stays locked (modal).
      pullout.addEventListener("ended", finishPullout, { once: true });
    }
    function finishPullout() {
      if (pullDone) return;
      pullDone = true;
      if (pullRAF) { cancelAnimationFrame(pullRAF); pullRAF = 0; }
      if (pullout) { pullout.style.transform = "translateY(0) scale(1)"; pullout.style.filter = ""; }  // full colour, fully open
      openCertGallery();
    }

    if (link) {
      link.addEventListener("pointerenter", onEnter);
      link.addEventListener("pointerleave", onLeave);
      link.addEventListener("click", function (e) { if (active) { e.preventDefault(); playPullout(); } });
    }
    if (heroVid) {
      heroVid.addEventListener("pointerenter", onEnter);
      heroVid.addEventListener("pointerleave", onLeave);
      heroVid.addEventListener("click", function () { if (active) playPullout(); });
    }
    // Track the cursor so finishClose can tell if the frozen frame is being hovered at the END of the
    // collapse (pointerenter won't fire on a stationary cursor when pointer-events flips to auto).
    window.addEventListener("pointermove", function (e) { lastPX = e.clientX; lastPY = e.clientY; }, { passive: true });
    // Hovering the frozen frame itself (outside the CTA text) re-colours it; leaving → grey+blue.
    if (receive) {
      receive.addEventListener("pointerenter", function () { if (frozen) setFrozenHover(true); });
      receive.addEventListener("pointerleave", function () { if (frozen) setFrozenHover(false); });
    }

    // ---- Close triggers: back button, Esc, and reaching the end of the gallery scroll. ----
    var backBtn = gallery && gallery.querySelector(".cert-gallery__back");
    // Give the back button the nav-pill REEL (see buildLinkReel at the top of this file):
    // each letter becomes a clip whose __col rolls up on hover to reveal an identical __c
    // clone rising from below, staggered left→right. Its markup already carries
    // aria-label="Back to home", which the builder leaves alone.
    buildLinkReel(backBtn);
    if (backBtn) backBtn.addEventListener("click", closeCertGallery);
    // "Scroll to see more" hint: hide it once the last certificate is reached (nothing more below).
    var hintEl = gallery && gallery.querySelector(".cert-gallery__hint");
    function updateHint() {
      if (!hintEl || !galleryScroll) return;
      var atEnd = galleryScroll.scrollTop + galleryScroll.clientHeight >= galleryScroll.scrollHeight - 4;
      hintEl.classList.toggle("is-hidden", atEnd);
    }
    document.addEventListener("keydown", function (e) {
      if ((e.key === "Escape" || e.key === "Esc") && pullDone && !closing) closeCertGallery();
    });
    if (galleryScroll) {
      function atBottom() { return galleryScroll.scrollTop + galleryScroll.clientHeight >= galleryScroll.scrollHeight - 2; }
      galleryScroll.addEventListener("scroll", updateHint, { passive: true });
      // No resistance at the end. The final slide loops the collapse video; once it's fully up (at
      // the bottom of the scroll), a scroll-DOWN (or an upward swipe past the end) collapses the
      // gallery immediately. The close continues that video from its current frame (closeCertGallery).
      // Esc / Back still close from anywhere.
      galleryScroll.addEventListener("wheel", function (e) {
        if (!pullDone || closing) return;
        if (e.deltaY > 0 && atBottom()) closeCertGallery();    // over-scroll down at the end → collapse
      }, { passive: true });
      var touchY = 0;
      galleryScroll.addEventListener("touchstart", function (e) { touchY = e.touches[0].clientY; }, { passive: true });
      galleryScroll.addEventListener("touchmove", function (e) {
        if (!pullDone || closing) return;
        if ((touchY - e.touches[0].clientY) > 12 && atBottom()) closeCertGallery();   // swipe up past the end → collapse
      }, { passive: true });
    }
    var lens = [], total = 1, thrLen = 0;
    // THRESHOLD model: the scroll-driven pen lays down the strokes BEFORE "thin24" (data-i 23).
    // The moment the pen reaches thin24, a threshold fires and the REST of the writing —
    // strokes 23..45, INCLUDING the four tail strokes — plays as a single TIMED completion
    // (cT 0→1), no longer scrubbed by scroll. The video finishes its zoom-out + pause on the SAME
    // timer (updateHeroExit reads window.__certWrite), and the word POPS (fills solid + becomes
    // clickable) only when the timer ends — i.e. once the last four strokes are complete. Fully
    // reversible: scrolling back above the threshold un-fires it (cT ramps back to 0).
    var THRESH_I = 23;                        // "thin24" — first stroke of the timed completion
    var POP_W = "26";                         // strokes snap to this width at the pop...
    var POP_KEEP = ["25", "26", "27"];        // ...except thick26/thick27/thick28, which keep their own pen width
    /* render() runs on EVERY scroll frame, anywhere on the page, and used to do a
       getAttribute plus three inline style writes for each of the 55 strokes — 55 DOM
       reads and up to 165 writes per frame. Two things make almost all of it dead work:
       the per-stroke data-i and pen width never change, and once the writing has popped
       (written) every stroke's values are CONSTANT, so the same strings were being
       rewritten forever. Precompute the constants and change-gate the writes. */
    var segI = [], segPopW = [], segLast = [];
    for (var _si = 0; _si < segs.length; _si++) {
      var _di = segs[_si].getAttribute("data-i");
      segI.push(+_di);
      segPopW.push(POP_KEEP.indexOf(_di) >= 0 ? "" : POP_W);
      segLast.push({ v: null, o: null, w: null });
    }
    function setSeg(i, vis, off, w) {
      var st = segs[i].style, L = segLast[i];
      if (L.v !== vis) { L.v = vis; st.visibility = vis; }
      if (L.o !== off) { L.o = off; st.strokeDashoffset = off; }
      if (L.w !== w) { L.w = w; st.strokeWidth = w; }
    }
    var lastLayerTf = null, lastLayerOp = null, lastWritten = null;
    function measure() {
      total = 0; thrLen = 0;
      segs.forEach(function (s, i) {
        var L = 1; try { L = s.getTotalLength() || 1; } catch (e) {}
        lens[i] = L; s._len = L; total += L;
        s.style.strokeDasharray = L;
        s.style.strokeDashoffset = L;     // start fully un-inked
        if (+s.getAttribute("data-i") < THRESH_I) thrLen += L;   // cumulative length before thin24
      });
    }
    // pBThr = the zoom-out progress (pB) at which the scroll-driven ink reaches thin24. Writing is
    // scrubbed over pB 0.5→1 with ink = p·total, so the threshold sits at p = thrLen/total.
    function pBThreshold() { return 0.5 + 0.5 * (thrLen / total); }

    var cT = 0;                  // completion factor: 0 = at the threshold, 1 = popped
    var crossed = false;         // has the scroll-driven pen reached thin24?
    var reversing = false;       // are we un-writing on scroll-up? (then cT is scroll-driven, not timed)
    var pBMax = 0;               // furthest zoom-out reached while crossed — anchors the scroll-driven reverse
    var prevPB = -1;
    var rafId = 0, lastT = 0;
    var DUR = 550;               // ms for the FORWARD timed completion (strokes 23..45 + the video finish) — sped up from 1100

    function pBNow() { var vh = window.innerHeight, ye = window.__heroY ? window.__heroY(window.scrollY, vh) : window.scrollY; return Math.max(0, Math.min((ye - vh) / vh, 1)); }
    function scrollInk() {       // scroll-driven ink length (drives strokes BEFORE the threshold)
      var pB = pBNow();
      var p = reduce ? (pB > 0.5 ? 1 : 0) : Math.max(0, Math.min((pB - 0.5) / 0.5, 1));
      return p * total;
    }
    // On scroll-UP the completion is SCROLL-driven: cT maps the band [threshold, furthest-reached]
    // back to [0,1], so the writing + video un-wind in step with the scroll (anchored at pBMax so it
    // leaves the popped state without a jump). Forward stays the timed completion.
    function reverseCT() {
      var pBT = pBThreshold(), d = pBMax - pBT;
      if (d <= 1e-4) return pBNow() >= pBMax ? 1 : 0;
      return Math.max(0, Math.min((pBNow() - pBT) / d, 1));
    }
    function render(inkedScroll) {
      var y = window.scrollY, vh = window.innerHeight;
      // The CTA rides UP with the video (phase C, >2vh) at its constant TEXT_SCALE size (layerTransform),
      // so the text is the SAME size before and after collapse.
      var _tf = layerTransform();
      if (_tf !== lastLayerTf) { lastLayerTf = _tf; layer.style.transform = _tf; }
      var written = cT >= 0.999;
      // Hand the threshold state to the video (read by updateHeroExit each frame).
      window.__certWrite = { crossed: crossed, t: cT, pBThr: pBThreshold() };
      var inkedTimed = thrLen + cT * (total - thrLen);   // strokes 23..45 reveal on the timer
      var showing = (inkedScroll > 0.001 || cT > 0.001);
      // Nothing inked and nothing timed → the layer is fully transparent. Once it has
      // settled there (and the strokes were reset on the frame it became invisible)
      // there is nothing for the loop to say, so skip all 55 strokes.
      if (showing || lastLayerOp !== 0 || lastWritten !== written) {
        var acc = 0;
        for (var i = 0; i < segs.length; i++) {
          if (written) {
            // Popped: every stroke fully inked and snapped to one WIDE band (26) so the calligraphy
            // fills solidly — except thick27/thick28, which keep their own pen width (26 spills there).
            setSeg(i, "visible", "0", segPopW[i]);
          } else {
            // Strokes before thin24 scrub with scroll; thin24 onward reveal on the timer (inkedTimed).
            var ref = (segI[i] < THRESH_I) ? inkedScroll : inkedTimed;
            var lp = Math.max(0, Math.min((ref - acc) / lens[i], 1));
            // Hide a stroke until its ink reaches it (avoids round-cap dots on un-started strokes).
            setSeg(i, lp > 0 ? "visible" : "hidden", (lens[i] * (1 - lp)).toFixed(2), "");
          }
          acc += lens[i];
        }
        lastWritten = written;
      }
      var _op = showing ? 1 : 0;
      if (_op !== lastLayerOp) { lastLayerOp = _op; layer.style.opacity = _op; }
      layer.classList.toggle("is-written", written);
      // Clickable + hoverable from the moment the THRESHOLD is hit (crossed) — both directions:
      // it activates as the pen reaches thin24 on the way down, and stays active on scroll-up until
      // you cross back above the threshold. (The visual pop/fill is separate, tied to cT above.)
      setActive(crossed);
      applyColor();   // keep the hover blue in step with cT as it changes (it's gated by completion)
    }
    function tick(now) {                            // FORWARD only: ramp the timed completion to 1
      rafId = 0;
      var dt = lastT ? (now - lastT) : 16; lastT = now;
      if (!reduce && crossed && !reversing && cT < 1) cT = Math.min(cT + dt / DUR, 1);
      render(scrollInk());
      if (window.__updateHeroExit) window.__updateHeroExit();   // the video follows the timer
      var running = !reduce && crossed && !reversing && cT < 1;
      if (running) rafId = requestAnimationFrame(tick); else lastT = 0;
    }
    function kickRAF() { if (!rafId && !reduce) { lastT = 0; rafId = requestAnimationFrame(tick); } }
    function update() {
      var inkedScroll = scrollInk(), pB = pBNow();
      crossed = reduce ? (pB > 0.5) : (inkedScroll >= thrLen - 0.001);   // pen reached thin24?
      var up = pB < prevPB - 1e-6, down = pB > prevPB + 1e-6;
      prevPB = pB;
      if (!crossed) { reversing = false; pBMax = 0; cT = 0; }
      else {
        pBMax = Math.max(pBMax, pB);
        if (reduce) { cT = 1; }
        else if (up) { reversing = true; cT = Math.min(cT, reverseCT()); }   // scroll-driven un-write
        else if (down) { reversing = false; kickRAF(); }                     // forward → timed completion
        // (no movement while crossed: leave cT as-is; any in-flight timer keeps running)
      }
      render(inkedScroll);
      if (window.__updateHeroExit) window.__updateHeroExit();   // video tracks the fresh cT this frame
    }
    measure();
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", function () { measure(); update(); }, { passive: true });
    // Re-measure once the SVG has surely laid out (fonts/scale settle).
    window.addEventListener("load", function () { measure(); update(); });
  })();

  /* ---------- Moving-text marquee behind the hero (scroll-driven, Lando-style) ----------
     Replaces the old tool-logo marquee: big impact words (my tools/skills as TEXT) scroll
     horizontally in alternating rows behind the hero video, fading in + riding up exactly as
     the logos did. Same horizontal-loop mechanics; the children are now <span> words. */
  var marquee = document.querySelector(".tool-marquee");
  if (marquee) {
    // Two rows only, like the reference. Top row = filled darker blue (bold sans); bottom row
    // = outlined contrasting serif. Each row carries its own word set + font/colour modifier.
    var ROWS = [
      { dir: -1, speed: 120, mod: "is-top",
        set: ["PYTHON", "TYPESCRIPT", "DATA PIPELINES", "FASTAPI", "POSTGRESQL", "PYTORCH", "AWS"] },
      { dir:  1, speed: 140, mod: "is-bottom",
        set: ["WEB SCRAPING", "MACHINE LEARNING", "BACKEND APIS", "DOCKER", "PANDAS", "QUANT ANALYSIS"] }
    ];
    var COPIES = 4;                                          // repeats per row → seamless loop
    var rowEls = ROWS.map(function (cfg) {
      var row = document.createElement("div");
      row.className = "tool-marquee__row " + cfg.mod;
      for (var d = 0; d < COPIES; d++) {
        cfg.set.forEach(function (t) {
          var span = document.createElement("span");
          span.className = "tool-marquee__word";
          span.textContent = t;
          row.appendChild(span);
        });
      }
      marquee.appendChild(row);
      return { el: row, dir: cfg.dir, speed: cfg.speed, offset: 0, setW: 1, count: cfg.set.length };
    });
    // Cache each row's EXACT repeat stride = distance from the first item of copy 0 to the
    // first item of copy 1 (includes the inter-item gap). Using scrollWidth/COPIES was off by
    // the missing trailing gap, so the seam didn't line up → a jump at the wrap point.
    // Only re-measured on load/resize (per-frame measuring caused jitter while fonts load).
    function measure() {
      rowEls.forEach(function (r) {
        var a = r.el.children[0], b = r.el.children[r.count];
        r.setW = (b && a) ? (b.offsetLeft - a.offsetLeft) || 1 : 1;
      });
    }
    // Vertical position + fade follow scroll; horizontal motion is time-based (constant).
    // scrollSign flips the rows' horizontal direction with scroll direction: +1 on scroll
    // DOWN (rows move their natural way), -1 on scroll UP (both rows reverse). Held between
    // scrolls so an idle marquee keeps the last direction.
    var lastY = window.scrollY, scrollSign = 1;
    function updateMarquee() {
      var y = window.scrollY, vh = window.innerHeight;
      if (y < lastY) scrollSign = -1;
      else if (y > lastY) scrollSign = 1;
      lastY = y;
      // The marquee sits BEHIND the video — hidden during the pull-up (phase A, y < vh) AND
      // the fullscreen checkpoint dwell; it fades in as the video zooms out (phase B)...
      var ye = window.__heroY ? window.__heroY(y, vh) : y;
      marquee.style.opacity = Math.max(0, Math.min((ye - vh) / (vh * 0.55), 1));
      // ...then rides UP with the video as it hands over to the flow (phase C, ye > 2vh).
      var lift = Math.max(0, ye - 2 * vh);
      marquee.style.transform = "translate3d(0," + (-lift) + "px,0)";
    }
    var lastT = 0;
    function tick(now) {
      var dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 0;  // clamp so a tab-resume can't jump
      lastT = now;
      rowEls.forEach(function (r) {
        var setW = r.setW;
        r.offset += r.dir * scrollSign * r.speed * dt;
        var wrapped = ((r.offset % setW) + setW) % setW; // 0 → setW, seamless wrap
        r.el.style.transform = "translate3d(" + (wrapped - setW) + "px,0,0)";
      });
      requestAnimationFrame(tick);
    }
    function onResize() { measure(); updateMarquee(); }
    window.addEventListener("scroll", updateMarquee, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("load", onResize);          // re-measure once fonts affect layout
    measure();
    updateMarquee();
    requestAnimationFrame(tick);
  }

  /* ---------- GitHub card: revealed OVER the video during the hero's internal
     zoom-out (phase A, the 1.55→1.0 pull-back), faded out as the edge zoom-out
     begins. Live profile/repo data pulled from the GitHub REST API (unauthenticated;
     falls back to the static markup on any error / before it resolves). ---------- */
  var ghReveal = document.querySelector(".gh-reveal");
  if (ghReveal) {
    var ghCard = ghReveal.querySelector(".gh-card");
    var GH_USER = "VishnujanNarayanan";
    function ghEl(k) { return ghReveal.querySelector('[data-gh="' + k + '"]'); }
    // GitHub dark-theme contribution palette: empty cell + 4 green levels.
    var GH_LEVELS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
    var GH_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    // Render the last-year calendar as an SVG grid (weeks = columns, day-of-week = rows),
    // matching GitHub's dark theme — so empty days are dark (#161b22), not white.
    function ghBuildGraph(contribs) {
      var chart = ghEl("chart");
      if (!chart || !Array.isArray(contribs) || !contribs.length) return;
      var STEP = 13, SIZE = 11, TOP = 18, col = 0, lastMonth = -1, lastLabelCol = -99, cells = "", labels = "";
      var first = new Date(contribs[0].date + "T00:00:00Z");
      var stubMonth = first.getUTCDate() > 7 ? first.getUTCMonth() : -1;  // leading partial month → skip its label
      contribs.forEach(function (d, i) {
        var dt = new Date(d.date + "T00:00:00Z"), dow = dt.getUTCDay();
        if (i > 0 && dow === 0) col++;
        var x = col * STEP, y = TOP + dow * STEP;
        cells += '<rect x="' + x + '" y="' + y + '" width="' + SIZE + '" height="' + SIZE +
          '" rx="2" ry="2" fill="' + (GH_LEVELS[d.level] || GH_LEVELS[0]) + '"/>';
        if (dow === 0) {
          var m = dt.getUTCMonth();
          // label each month once, but skip the leading stub month and keep ≥3 columns between labels.
          if (m !== lastMonth) {
            lastMonth = m;
            if (m !== stubMonth && col - lastLabelCol >= 3) {
              labels += '<text x="' + x + '" y="11" fill="#7d8590" font-size="9">' + GH_MONTHS[m] + '</text>';
              lastLabelCol = col;
            }
          }
        }
      });
      // +16 right padding so a last-column label isn't clipped; -4 top so the month text
      // (which sits above y=0) has headroom and isn't shaved at the top edge of the viewBox.
      var w = (col + 1) * STEP - (STEP - SIZE) + 16, h = TOP + 7 * STEP - (STEP - SIZE);
      chart.innerHTML = '<svg viewBox="0 -4 ' + w + " " + (h + 4) + '" preserveAspectRatio="xMinYMin meet">' + labels + cells + "</svg>";
    }
    // --- live data ---
    (function fetchGitHub() {
      if (!window.fetch) return;                               // keep static fallback
      fetch("https://api.github.com/users/" + GH_USER)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (u) {
          var av = ghEl("avatar"); if (av && u.avatar_url) { av.src = u.avatar_url; av.alt = (u.name || GH_USER) + " on GitHub"; }
          var h = ghEl("handle"); if (h) h.textContent = "@" + (u.login || GH_USER);
          var bio = ghEl("bio"); if (bio && u.bio) bio.textContent = u.bio;
        })
        .catch(function () {});                                 // silent → static fallback stays
      fetch("https://api.github.com/users/" + GH_USER + "/repos?per_page=100&sort=updated")
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (list) {
          if (!Array.isArray(list) || !list.length) return;
          var top = list.filter(function (r) { return !r.fork; })
            .sort(function (a, b) {
              return (b.stargazers_count || 0) - (a.stargazers_count || 0) ||
                     (new Date(b.pushed_at) - new Date(a.pushed_at));
            })
            .slice(0, 8);
          var ul = ghEl("repos-list");
          if (ul && top.length) {
            ul.innerHTML = top.map(function (r) {
              var li = document.createElement("li"); li.textContent = r.name; return li.outerHTML;
            }).join("");
          }
        })
        .catch(function () {});
      // Last-year contribution TOTAL (GitHub's REST API can't return it without auth; this
      // public endpoint mirrors the contribution calendar). Silent fallback to the static "—".
      fetch("https://github-contributions-api.jogruber.de/v4/" + GH_USER + "?y=last")
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (d) {
          // Keep only the last 8 months of the daily calendar.
          var contribs = (d && d.contributions) || [];
          var cut = new Date(); cut.setMonth(cut.getMonth() - 8);
          var cutStr = cut.toISOString().slice(0, 10);
          contribs = contribs.filter(function (c) { return c.date >= cutStr; });
          var total = contribs.reduce(function (s, c) { return s + (c.count || 0); }, 0);
          var el = ghEl("contrib");
          if (el) el.textContent = total.toLocaleString();
          ghBuildGraph(contribs);
        })
        .catch(function () {});
    })();
    // --- scroll reveal (synced to phase A's internal zoom-out) ---
    function smooth(t) { return t * t * (3 - 2 * t); }
    // The card is ANCHORED TO THE VIDEO: it tracks the video's vertical motion (the same
    // vTy the hero uses) so it rides UP with the video as it comes up, instead of being
    // stuck to the page. Its CSS height is the FULL/design size (GH_END of the viewport);
    // scaling it makes it read smaller, so it GROWS from the bottom-left corner from
    // GH_START → GH_END as the video reaches fullscreen. No fade, no rotation, no slide
    // independent of the video.
    var GH_START = 0.40, GH_END = 0.65;           // visual height (× viewport): at reveal → at fullscreen
    var GH_EXIT_MIN = 0.35;                        // MUST match the hero's EXIT_MIN_SCALE (video edge zoom-out floor)
    var GH_FADE_END = 0.5;                         // pB at which the handwriting starts (scrollInk) → card fully faded by here
    var GH_CARD_SHRINK = 0.4;                      // extra shrink OF THE CARD within the rectangle as it fades (1 → 0.6)
    function updateGhCard() {
      var y = window.scrollY, vh = window.innerHeight;
      var ye = window.__heroY ? window.__heroY(y, vh) : y;   // dwell-aware effective scroll
      if (ye <= vh) {
        // Phase A: ride up WITH the video (ty = vh − ye, the video's own translate), so the
        // card emerges from the video's bottom and settles as the video fills the screen.
        // Through the fullscreen checkpoint dwell ye == vh, so it stays settled. The reveal
        // LAYER is untransformed here; only the card rides up + grows.
        var ty = vh - ye;
        var g = smooth(Math.max(0, Math.min(ye / vh, 1)));
        var frac = GH_START + (GH_END - GH_START) * g;   // 0.40 → 0.65 of the viewport
        var sc = frac / GH_END;                          // 0.615 → 1 (card's base height is GH_END)
        ghReveal.style.opacity = "1";
        ghReveal.style.transform = "none";
        ghCard.style.transformOrigin = "50% 100%";       // grow up from the bottom on the way in
        ghCard.style.transform = "translateY(" + ty.toFixed(1) + "px) scale(" + sc.toFixed(3) + ")";
        ghReveal.classList.toggle("is-live", ye >= 0.6 * vh && ye <= vh * 1.02);
      } else {
        // Phase B: ANCHOR the card TO THE VIDEO. The reveal layer is fixed inset:0 like the video
        // and shares its 50% 50% origin, so scaling/translating the WHOLE layer by the video's own
        // edge-zoom transform makes the card recede INSIDE the shrinking video rectangle instead of
        // spilling outside it. `prog`/`eB`/scale mirror updateHeroExit exactly, so the SHRINK tracks
        // the video the whole way down.
        var pB = Math.max(0, Math.min((ye - vh) / vh, 1));
        var cw = window.__certWrite, prog;
        if (cw && cw.crossed) {
          var ct = cw.t * cw.t * (3 - 2 * cw.t);
          prog = cw.pBThr + (1 - cw.pBThr) * ct;
        } else {
          prog = pB;
        }
        var eB = prog * prog * (3 - 2 * prog);           // same smoothstep the video uses
        var vidScale = 1 - (1 - GH_EXIT_MIN) * eB;       // 1 → EXIT_MIN_SCALE, exactly like the video
        var vTy = -Math.max(0, ye - 2 * vh);             // the video's own phase-B/C translate
        // OPACITY fades faster than the shrink: the card must be FULLY gone by the time the
        // handwritten "certificates" strokes begin (scrollInk starts inking at pB = GH_FADE_END),
        // so it clears the frame before the writing appears. Scale keeps tracking the video past
        // that, but the card is already invisible.
        var fp = Math.max(0, Math.min(pB / GH_FADE_END, 1));
        var fade = fp * fp * (3 - 2 * fp);               // smoothstep → op 1 → 0 over pB [0, GH_FADE_END]
        // The layer scale locks the card to the video rectangle's PROPORTION. On top of that the
        // card ALSO shrinks RELATIVE to the rectangle (into it, from its bottom-centre origin) as it
        // fades — so it reads as receding into the rectangle rather than just dimming at full size.
        var cardShrink = 1 - GH_CARD_SHRINK * fade;      // 1 → (1 − GH_CARD_SHRINK) over the fade window
        ghCard.style.transformOrigin = "50% 50%";        // fade-out: shrink toward the CENTRE, not the bottom
        ghCard.style.transform = "scale(" + cardShrink.toFixed(3) + ")";
        ghReveal.style.transform = "translateY(" + vTy.toFixed(1) + "px) scale(" + vidScale.toFixed(4) + ")";
        ghReveal.style.opacity = (1 - fade).toFixed(3);
        ghReveal.classList.remove("is-live");
      }
    }
    window.addEventListener("scroll", updateGhCard, { passive: true });
    window.addEventListener("resize", updateGhCard, { passive: true });
    updateGhCard();
  }

  /* ---------- Global background: Lando's hand-drawn topographic contours ----------
     One fixed full-viewport plane shared by the hero zoom-out reveal AND the flow
     section (so they read as the same continuous background). The contours are the
     reference site's hand-drawn blob sheet (images/footer-blobs.svg — 11 smooth
     closed loops), scaled to cover the viewport and gently warped each frame by a
     drifting noise field + cursor repulsion so they stay subtly alive. */
  (function () {
    var cv = document.createElement("canvas");          // global plane (blue, dark bg)
    cv.id = "bg-contours";
    document.body.appendChild(cv);
    var ctx = cv.getContext("2d");
    // Same pattern rendered inside the hero in a DARKER shade (reads on the light hero
    // gradient). Both draw the identical field at the same screen coords, so scrolling
    // out of the hero is seamless — the hero pattern IS this background playing through.
    var heroBg = document.querySelector(".hero__bg");
    var hcv = null, hctx = null;
    if (heroBg) { hcv = document.createElement("canvas"); hcv.id = "hero-contours"; heroBg.appendChild(hcv); hctx = hcv.getContext("2d"); }
    // Writing section: its OWN contour plane (same shared field), painted with a vertical
    // gradient so the section reads as zone-4 (light blue, dark lines) at the TOP easing to
    // zone-1 (dark navy, light-blue lines) at the BOTTOM — the flow's light→dark, frozen
    // vertically. Inserted first so the strips paint on top of it.
    var writingPin = document.querySelector(".writing__pin");
    var featuresEl = document.querySelector(".features");
    var wcv = null, wctx = null;
    if (writingPin) { wcv = document.createElement("canvas"); wcv.id = "writing-contours"; writingPin.insertBefore(wcv, writingPin.firstChild); wctx = wcv.getContext("2d"); }
    // The content sections AFTER the blog (Selected work / Skills / Services) continue the
    // dark world: each gets its OWN contour canvas filled with zone-1 navy + light-blue lines,
    // drawn viewport-aligned so the field runs continuously out of the blog's dark bottom and
    // straight through them. Canvas is sized to the WHOLE section (handles tall / sticky / the
    // accordion growing) and inserted first so the section content paints on top.
    var darkSecs = [];
    [".features", ".brand-teaser", ".brand-manifesto", ".faq"].forEach(function (sel) {
      var el = document.querySelector(sel); if (!el) return;
      var c = document.createElement("canvas"); c.className = "section-contours";
      el.insertBefore(c, el.firstChild);
      // The projects section (.features) keeps the solid backing but NO contour
      // lines (user request) — and a DARKER near-black navy fill so it reads like the
      // black terminal bar. Skills (.standards) uses the SAME LIGHT field as the blog
      // (light-blue fill + dark indigo lines), not the dark navy one. Services (.faq)
      // keeps the standard dark navy + its light-blue lines.
      var isFeatures = sel === ".features", isSkills = sel === ".brand-teaser" || sel === ".brand-manifesto";
      darkSecs.push({
        el: el, cv: c, ctx: c.getContext("2d"), w: 0, h: 0, ty: -1,
        noLines: isFeatures,
        // Brand zone: contour lines fade to the fill colour so they're invisible
        // by the time the manifesto ("I build data systems...") fills the screen.
        // Teaser fades as it scrolls OUT the top; manifesto fades as it scrolls IN
        // (gone once its top reaches the viewport top) — the two stay continuous
        // across the seam (both 100vh).
        fadeOut: sel === ".brand-teaser" || sel === ".brand-manifesto",
        fadeMode: sel === ".brand-manifesto" ? "enter" : "through",
        lineBaseA: isSkills ? 0.5 : 0.45,
        fill: isFeatures ? "rgb(15,22,40)" : isSkills ? "rgb(208,225,235)" : "rgb(27,34,54)",
        line: isSkills ? "rgba(57,50,220,0.5)" : "rgba(77,139,255,0.45)"
      });
    });
    var W = 0, H = 0, DPR = 1, CELL = 12, cols = 0, rows = 0, field = [];
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    // tiny value noise (for domain-warping the field → breaks perfect circles/ovals)
    //
    function vh(i, j) { var n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); }
    // The resample called vh() 8x per grid cell — 119,232 Math.sin per frame at
    // 1920x1080 — but the noise LATTICE is enormously coarser than the grid: the warp
    // frequency is wf = 1.5/min(W,H), so one lattice cell spans ~1/1.5 of the viewport
    // and a whole grid row crosses only ~3 of them. Consecutive cells therefore ask for
    // the SAME four corner hashes over and over.
    // So each call site gets its own one-entry memo of the current lattice cell and
    // recomputes the four corners only when (ix,iy) actually changes — a few dozen sin
    // calls per frame instead of 119k, and bit-identical output since it is the same
    // vh() on the same integers. (A precomputed wrap-around table was tried first and
    // is WRONG: the y input goes negative as time drifts, and vh(-12) is not vh(244).)
    function makeNoise() {
      var cix = NaN, ciy = NaN, a = 0, b = 0, c2 = 0, d = 0;
      return function (x, y) {
        var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
        if (ix !== cix || iy !== ciy) {
          cix = ix; ciy = iy;
          a = vh(ix, iy); b = vh(ix + 1, iy); c2 = vh(ix, iy + 1); d = vh(ix + 1, iy + 1);
        }
        var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
        return (a * (1 - ux) + b * ux) * (1 - uy) + (c2 * (1 - ux) + d * ux) * uy;
      };
    }
    var noiseWarpX = makeNoise(), noiseWarpY = makeNoise();
    // exp(-z) for z >= 0, sampled + linearly interpolated. The field's only exponentials
    // are Gaussians exp(-z); beyond z = EXP_MAX the value is < 1e-6, which against blob
    // weights of ~0.2 and contour LEVELS spaced 0.16 apart is far below anything that
    // could move a line. Interpolation error is ~4e-6, likewise irrelevant.
    var EXP_MAX = 14, EXP_N = 2048, EXP_SC = EXP_N / EXP_MAX, EXPT = new Float32Array(EXP_N + 2);
    (function () {
      for (var k = 0; k <= EXP_N + 1; k++) EXPT[k] = Math.exp(-k / EXP_SC);
    })();
    function fexp(z) {                       // z >= 0
      if (z >= EXP_MAX) return 0;
      var f = z * EXP_SC, k = f | 0;
      var g = f - k;
      return EXPT[k] + (EXPT[k + 1] - EXPT[k]) * g;
    }
    // u-space cutoffs for the two blob Gaussians (u = (d/r)^2): past these the term
    // is below the table's floor, so the cell/blob pair contributes nothing.
    var HALO_CUT = 12.5 * EXP_MAX, CORE_CUT = 2 * EXP_MAX;
    // Lando blob sheet: the reference site's contour "pattern" is a HAND-DRAWN SVG of
    // 11 smooth closed loops (blobs_footer_1.svg — already local as images/footer-blobs.svg,
    // viewBox 1688x1056), not a procedural field. Instead of stroking it verbatim (static),
    // the sheet is rasterized into a smooth BASE SCALAR FIELD (fill + blur at grid res) and
    // the contours are marching-squares iso-lines of base + drifting metaball perturbation —
    // so the lines keep Lando's shapes/spacing but still MERGE, SPLIT, appear and vanish
    // organically like the old metaball field did.
    var SHEET_W = 1688, SHEET_H = 1056, PATHS = [];
    fetch("images/footer-blobs.svg").then(function (r) { return r.text(); }).then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, "image/svg+xml");
      doc.querySelectorAll("path[d]").forEach(function (p) {
        PATHS.push(new Path2D(p.getAttribute("d")));
      });
      buildBase();
      if (reduce) requestAnimationFrame(frame);   // static path: draw once now the sheet exists
    }).catch(function () {});
    // Rasterize the sheet → base field on a FINE grid (BCELL px): fill the loops white,
    // then blur WIDE — the blur is what makes the level-sets round and silky (a steep
    // ramp makes the iso-lines hug the hard rasterized edge and pick up every pixel
    // kink; a wide one gives gentle analytic-feeling gradients like the old metaballs).
    // It also sets how far apart the nested iso-levels sit. Alpha is read back and the
    // plateau normalized to 1.0; the perturbation blobs (±~0.3) push regions across the
    // iso levels (merge/split) — the top level (0.86) sits close enough to the plateau
    // that they also birth/kill the innermost loops.
    var baseCv = document.createElement("canvas"), baseCtx = baseCv.getContext("2d", { willReadFrequently: true });
    var B = null, bw = 0, bh = 0, BCELL = 10;
    function buildBase() {
      if (!PATHS.length || !W) return;
      bw = Math.ceil(W / BCELL) + 2; bh = Math.ceil(H / BCELL) + 2;
      baseCv.width = bw; baseCv.height = bh;
      var g = baseCtx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, bw, bh);
      var sc = Math.max(W / SHEET_W, H / SHEET_H) * 1.12 / BCELL;  // sheet units → base cells, over-scanned
      g.setTransform(sc, 0, 0, sc, (bw - SHEET_W * sc) / 2, (bh - SHEET_H * sc) / 2);
      g.filter = "blur(15px)";                                     // ≈ 150px smoothing on screen → chunky-round shapes
      g.fillStyle = "#fff";
      for (var i = 0; i < PATHS.length; i++) g.fill(PATHS[i]);
      g.filter = "none";
      var data = g.getImageData(0, 0, bw, bh).data, n = bw * bh, p;
      B = new Float32Array(n);
      for (p = 0; p < n; p++) B[p] = data[p * 4 + 3] / 255;
      // Float box-blur to melt the 8-bit quantization terraces from the alpha readback —
      // wherever the field is nearly flat those 1/255 steps otherwise fizz into jagged,
      // angular marching-squares lines (THE source of the rough look).
      var T = new Float32Array(n);
      blurPass(B, T, 1, 0); blurPass(T, B, 0, 1);
      blurPass(B, T, 1, 0); blurPass(T, B, 0, 1);
      blurPass(B, T, 1, 0); blurPass(T, B, 0, 1);
      var max = 0;
      for (p = 0; p < n; p++) if (B[p] > max) max = B[p];
      if (max > 0) { var k = 1 / max; for (p = 0; p < n; p++) B[p] *= k; }
    }
    function blurPass(src, dst, dx, dy) {
      for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
        var acc = 0;
        for (var k = -2; k <= 2; k++) {
          var xx = x + dx * k, yy = y + dy * k;
          if (xx < 0) xx = 0; else if (xx >= bw) xx = bw - 1;
          if (yy < 0) yy = 0; else if (yy >= bh) yy = bh - 1;
          acc += src[yy * bw + xx];
        }
        dst[y * bw + x] = acc / 5;
      }
    }
    // BICUBIC (Catmull-Rom) sample of the base field at (fractional) grid coords.
    // Bilinear sampling kinks the iso-line direction at every grid-cell edge (piecewise-
    // linear surface → C0 gradient) which reads as rough, polygonal lines; Catmull-Rom is
    // C1-smooth so the level-sets curve continuously, like the old analytic metaball field.
    function crom(p0, p1, p2, p3, f) {
      return p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)));
    }
    function sampleBase(gx, gy) {
      if (!B) return 0;
      var x = gx < 1 ? 1 : gx > bw - 2.001 ? bw - 2.001 : gx;
      var y = gy < 1 ? 1 : gy > bh - 2.001 ? bh - 2.001 : gy;
      var ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy;
      var i1 = iy * bw + ix, i0 = i1 - bw, i2 = i1 + bw, i3 = i2 + bw;
      return crom(
        crom(B[i0 - 1], B[i0], B[i0 + 1], B[i0 + 2], fx),
        crom(B[i1 - 1], B[i1], B[i1 + 1], B[i1 + 2], fx),
        crom(B[i2 - 1], B[i2], B[i2 + 1], B[i2 + 2], fx),
        crom(B[i3 - 1], B[i3], B[i3 + 1], B[i3 + 2], fx), fy);
    }
    // Perturbation metaballs (the old drift, kept): SIGNED weights — positive blobs bulge
    // and MERGE neighbouring loops, negative ones carve and SPLIT them; the pulse swings
    // each blob's strength so features also appear/fade. Small radii/amplitudes so the
    // Lando geometry stays recognisable underneath.
    var BLOBS = [];
    function seedBlobs() {
      BLOBS = [];
      for (var i = 0; i < 10; i++) {
        // capped below LEVELS[0] so a POSITIVE blob alone in empty space can't cross the
        // level and spawn tiny debris loops — it only merges/splits where the base is
        // near. Negative blobs (carve/split) don't have that failure mode, so they run
        // a bit stronger for livelier splitting.
        var mag = 0.16 + Math.random() * 0.11;
        BLOBS.push({
          bx: 0.05 + Math.random() * 0.9,
          by: 0.05 + Math.random() * 0.9,
          ox: 0.14 + Math.random() * 0.18, oy: 0.14 + Math.random() * 0.18,
          sx: 0.08 + Math.random() * 0.14, sy: 0.08 + Math.random() * 0.14,
          px: Math.random() * 6.28, py: Math.random() * 6.28,
          r: 0.11 + Math.random() * 0.10,
          w: i % 2 ? -(mag * 1.35) : mag,
          pulse: 0.35 + Math.random() * 0.9,
          pph: Math.random() * 6.28
        });
      }
    }
    // Thinnest possible contour stroke. The 2D context is scaled by DPR, so a lineWidth
    // of 1/DPR is exactly ONE DEVICE pixel — the finest line that still rasterises
    // crisply. (Going below that does not get thinner, it just fades the line out via
    // coverage anti-aliasing.) Recomputed on resize, since DPR changes when the window
    // is moved between displays.
    var LINE_W = 1;
    function lineWidthPx() { LINE_W = 1 / DPR; }
    function sizeCanvas(canvas, context) {
      canvas.width = W * DPR; canvas.height = H * DPR;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      context.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      lineWidthPx();
      sizeCanvas(cv, ctx); if (hcv) sizeCanvas(hcv, hctx); if (wcv) sizeCanvas(wcv, wctx);
      cols = Math.ceil(W / CELL) + 1; rows = Math.ceil(H / CELL) + 1;
      buildBase();
    }
    seedBlobs(); resize();
    window.addEventListener("resize", resize, { passive: true });
    // Cursor repulsion — the contour lines bend very subtly AWAY from the pointer within
    // a soft radius. The influence point (mxE,myE) LAGS the real cursor and the strength
    // (mAmt) fades in/out slowly, so the reaction trails and lingers (momentum) instead of
    // snapping. All in screen coords: the shared field is sampled in screen space, so this
    // lands in the right place on every contour canvas. reduced-motion: no rAF loop runs.
    var mxT = -1, myT = -1;        // raw pointer (screen px); -1 = absent
    var mxE = -1, myE = -1;        // eased influence point (the lag = momentum)
    var mAmt = 0, mAmtT = 0;       // strength envelope: 1 while the pointer is over the page
    if (!reduce) {
      window.addEventListener("pointermove", function (e) {
        mxT = e.clientX; myT = e.clientY; mAmtT = 1;
      }, { passive: true });
      window.addEventListener("pointerleave", function () { mAmtT = 0; }, { passive: true });
      document.addEventListener("mouseleave", function () { mAmtT = 0; }, { passive: true });
    }
    var REPEL_R = 320;             // radius of influence (px) — recomputed on resize below
    var REPEL_K = 0.3;             // push strength (dimensionless); peak shift ≈ 0.6·R·K px
    function repelRadius() { REPEL_R = Math.max(240, Math.min(W, H) * 0.33); }
    repelRadius(); window.addEventListener("resize", repelRadius, { passive: true });
    // Levels reach deep into the interior (plateau = 1.0) so big shapes carry CONCENTRIC
    // inner loops (blobs inside blobs), not just edge echoes; the bottom level is nudged
    // up so faint isolated fringes drop out.
    var LEVELS = [0.34, 0.50, 0.66, 0.82, 0.94];
    function lerp(a, b, t) { return a + (b - a) * t; }
    // marching squares over the shared field → closed, non-overlapping contours.
    // Pulled out so the section canvases (which fill their own full height) can reuse the
    // exact same iso-line pass without going through drawContours' viewport-sized clear/fill.
    function strokeIso(g) {
      var li, lv, r, c;
      for (li = 0; li < LEVELS.length; li++) {
        lv = LEVELS[li];
        g.beginPath();
        for (r = 0; r < rows; r++) {
          for (c = 0; c < cols; c++) {
            var x0 = c * CELL, y0 = r * CELL, x1 = x0 + CELL, y1 = y0 + CELL;
            var tl = field[r][c], tr = field[r][c + 1], br2 = field[r + 1][c + 1], bl = field[r + 1][c];
            var idx = (tl > lv ? 8 : 0) | (tr > lv ? 4 : 0) | (br2 > lv ? 2 : 0) | (bl > lv ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            var Tx = lerp(x0, x1, (lv - tl) / (tr - tl));
            var Ry = lerp(y0, y1, (lv - tr) / (br2 - tr));
            var Bx = lerp(x0, x1, (lv - bl) / (br2 - bl));
            var Ly = lerp(y0, y1, (lv - tl) / (bl - tl));
            switch (idx) {
              case 1: case 14: g.moveTo(x0, Ly); g.lineTo(Bx, y1); break;
              case 2: case 13: g.moveTo(Bx, y1); g.lineTo(x1, Ry); break;
              case 3: case 12: g.moveTo(x0, Ly); g.lineTo(x1, Ry); break;
              case 4: case 11: g.moveTo(Tx, y0); g.lineTo(x1, Ry); break;
              case 6: case 9:  g.moveTo(Tx, y0); g.lineTo(Bx, y1); break;
              case 7: case 8:  g.moveTo(x0, Ly); g.lineTo(Tx, y0); break;
              case 5:  g.moveTo(x0, Ly); g.lineTo(Tx, y0); g.moveTo(Bx, y1); g.lineTo(x1, Ry); break;
              case 10: g.moveTo(x0, Ly); g.lineTo(Bx, y1); g.moveTo(Tx, y0); g.lineTo(x1, Ry); break;
            }
          }
        }
        g.stroke();
      }
    }
    function drawContours(g, stroke, bgFill, oy) {
      g.clearRect(0, 0, W, H);
      if (bgFill) { g.fillStyle = bgFill; g.fillRect(0, 0, W, H); }
      // oy shifts the iso-lines into VIEWPORT space (the field is sampled in screen coords).
      // A scrolling canvas passes oy = -rect.top so its lines coincide exactly with the fixed
      // #bg-contours plane → the contour field reads as ONE continuous background across sections.
      g.save(); if (oy) g.translate(0, oy);
      g.lineCap = "round"; g.lineJoin = "round";
      g.strokeStyle = stroke; g.lineWidth = LINE_W;
      strokeIso(g);
      g.restore();
    }
    /* ---------- Geometry cache ----------
       This loop read a getBoundingClientRect (and an offsetHeight) per dark section
       EVERY frame. Each of those flushes style+layout, and on a ~17,000px document a
       single flush measured in the multiple-milliseconds — dwarfing the field maths.
       A section's position in the DOCUMENT and its height do not change while
       scrolling, so they are measured once and the viewport rect is derived as
       (documentTop - scrollY). Reading scrollY does not flush.
       Invalidated on resize, after load/fonts, and by sizeSection() — which is the one
       thing that legitimately changes a section's height at runtime (the projects
       filter re-sizes .features). */
    // NOTE: .writing__pin is position:sticky, so its viewport rect CANNOT be derived as
    // (documentTop - scrollY) — once it sticks, the real rect.top clamps to 0 while the
    // derived value keeps going negative, and that wrong offset shifts the blog's
    // contour lines off their canvas (they appear cut off / sliding). Only its STATIC
    // parent section is cached, purely as a cheap on-screen test; the sticky pin itself
    // is read live, and only on the frames the blog is actually visible.
    var wsTop = 0, wsH = 0;
    var writingSec = writingPin ? (writingPin.closest(".writing") || writingPin.parentNode) : null;
    function scrollY0() { return window.scrollY || window.pageYOffset || 0; }
    function measureSecs() {
      var sy = scrollY0(), i, r;
      for (i = 0; i < darkSecs.length; i++) {
        r = darkSecs[i].el.getBoundingClientRect();
        darkSecs[i].docTop = r.top + sy;
        darkSecs[i].docH = r.height;
      }
      if (writingSec) { r = writingSec.getBoundingClientRect(); wsTop = r.top + sy; wsH = r.height; }
    }
    // Same fields this loop reads off a DOMRect.
    function rectOf(top, h) { var t = top - scrollY0(); return { top: t, bottom: t + h, height: h }; }
    measureSecs();
    window.addEventListener("resize", measureSecs, { passive: true });
    window.addEventListener("load", measureSecs);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureSecs);
    window.__remeasureContours = measureSecs;   // sizeSection() calls this after resizing .features
    var featuresGeo = null;
    for (var fg = 0; fg < darkSecs.length; fg++) if (darkSecs[fg].el === featuresEl) featuresGeo = darkSecs[fg];
    // First LIGHT section below the dark projects run — .brand-teaser (#skills). Its top
    // is where the header has to reel back to black; see the world flip in frame().
    var lightEl = document.querySelector(".brand-teaser"), lightGeo = null;
    for (var lg = 0; lg < darkSecs.length; lg++) if (darkSecs[lg].el === lightEl) lightGeo = darkSecs[lg];
    var t = 0, last = 0, navDark = false, ctaDark = false;   // nav reel + CTA pills flip TOGETHER, on at .features and off at .brand-teaser
    // Perf: the field resample (rows×cols cells, noise+exp each) dominates frame cost.
    // The field is time-driven only (scroll alignment happens at draw time via translate),
    // and it drifts slowly — so when the cursor repel is idle it's resampled every OTHER
    // frame. Repel active → full rate so the bubble tracks the pointer. A rows/cols change
    // (resize) forces a resample so strokeIso never reads a stale-sized grid.
    var frameNo = 0, fieldRows = -1, fieldCols = -1;
    var sideCvEl = null;                                 // cached ".term-side-contours" lookup
    function frame(now) {
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0; last = now;
      t += dt * 0.5;                                     // drift speed
      // Ease the influence point toward the cursor (lag → momentum) and fade the strength;
      // when the pointer leaves, mAmtT=0 eases the effect back out over ~a second.
      if (mxT >= 0) { if (mxE < 0) { mxE = mxT; myE = myT; } mxE += (mxT - mxE) * 0.055; myE += (myT - myE) * 0.055; }
      mAmt += (mAmtT - mAmt) * (mAmtT > mAmt ? 0.04 : 0.010);
      var repel = mAmt > 0.002 && mxE >= 0;              // skip the per-cell work when idle
      var rInv = 1 / (2 * REPEL_R * REPEL_R), rKick = REPEL_K * mAmt;
      // Warp kept SMALL and BROAD: big amplitude/short wavelength made the lines wobble
      // lumpily — Lando's curves are dead smooth, so this is just a slow large-scale sway.
      var md = Math.min(W, H), wf = 1.5 / md, warp = md * 0.02;
      frameNo++;
      var needField = repel || (frameNo & 1) === 0 || fieldRows !== rows || fieldCols !== cols;
      if (needField) {
      fieldRows = rows; fieldCols = cols;
      var bx = [], by = [], br = [], bw2 = [], bri2 = [], i, c, r;
      for (i = 0; i < BLOBS.length; i++) {
        var b = BLOBS[i];
        bx[i] = (b.bx + Math.cos(t * b.sx * 6.28 + b.px) * b.ox) * W;
        by[i] = (b.by + Math.sin(t * b.sy * 6.28 + b.py) * b.oy) * H;
        br[i] = b.r * md;
        bri2[i] = 1 / (br[i] * br[i]);       // hoisted: the cell loop multiplies, never divides
        // pulse swings the SIGNED strength (never flips sign) → features grow/fade
        bw2[i] = b.w * (0.65 + 0.35 * Math.sin(t * b.pulse + b.pph));
      }
      for (r = 0; r <= rows; r++) {
        field[r] = field[r] || [];
        for (c = 0; c <= cols; c++) {
          var px = c * CELL, py = r * CELL;
          var wx = px + (noiseWarpX(px * wf + t * 0.3, py * wf) - 0.5) * 2 * warp;
          var wy = py + (noiseWarpY(px * wf + 5.2, py * wf - t * 0.3) - 0.5) * 2 * warp;
          if (repel) {
            // Sample TOWARD the cursor (fall peaks at ~R) so the pattern renders pushed
            // AWAY from it — the lines bow out of a soft bubble. Zero at the exact centre
            // and beyond the radius, so nothing snaps or spikes.
            var tox = mxE - px, toy = myE - py;
            var fall = fexp((tox * tox + toy * toy) * rInv) * rKick;
            wx += tox * fall; wy += toy * fall;
          }
          // Lando base shape at the warped coords + the signed drifting perturbation:
          // positive blobs bulge/merge the loops, negative ones pinch/split them.
          var sum = sampleBase(wx / BCELL, wy / BCELL);
          for (i = 0; i < BLOBS.length; i++) {
            var dx = wx - bx[i], dy = wy - by[i], d2 = dx * dx + dy * dy;
            // core + a WIDE, WEAK halo (2.5x radius, quarter strength): loops near a
            // passing blob lean subtly toward/away from it before the core arrives.
            // u = (d/r)^2, so both terms become exp(-u*k) off the shared table.
            // Cells far outside the halo are skipped: at u > 12.5*EXP_MAX the halo is
            // already under 1e-6, and the core (2.5x tighter) vanished long before.
            var u = d2 * bri2[i];
            if (u > HALO_CUT) continue;
            var s = 0.20 * fexp(u * 0.08);                 // halo: 1/12.5
            if (u < CORE_CUT) s += fexp(u * 0.5);          // core: 1/2
            sum += bw2[i] * s;
          }
          field[r][c] = sum;
        }
      }
      }                                                  // end needField
      // Flow lightening (shared from flow.js): lt 0 = dark navy world (lines stay
      // blue), lt 1 = light bg by end of zone 4 (canvas filled light, lines INVERT
      // to the darker site blue so they read on the light bg). lt 0 → no fill, so
      // the navy shader shows through unchanged outside/before the flow.
      var lt = window.__flowLight || 0;
      var bgFill = lt > 0
        ? "rgb(" + Math.round(lerp(15, 208, lt)) + "," + Math.round(lerp(22, 225, lt)) + "," + Math.round(lerp(40, 235, lt)) + ")"
        : null;
      var lineCol = "rgba(" + Math.round(lerp(77, 57, lt)) + "," + Math.round(lerp(139, 50, lt)) +
        "," + Math.round(lerp(255, 220, lt)) + "," + lerp(0.3, 0.5, lt).toFixed(2) + ")";
      drawContours(ctx, lineCol, bgFill);                // global: blue → inverted dark-blue on light
      if (hctx) {                                        // hero: same blue-grey as end bg — skip once scrolled past
        var hr = hcv.getBoundingClientRect();
        if (hr.bottom > 0 && hr.top < H) drawContours(hctx, "#969ba8");
      }
      // Header world flip, handed off from the (light) blog to the (dark) features
      // section: BOTH the nav reel AND the CTA pills switch together the MOMENT the
      // features section hits its threshold — rect.top ≤ 0, i.e. when its dark navy
      // bg reaches/covers the fixed header (the same threshold the terminal reveals
      // at). Previously nav flipped at blogProg 0.60 and CTA at 0.07 — two separate,
      // later points; now they're unified to this single features-hit threshold.
      var fTop = featuresGeo ? (featuresGeo.docTop - scrollY0()) : (H || 1);
      // ...and handed BACK to the light world at the far edge of the dark run. The dark
      // region is .features plus the .projects-tail spacer below it (#0f1628); from
      // .brand-teaser (#skills) onward everything is light — the teaser and manifesto
      // draw the blog's light field, and socials and the footer are both rgb(208,225,235).
      // Keying the flip off the features top ALONE latched dark forever, since fTop only
      // goes more negative as you scroll on, so the white nav carried straight over the
      // light Skills background. Closing the range on the light section's own top means
      // the reel plays in reverse to black exactly as Skills reaches the header — and,
      // being a plain range test rather than a latch, it flips back on the way up too.
      // LIGHT_LEAD: fire the reel slightly BEFORE the light section's top actually
      // reaches the header, rather than exactly on it. The .skills-curve seam bulges up
      // out of .brand-teaser, so the light world starts arriving under the bar a little
      // above the section's own top edge — waiting for the exact edge reads as late.
      // Raise it to flip earlier, lower it (to 1) to flip right on the boundary.
      // Landed at 0.02 by eye: on the boundary (1) read late, H*0.1 clearly early,
      // and 0.05 / 0.04 / 0.025 each still a touch early.
      var LIGHT_LEAD = H * 0.02;
      var lTop = lightGeo ? (lightGeo.docTop - scrollY0()) : Infinity;
      // Snap/lock lands the page at rect.top = 0, but browsers round scrollY to an
      // integer while layout is sub-pixel — so the section settles a fraction of a px
      // SHORT (rect.top ≈ +0.4), which a strict `<= 0` reads as "not covered", leaving
      // the nav light until a manual scroll nudges it negative. A 1px tolerance treats
      // that sub-pixel landing as covered so the flip fires on the snap itself.
      var wantDark = fTop <= 1 && lTop > LIGHT_LEAD;
      if (wantDark !== navDark) {
        navDark = wantDark;
        if (window.__navLight) window.__navLight(!navDark, true);
      }
      if (wantDark !== ctaDark) {
        ctaDark = wantDark;
        if (window.__headerTheme) window.__headerTheme(ctaDark ? 1 : 0, true);
      }
      // Blog canvas: solid light blue (end-of-zone-4) + dark indigo lines (no gradient).
      if (wctx && writingPin) {
        var ws = rectOf(wsTop, wsH);                     // static parent: cheap visibility test
        if (ws.bottom > 0 && ws.top < H) {                // blog off-screen → no read at all
          var wr = writingPin.getBoundingClientRect();    // sticky → must be measured live
          if (wr.bottom > 0 && wr.top < H)
            drawContours(wctx, "rgba(57,50,220,0.5)", "rgb(208,225,235)", -wr.top);
        }
      }
      // Dark content sections (Selected work / Skills / Services): solid dark navy + light-blue lines.
      for (var ds = 0; ds < darkSecs.length; ds++) {
        var sec = darkSecs[ds], sr = rectOf(sec.docTop, sec.docH);
        if (sr.bottom <= 0 || sr.top >= H) continue;
        var sh = sec.docH;
        // The canvas is VIEWPORT-sized (capped at the section height), not section-
        // tall, and slides down the section each frame to cover the visible window.
        // Section-tall bitmaps meant .features alone carried 1920x2160 — 66MB at
        // DPR 2 — cleared, filled and re-uploaded to the GPU every frame just to
        // show the one viewport of it that is actually on screen.
        var cvH = sh < H ? sh : H;
        if (sec.w !== W || sec.h !== cvH) {
          sec.w = W; sec.h = cvH;
          sec.cv.width = W * DPR; sec.cv.height = cvH * DPR;
          sec.cv.style.width = W + "px"; sec.cv.style.height = cvH + "px";
          sec.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
          sec.ty = -1;                                     // force the transform to be re-written
        }
        // Offset of the canvas WITHIN the section: follow the viewport top, clamped
        // so the canvas can never poke out of the section box (which would paint
        // over the neighbouring section). translate, not `top`, so it composites
        // instead of triggering layout every frame.
        var ty = -sr.top, tyMax = sh - cvH;
        if (ty < 0) ty = 0; else if (ty > tyMax) ty = tyMax;
        if (sec.ty !== ty) { sec.ty = ty; sec.cv.style.transform = "translateY(" + ty + "px)"; }
        var sg = sec.ctx;
        sg.clearRect(0, 0, W, cvH);
        sg.fillStyle = sec.fill; sg.fillRect(0, 0, W, cvH);
        if (sec.noLines) continue;                         // projects: solid fill, no contour lines
        // The iso field is sampled in SCREEN space, so shift by the canvas's own top
        // edge in viewport coords (sr.top + ty) to keep these lines continuous with
        // #bg-contours. Was just -sr.top back when the canvas started at the section top.
        sg.save(); sg.translate(0, -(sr.top + ty));
        sg.lineCap = "round"; sg.lineJoin = "round";
        var lineStyle = sec.line;
        if (sec.fadeOut) {
          // ft = 0 → full-strength lines, 1 → fully blended into the fill.
          // "enter" (manifesto): 0 when its top is one viewport below, 1 once its
          // top reaches the viewport top (full screen). "through" (teaser): 0 when
          // its top sits at the viewport top, 1 once a full section-height scrolls past.
          var ft = sec.fadeMode === "enter"
            ? (H - sr.top) / H
            : (sh > 0 ? -sr.top / sh : 0);
          ft = ft < 0 ? 0 : ft > 1 ? 1 : ft;
          lineStyle = "rgba(57,50,220," + (sec.lineBaseA * (1 - ft)).toFixed(3) + ")";
        }
        sg.strokeStyle = lineStyle; sg.lineWidth = LINE_W;
        strokeIso(sg);
        sg.restore();
      }
      // "Filter by" sidebar ONLY: same navy + contour lines (the rest of the projects
      // section stays a flat solid fill). The canvas lives inside .term-side; translating
      // by its on-screen rect keeps the lines aligned with the shared viewport field.
      if (!sideCvEl || !sideCvEl.isConnected) sideCvEl = document.querySelector(".term-side-contours");
      var sideCv = sideCvEl;
      if (sideCv && sideCv.parentNode) {
        var side = sideCv.parentNode, cw = side.clientWidth, ch = side.scrollHeight;
        if (cw && ch && (sideCv._w !== cw || sideCv._h !== ch)) {
          sideCv._w = cw; sideCv._h = ch;
          sideCv.width = cw * DPR; sideCv.height = ch * DPR;
          sideCv.style.width = cw + "px"; sideCv.style.height = ch + "px";
          sideCv.getContext("2d").setTransform(DPR, 0, 0, DPR, 0, 0);
        }
        if (cw && ch) {
          var scg = sideCv.getContext("2d");   // (was also calling getBoundingClientRect here — result unused, pure forced reflow)
          scg.clearRect(0, 0, cw, ch);
          scg.fillStyle = "rgb(27,34,54)"; scg.fillRect(0, 0, cw, ch);
        }
      }
      if (!reduce && ioVisible.size > 0 && !document.hidden) requestAnimationFrame(frame);
      else running = false;
    }

    // Suspend the loop FULLY when none of the contour host sections are on screen (deep in
    // socials/footer) or the tab is hidden — instead of spinning a full field resample +
    // multi-canvas redraw every frame across the whole page. An IntersectionObserver tracks
    // the hosts (the shared plane behind hero+flow, the blog, and the dark content sections);
    // the loop re-arms the moment any re-enters (200px early) or the tab becomes visible.
    var running = false, ioVisible = new Set();
    function kick() { if (!running && !reduce && !document.hidden) { running = true; last = 0; requestAnimationFrame(frame); } }
    var hosts = [heroBg, document.querySelector(".flow"), writingPin]
      .concat(darkSecs.map(function (d) { return d.el; }))
      .filter(Boolean);
    if ("IntersectionObserver" in window && hosts.length) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) ioVisible.add(e.target); else ioVisible.delete(e.target); });
        if (ioVisible.size > 0) kick();
      }, { rootMargin: "200px 0px 200px 0px" });
      hosts.forEach(function (el) { cio.observe(el); });
    } else {
      hosts.forEach(function (el) { ioVisible.add(el); });   // no IO support → always-on fallback
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });
    kick();
  })();

  /* ---------- IntersectionObserver reveals ---------- */
  var revealTargets = document.querySelectorAll(".reveal, .feature-item__content");
  if ("IntersectionObserver" in window && revealTargets.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("show"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.15 });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add("show"); });
  }

  /* ---------- Writing — APPEAR: bouncy fan-out from the rightmost panel ----------
     A SINGLE threshold (the section's top crossing mid-viewport, handing off from flow) springs
     the panels in. They start STACKED onto the rightmost panel and FAN OUT leftward into their
     final accordion layout — the same idea as the socials cards, but anchored on the RIGHTMOST
     panel (it never moves; the rest emerge from behind it) and with a BOUNCE (a reveal spring
     that overshoots past its resting pose then settles). Once it settles it hands off to the
     live sticky-hover accordion — everything the panels do AFTER they're in place is untouched. */
  (function () {
    var section = document.querySelector(".writing");
    // Per-frame getBoundingClientRect -> cached document geometry (see the other loops).
    var wDocTop = 0, wH = 0;
    function measureWriting() {
      if (!section) return;
      var r = section.getBoundingClientRect();
      wDocTop = r.top + (window.scrollY || window.pageYOffset || 0);
      wH = r.height;
    }
    function writingViewRect() {
      var t = wDocTop - (window.scrollY || window.pageYOffset || 0);
      return { top: t, bottom: t + wH, height: wH };
    }
    measureWriting();
    window.addEventListener("resize", measureWriting, { passive: true });
    window.addEventListener("load", measureWriting);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureWriting);
    var wstack = section && section.querySelector(".wstack");
    var pin = section && section.querySelector(".writing__pin");
    var pad = section && section.querySelector(".writing__pad");   // left intro (Writing / Blogs / desc)
    if (!section || !wstack) return;
    var panels = Array.prototype.slice.call(wstack.querySelectorAll(".wpanel"));
    if (!panels.length) return;
    var N = panels.length;
    // ---- Appear: FAN-OUT from the rightmost panel (bouncy), like the socials cards ----
    // The panels are laid out in their FINAL (settled) layout and then transformed so they
    // start STACKED onto the rightmost panel and SPRING out leftward into place. A reveal
    // spring (pCur 0<->1) overshoots past 1 → the fan settles with a BOUNCE. The rightmost
    // panel is the anchor (it never moves); the rest emerge from behind it. Once the spring
    // comes to rest we hand off to the live accordion (setSettled) — everything the panels
    // do AFTER they're in place is untouched. The trigger one-shot latches.
    var ROT_STEP = 0.8;        // deg of fan tilt per panel of distance from the rightmost
    var ROT_MAX  = 7;          // cap the tilt so the tall panels don't skew oddly
    var Y_STEP   = 9;          // px downward dip per distance-step when stacked (eased to 0)
    var S_STEP   = 0.012;      // scale-down per distance-step when stacked (eased to 1)
    var PR_STIFF = 80, PR_DAMP = 11;                    // reveal spring — slower (~0.9s settle), same ~9% bounce (zeta ~0.62)
    var reduceMo = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    var pCur = reduceMo ? 1 : 0, pVel = 0, pT = reduceMo ? 1 : 0;
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function lerp(a, b, t) { return a + (b - a) * t; }

    // ---- Open/close STATE MACHINE (replaces the pure scroll-scrub) ------------------------
    // The section top passes two lines as you scroll: t1 (appear, top = 0.5vh) and t2 (fold,
    // top = −VANISH·vh). They split the scroll into three zones: above / inside / below.
    //  • ENTER the inside zone (from above via ft1, or from below via bt2): if the blog is
    //    CLOSED it OPENS. (Always — a must.) We remember which edge we entered by and whether
    //    it was already open at that moment.
    //  • EXIT the inside zone: it only CLOSES on a FULL PASS-THROUGH (out the FAR/opposite
    //    edge from the one we entered) AND only if it was ALREADY OPEN before we entered.
    //    A reversal (leaving the same edge we came in) never closes; a pass-through that the
    //    entry itself opened stays open too.
    var blogOpen = reduceMo, prevZone = null, entrySide = null, wasOpenAtEntry = false;
    function zoneOf(topPx, vh) {
      if (topPx > vh * 0.5) return "above";
      if (topPx <= -VANISH * vh) return "below";
      return "inside";
    }

    // Resolved geometry (clamps → px), cached; recomputed on resize.
    var G = { W: 0, H: 0, openBasis: 0, per: 0, stripW: 0, ph: [] };
    function geom() {
      var wr = wstack.getBoundingClientRect();
      G.W = wr.width; G.H = wr.height;
      var rail = panels[0].querySelector(".wpanel__rail");
      var strip = rail ? parseFloat(getComputedStyle(rail).minWidth) : 90;     // = --strip
      // The open panel's basis is strip + --cw (the CSS `.wpanel.is-open{flex-basis:calc(--strip + --cw)}`),
      // NOT the content's own (wider) clamped width — otherwise the JS "open" overshoots the real settled width.
      // --gutter: how far in the divider + text sit from the open panel's left edge. It is a CLOSED
      // panel's settled width — (W - cw)/N, since every panel grows by the same share of the free
      // space — plus a small NUDGE so the band reads as a margin rather than as the panel seam.
      // --cw is deliberately NOT written to: it sets how far a panel opens, so changing it would
      // widen every open panel and narrow every closed one. The accordion's proportions stay exactly
      // as designed; only the line and the text move. --shift is what the text column gives back in
      // width, so its RIGHT edge does not move and nothing visible before can be clipped now.
      var cw = parseFloat(getComputedStyle(section).getPropertyValue("--cw")) || 230;
      // INSET is how much of the way from --strip to a closed panel's full width the line sits.
      // 1 = flush with the closed width (+NUDGE); 0.75 is where it reads best — halfway read as
      // too far left, flush as too far right.
      var NUDGE = 4, INSET = 0.75;
      var full = (G.W - cw) / N + NUDGE;                 // a closed panel's settled width, plus the nudge
      var gutter = Math.max(strip, strip + (full - strip) * INSET);
      section.style.setProperty("--gutter", gutter.toFixed(2) + "px");
      section.style.setProperty("--shift", (gutter - strip).toFixed(2) + "px");
      G.openBasis = strip + cw;                          // the open panel's extra basis (main accordion)
      G.per = G.W / N;                                   // equal width (Part-1 end)
      G.stripW = (G.W - G.openBasis) / N;                // a closed strip's final width (accordion)
      G.ph = panels.map(function (p) {
        var v = parseFloat(getComputedStyle(p).getPropertyValue("--ph"));       // taper %, e.g. 91
        return isNaN(v) ? 100 : v;
      });
    }

    // Rail text (vertical label + number) per panel — repositioned to track the band edge.
    var TXT = panels.map(function (p) {
      return { vert: p.querySelector(".wpanel__vert"), num: p.querySelector(".wpanel__num") };
    });

    /* ---- Intro TYPE-IN: Writing / Blogs / the description ------------------------------
       Typed on the SAME threshold the panels arrive on — the frame blogOpen first turns
       true (see the zone state machine in render) — and typed straight through, eyebrow
       into title into description, with a caret at the writing position.

       Each character becomes its own span while SPACES stay plain text nodes, so the
       paragraph still breaks across lines exactly where it did and every glyph keeps its
       final box: the reveal is opacity-only, so nothing reflows as the text arrives. The
       caret is a box-shadow (drawn outside the glyph's box) rather than a border, for the
       same reason. Classes are all dropped at the end, leaving the plain text.

       One-shot: unlike the panels, this does not fold back and re-type on the way out.
       Desktop only — mobile is not pinned and never crosses this threshold — and static
       under prefers-reduced-motion. */
    var EYE_STEP = 55, DESC_STEP = 10;                 // ms per letter: headings / body
    var introType = (!pad || reduceMo || window.innerWidth <= 820) ? null : makeTypeIn(pad, [
      { el: pad.querySelector(".writing__eyebrow"), step: EYE_STEP },
      { el: pad.querySelector(".writing__title"),   step: EYE_STEP },
      { el: pad.querySelector(".writing__desc"),    step: DESC_STEP }
    ], { keep: true });          // cursor stays blinking at the end of the description
    // Resized down to mobile before it ever ran → nothing will trigger it, so show the text.
    if (introType) window.addEventListener("resize", function () {
      if (!introType.ran() && window.innerWidth <= 820) introType.reveal();
    }, { passive: true });

    // Arrival positions: ALL panels are the SAME (equal) width while fanning in — none is open
    // yet. The per-panel offset stacks each panel onto the rightmost one.
    function leftPos(i) { return i * G.per; }                     // equal-width slots (W/N each)
    function stackDX(i) { return leftPos(N - 1) - leftPos(i); }   // px to slide panel i onto the rightmost

    // Place the panels in their ARRIVAL layout. Panel 0 ARRIVES CLOSED (equal width). It only starts
    // opening once the reveal spring reaches its PEAK (velocity flips negative = the bounce begins),
    // then WIDENS over OPEN_DUR — so the open plays DURING the bouncy settling window (not before the
    // bounce like a pCur threshold would, nor only after it fully rests). The others shrink to their
    // strip width to match, and panel 0 gets `is-open` so its content/divider/READ reveal in step.
    var OPEN_DUR = 0.5;                                          // seconds the open takes, played across the settle/bounce
    var openArmed = false, openU = 0, openProg = 0;             // armed once the spring peaks; openU eases 0↔1 (reversible)
    function easeIO(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    // Per-panel OPENNESS WEIGHT (0..1, summing to 1 across the row). While the fan is in flight
    // transitions are off (we drive flex-basis per frame), so a hard `i === hovered` test made the
    // widths JUMP the frame the cursor crossed a panel edge — the snap you see when moving the mouse
    // over the panels as they animate in. Instead each panel's openness EASES toward its target and
    // the vector is normalized every frame, so the open state CROSSFADES between panels: the one you
    // left narrows as the one you entered widens, and the widths still total exactly G.W throughout.
    // Once settled the CSS `transition:flex-basis .95s` owns this again and the weights go unused.
    var OPEN_TAU = 0.13;                                        // seconds — openness follow time (matches the settled feel)
    var wOpen = panels.map(function (_, i) { return i === 0 ? 1 : 0; });
    function stepOpenWeights(dt) {
      var oi = openTargetIdx();
      var k = 1 - Math.exp(-dt / OPEN_TAU);                     // frame-rate independent ease
      var sum = 0, i;
      for (i = 0; i < N; i++) { wOpen[i] += ((i === oi ? 1 : 0) - wOpen[i]) * k; sum += wOpen[i]; }
      if (sum > 0) for (i = 0; i < N; i++) wOpen[i] /= sum;     // renormalize → widths always fill G.W exactly
    }
    function applyFanLayout() {
      var op = openProg;                                        // 0 → 1 open progress (driven in render, peak-triggered)
      var oi = openTargetIdx();                                 // open the HOVERED panel (or 0) as the fan widens
      panels.forEach(function (p, i) {
        p.style.transition = "none";
        p.style.flexGrow = "0"; p.style.flexShrink = "0";
        // Weighted basis: every panel gets a strip, and the openBasis is SHARED out by weight.
        // Σ basis = N·stripW + openBasis·Σw = G.W (since Σw = 1) at op=1, and G.W at op=0 — so the
        // row stays exactly full at every point of both the fan-out and a mid-flight hover swap.
        var basis = lerp(G.per, G.stripW + wOpen[i] * G.openBasis, op);
        p.style.flexBasis = basis.toFixed(2) + "px";
        p.style.height = G.H + "px";
        p.style.transformOrigin = "50% 100%";
        // Content/divider reveal still keys off the TARGET panel — those fade via their own CSS
        // transitions (on .wpanel__content / .wpanel::after, unaffected by the inline transition:none
        // above), so swapping mid-fan crossfades the text instead of popping it.
        p.classList.toggle("is-open", i === oi && op > 0);       // closed until op>0, then reveals as it widens
      });
    }
    // FAN(p): stacked-onto-the-rightmost (p=0) → in place (p=1). p can overshoot past 1, so q
    // goes slightly negative → the panels spring a touch past their resting pose then settle = bounce.
    function fanPaint(p) {
      var q = 1 - p;
      panels.forEach(function (pan, i) {
        var d = (N - 1) - i;                             // distance from the rightmost anchor (0)
        var tx = q * stackDX(i);
        var ty = q * d * Y_STEP;
        var rot = -q * clamp(d * ROT_STEP, 0, ROT_MAX);  // tilt up-left as it fans out
        var sc = 1 - q * d * S_STEP;
        pan.style.transform =
          "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) rotate(" + rot.toFixed(2) + "deg) scale(" + sc.toFixed(4) + ")";
        pan.style.opacity = clamp(p * 1.4, 0, 1).toFixed(3);   // fully INVISIBLE until the reveal begins (no faint right-side sit)
      });
    }

    var settled = null;                                 // tri-state: null/false/true
    var hovered = null;                                 // panel the cursor is currently over (set by mouseenter)
    // Which panel should be OPEN: the one the cursor is resting on, else panel 0. Used both
    // DURING the fan-out (applyFanLayout) and at hand-off (setSettled) so the reveal widens
    // the hovered panel from the start instead of opening panel 0 and switching at the end.
    function openTargetIdx() { var i = hovered ? panels.indexOf(hovered) : 0; return i < 0 ? 0 : i; }
    // Last known pointer position (tracked globally so we can resolve the hovered panel even
    // when the cursor is stationary and no mouseenter fired). -1 = pointer never moved.
    var ptrX = -1, ptrY = -1;
    window.addEventListener("pointermove", function (e) { ptrX = e.clientX; ptrY = e.clientY; }, { passive: true });
    function panelAtPointer() {
      if (ptrX < 0) return null;
      var el = document.elementFromPoint(ptrX, ptrY);
      var w = el && el.closest ? el.closest(".wpanel") : null;
      return (w && panels.indexOf(w) >= 0) ? w : null;
    }
    function setSettled(on) {
      if (on === settled) return;
      settled = on;
      var openIdx = on ? openTargetIdx() : 0;
      panels.forEach(function (p, i) {
        if (on) {                                        // hand off to the live CSS accordion
          p.style.transition = ""; p.style.transform = ""; p.style.transformOrigin = ""; p.style.clipPath = "";
          p.style.flexBasis = ""; p.style.flexGrow = ""; p.style.flexShrink = "";
          p.style.boxShadow = ""; p.style.opacity = "";  // back to the CSS base (bleed + full opacity)
          p.style.height = G.H + "px";                   // uniform height (overrides the --ph taper)
          if (TXT[i].vert) { TXT[i].vert.style.top = ""; TXT[i].vert.style.opacity = ""; }  // rail text back to CSS (box edges, fully visible)
          if (TXT[i].num) { TXT[i].num.style.bottom = ""; TXT[i].num.style.opacity = ""; }
          p.classList.toggle("is-open", i === openIdx);
          var c = p.querySelector(".wpanel__content"); if (c) c.style.opacity = "";
        } else {
          p.style.transition = "none"; p.classList.remove("is-open");
        }
      });
    }

    var lastT = 0;                                      // last frame stamp

    // ---- Cover dwell (no scroll lock) ---------------------------------------
    // Instead of freezing the scroll while the fan-out springs in, .writing is lengthened by
    // BLOG_DWELL·100vh of extra pinned scroll (see styles.css `.writing{height:...}`). The
    // features section (margin-top:-100svh) only rides OVER the LAST 100vh, so that extra
    // length is a DWELL: the pin holds the fully-revealed blog at the top while you scroll
    // through it — giving the reveal time to play — before features begins covering. This
    // mirrors the hero's phase-1→phase-2 fullscreen checkpoint dwell (HERO_DWELL).
    //
    // DWELL DRIFT + FOLD-BACK (scroll-driven, reversible): while pinned, s = -rect.top is how far we've
    // scrolled into the pinned region (dwell = s∈[0,.3vh], features cover = s∈[.3vh,1.3vh]).
    //  • From HALFWAY through the dwell the blog eases UP at a FRACTION of scroll (DRIFT) — not 1:1,
    //    just enough to confirm the scroll is registering while it's otherwise held.
    //  • HALFWAY through the features cover (s≈.8vh = rect.top≈-VANISH) the reveal folds back the SAME
    //    way it came in (see pT below — the fan-out runs in reverse); scrolling back up past that same
    //    line plays it forward again. Both are pure functions of scroll, so it's fully reversible.
    var DRIFT = 0.25;                                   // fraction of scroll the pinned blog drifts up
    var VANISH = 0.8;                                   // fold-back threshold as a fraction of vh into the cover
    function updatePinDwell(rect, vh) {
      if (!pin) return;
      if (rect.top > 0) { pin.style.transform = ""; if (pad) pad.style.transform = ""; return; }
      var s = -rect.top;
      var driftStart = 0.15 * vh;                       // halfway through the 0.3vh dwell
      var drift = (!reduceMo && s > driftStart) ? (s - driftStart) * DRIFT : 0;
      pin.style.transform = drift ? "translateY(" + (-drift).toFixed(1) + "px)" : "";
      // The left intro (Writing / Blogs / description) STAYS PUT once the panels start
      // drifting up: the drift moves the whole pin (panels + contour plane), so the pad
      // gets the exact inverse and holds at its rest position instead of riding along.
      if (pad) pad.style.transform = drift ? "translateY(" + drift.toFixed(1) + "px)" : "";
    }

    function render(now) {
      if (window.innerWidth <= 820) {
        if (pin) pin.style.transform = "";
        if (pad) pad.style.transform = "";
        if (settled !== null) { panels.forEach(function (p, i) {
          ["transition", "transform", "transformOrigin", "clipPath", "flexBasis", "flexGrow", "flexShrink", "height", "boxShadow", "opacity"].forEach(function (k) { p.style[k] = ""; });
          if (TXT[i].vert) { TXT[i].vert.style.top = ""; TXT[i].vert.style.opacity = ""; }
          if (TXT[i].num) { TXT[i].num.style.bottom = ""; TXT[i].num.style.opacity = ""; }
          p.classList.remove("is-open");
        }); settled = null; }
        lastT = 0;
        return;
      }
      var vh = window.innerHeight;
      var rect = writingViewRect();
      // This loop is unconditional — requestAnimationFrame(frame) re-arms forever — so
      // the whole blog state machine ran every frame for the life of the page, including
      // while you are in projects or the footer with nothing it drives on screen
      // (measured ~6.7ms/frame there). Skip when the section is far outside the viewport.
      // The margin is a full viewport on each side, and every zoneOf threshold sits
      // within one viewport of the section, so no crossing can happen while skipped;
      // lastT is cleared so easings resume from rest instead of jumping on a big dt.
      if (rect.bottom < -vh || rect.top > vh * 2) { lastT = 0; return; }
      updatePinDwell(rect, vh);                          // drift + vanish run every frame (even after the fan settles)
      if (reduceMo) { setSettled(true); return; }        // no fan: land in place immediately
      // Drive the open state off the threshold-crossing state machine (see zoneOf above),
      // not a live scrub — so a pass-through can keep the blog open and a reversal never closes.
      var zone = zoneOf(rect.top, vh);
      if (prevZone === null) {                             // first frame: seed, no crossing
        prevZone = zone;
        if (zone === "inside" && !blogOpen) {              // loaded/refreshed already inside → arrive open
          blogOpen = true; entrySide = "top"; wasOpenAtEntry = false;
        }
      }
      else if (zone !== prevZone) {
        if (zone === "inside") {                           // ENTER the open-zone (ft1 from above / bt2 from below)
          entrySide = (prevZone === "above") ? "top" : "bottom";
          wasOpenAtEntry = blogOpen;
          if (!blogOpen) blogOpen = true;                  // entering closed → open (must)
        } else if (prevZone === "inside") {                // EXIT the open-zone (bt1 to above / ft2 to below)
          var exitSide = (zone === "above") ? "top" : "bottom";
          var farSide = exitSide !== entrySide;            // opposite edge = full pass-through (not a reversal)
          if (farSide && wasOpenAtEntry) blogOpen = false; // close ONLY on a pass-through that was already open
        }
        prevZone = zone;
      }
      if (blogOpen && introType) introType.start();       // same threshold as the panels' arrival
      if (!lastT) lastT = now;
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;  // clamp dt (tab-switch safety)

      pT = blogOpen ? 1 : 0;
      var f = PR_STIFF * (pT - pCur) - PR_DAMP * pVel;             // step the reveal spring (overshoots → bounce)
      pVel += f * dt; pCur += pVel * dt;
      var atRest = pT === 1 && Math.abs(1 - pCur) < 0.0015 && Math.abs(pVel) < 0.0015;

      // Panel-0 open: ARM it the instant the spring PEAKS (velocity goes non-positive while near the
      // top) → openU eases toward 1 over OPEN_DUR (the widening plays through the bouncy settle).
      // On reverse (pT→0) it disarms and openU eases back to 0, so the panel folds closed too.
      if (pT === 0) openArmed = false;
      else if (!openArmed && pCur > 0.85 && pVel <= 0) {
        openArmed = true;
        // Seed the open target from the panel actually UNDER the cursor as the open arms —
        // mouseenter won't have fired for a cursor that's been resting still over a panel
        // while the fan animated under it, so detect it directly by pointer position.
        var hp = panelAtPointer(); if (hp) hovered = hp;
      }
      openU = clamp(openU + (openArmed ? 1 : -1) * dt / OPEN_DUR, 0, 1);
      openProg = easeIO(openU);
      stepOpenWeights(dt);                                       // ease the openness toward the hovered panel (no width jump)

      if (atRest) { pCur = 1; pVel = 0; setSettled(true); return; }  // landed → live accordion
      setSettled(false);
      applyFanLayout();
      fanPaint(pCur);
    }

    function resize() {                                                    // force a clean re-apply after a resize
      geom(); settled = null; openArmed = false; openU = 0; openProg = 0;
      wOpen = panels.map(function (_, i) { return i === 0 ? 1 : 0; });     // openness back to "panel 0", no stale crossfade
    }
    geom();
    function frame(now) { render(now || performance.now()); requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
    window.addEventListener("resize", resize, { passive: true });

    // Clicking a "Read" link navigates away; pressing Back restores this page from the
    // bfcache with the DOM + JS state FROZEN — the panel you clicked keeps `is-open` and
    // `settled` stays true, so setSettled(true)'s early-return never re-enforces "only
    // panel 0 open" and you return with a stray open panel (→ two open once you hover
    // another). On pageshow (fires on bfcache restore) drop any stale open state and force
    // settled=null so the render loop re-derives a clean layout (panel 0 only).
    window.addEventListener("pageshow", function () {
      panels.forEach(function (p) { p.classList.remove("is-open"); });
      resize();
    });

    // Sticky-hover accordion — only active once settled (sequence complete). `is-open` is
    // the SINGLE source of truth for the open panel (toggle-all → exactly one open). We do
    // NOT use CSS :focus-within to open (it was a parallel, unmanaged trigger: clicking a
    // Read link focus-latched its panel open, and pressing Back restored that focus so the
    // panel stayed open alongside the hover one = two open). Keyboard focus is routed through
    // the same open() here (focusin bubbles from the link) so tabbing still opens a panel —
    // but through the single toggle, so only ever one is open.
    function open(p) { if (settled) panels.forEach(function (x) { x.classList.toggle("is-open", x === p); }); }
    panels.forEach(function (p) {
      p.addEventListener("mouseenter", function () { hovered = p; open(p); });
      p.addEventListener("focusin", function () { open(p); });
    });
    // Leaving the whole stack keeps the last-opened panel open (no reset to panel 0) —
    // hovered stays pointing at it so the open state and geometry remain consistent.
  })();

  /* ---------- Accordion (Services + any .faq-item) ---------- */
  document.querySelectorAll(".faq-item__header").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var item = btn.closest(".faq-item");
      var content = item.querySelector(".faq-item__content");
      var isOpen = item.classList.contains("faq-item--open");
      if (isOpen) {
        item.classList.remove("faq-item--open");
        btn.setAttribute("aria-expanded", "false");
        content.style.maxHeight = "0px";
      } else {
        item.classList.add("faq-item--open");
        btn.setAttribute("aria-expanded", "true");
        content.style.maxHeight = content.scrollHeight + "px";
      }
    });
  });
  // open any item that starts open
  document.querySelectorAll(".faq-item--open .faq-item__content").forEach(function (c) {
    c.style.maxHeight = c.scrollHeight + "px";
  });

  /* ---------- Header: always visible (never hides on scroll) ---------- */
  var header = document.querySelector("header");
  if (header) header.classList.add("show");

  /* ---------- Split the top nav links into a per-letter VERTICAL REEL ----------
     Each letter is a clipped .nav-char holding two stacked copies: __a (current
     colour, on top) and __b (black, waiting just below). At the flow bg threshold
     At the flow bg threshold flow.js calls window.__navLight(true), which rolls each
     letter up (translateY -100%) so the black copy takes its place. The two header
     pills (Socials / Subscribe) are excluded — they get their own reel, see
     buildPillReel. */
  (function buildNavReel() {
    var LETTER_STEP = 0.015;    // per-letter stagger
    var WORD_GAP = 0.06;        // extra delay so each word starts after the one to its left
    var navClips = [], navAs = [], gi = 0, Dmax = 0;
    Array.prototype.forEach.call(document.querySelectorAll(".header__nav-left a"), function (a, w) {
      navAs.push(a);
      var text = a.textContent;
      a.setAttribute("aria-label", text);
      a.textContent = "";
      var linkClips = [];                                // this link's own letters (for the hover weight reel)
      for (var i = 0; i < text.length; i++) {
        var clip = document.createElement("span");
        clip.className = "nav-char";
        clip.setAttribute("aria-hidden", "true");
        // __col = hover roller; inside it __face (the world-flip clip: __a/__b) + __c (a same-colour
        // self-reel clone, color:inherit → always legible in either world). Hover rolls __col up to __c.
        var col  = document.createElement("span"); col.className  = "nav-char__col";
        var face = document.createElement("span"); face.className = "nav-char__face";
        var top = document.createElement("span"); top.className = "nav-char__a"; top.textContent = text[i];
        var bot = document.createElement("span"); bot.className = "nav-char__b"; bot.textContent = text[i];
        var cl  = document.createElement("span"); cl.className  = "nav-char__c"; cl.textContent  = text[i];
        face.appendChild(top); face.appendChild(bot);
        col.appendChild(face); col.appendChild(cl);
        clip.appendChild(col);
        a.appendChild(clip);
        var fd = gi * LETTER_STEP + w * WORD_GAP;        // world-flip delay (left->right, word by word)
        clip.style.setProperty("--d", fd.toFixed(3) + "s");
        clip.style.setProperty("--hd", (i * 0.022).toFixed(3) + "s");  // hover-reel stagger (local to this link)
        navClips.push({ clip: clip, fd: fd });
        linkClips.push(clip);
        if (fd > Dmax) Dmax = fd;
        gi++;
      }
      // Per-letter HOVER WEIGHT REEL: the letter under the cursor (and its neighbours, with a
      // gaussian falloff) boldens. Roboto Flex interpolates the weight; CSS transitions it snappily.
      var BASE_W = 400, PEAK_W = 900, SIGMA = 1.45;      // SIGMA in letter-units → how far the bold bleeds
      var centers = null;                                // cached letter centre-x (recomputed on enter)
      function measure() {
        centers = linkClips.map(function (cl) { var r = cl.getBoundingClientRect(); return r.left + r.width / 2; });
      }
      function paint(cx) {
        if (!centers) measure();
        // nearest letter index by cursor x → fractional, so the peak tracks between letters
        var nearest = 0, best = Infinity;
        for (var k = 0; k < centers.length; k++) { var d = Math.abs(centers[k] - cx); if (d < best) { best = d; nearest = k; } }
        for (var j = 0; j < linkClips.length; j++) {
          var dist = j - nearest;
          var f = Math.exp(-(dist * dist) / (2 * SIGMA * SIGMA));   // 1 at the hovered letter, falling off
          linkClips[j].style.setProperty("--w", Math.round(BASE_W + (PEAK_W - BASE_W) * f));
        }
      }
      a.addEventListener("pointerenter", function (e) { measure(); paint(e.clientX); });
      a.addEventListener("pointermove", function (e) { paint(e.clientX); });
      a.addEventListener("pointerleave", function () {
        for (var j = 0; j < linkClips.length; j++) linkClips[j].style.setProperty("--w", BASE_W);
      });
    });
    // Direction-aware: forward = left->right, word by word; reverse = mirror (Dmax-fd)
    // so the last letter of the last word leads and it unrolls back to the first word.
    window.__navLight = function (on, skipTheme) {
      for (var k = 0; k < navClips.length; k++) {
        var c = navClips[k];
        c.clip.style.setProperty("--d", (on ? c.fd : (Dmax - c.fd)).toFixed(3) + "s");
      }
      if (header) header.classList.toggle("header--on-light", on);
      // Hover-reel clone colour for the nav (threshold-driven, so always the opposite blue here):
      // on = light world (black text) → deep blue #231d7a (the zone-3/4 title blue); off = dark
      // world (white text) → sky blue #4d8bff. (The initial-hero same-colour reel is owned by
      // setHeaderTheme, which clears --hc during the zoom.)
      for (var n = 0; n < navAs.length; n++) navAs[n].style.setProperty("--hc", on ? "#231d7a" : "#4d8bff");
      // Flip the Hire-Me + Get-In-Touch pills to match (COLOUR only, no size change): on = light
      // world (he 0), off = dark world (he 1). skipTheme lets a caller drive the reel WITHOUT the
      // pills — the blog section does this so the pills can flip on their own, earlier, threshold.
      if (!skipTheme && window.__headerTheme) window.__headerTheme(on ? 0 : 1, true);
    };
  })();

  /* ---------- Header REEL-IN (once, right after the boot loader lifts) ----------
     The header arrives EMPTY — no nav words, no CTA labels — and the letters REEL
     into existence: each letter rolls up into its clip from below, staggered left
     to right through Projects → Contact → Blog → Home, then Socials, then
     Subscribe. It is the same vertical reel the header already uses for the
     world-flip and the hover roll — the only difference is that it rolls in from
     nothing rather than from another copy of the letter.

     Mechanics: buildNavReel/buildPillReel have already split every label into
     per-letter clips (.nav-char / .pill-char, each holding a .__col roller), so
     this only has to roll those columns in; no text is removed or re-inserted, so
     the header holds its final layout throughout (nothing reflows) and the reel /
     hover / theme machinery on top of it is untouched. `header.is-reeling` parks
     every column below its clip (the empty state, in place before the first paint)
     and each column is then rolled up by a WAAPI animation — WAAPI rather than a
     CSS transition because .__col's transition and transform are owned by the hover
     reel, and because setHeaderTheme writes an inline `transition` on the pills.
     The class and the animations are all gone by the end, leaving the plain markup.

     Plays only when the boot loader played (homepage, once per session — see
     __bootShown) and never under prefers-reduced-motion. */
  (function reelHeaderIn() {
    var hdr = document.querySelector("header");
    if (!hdr || !window.__bootShown) return;                       // sub-pages / repeat visit
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var navCols   = Array.prototype.slice.call(hdr.querySelectorAll(".header__nav-left a .nav-char__col"));
    var pills     = Array.prototype.slice.call(hdr.querySelectorAll(".header__ctas .pill-btn"));
    var pillCols  = pills.map(function (p) { return Array.prototype.slice.call(p.querySelectorAll(".pill-char__col")); });
    if (!navCols.length) return;

    var STEP = 38;                                                 // per-letter stagger
    var ROLL = 460;                                                // how long one letter takes to roll up
    var EASE = "cubic-bezier(.19,1,.22,1)";
    var NAV_MS = navCols.length * STEP;                            // the pills' shells land on this beat
    // …but they don't START there. Fading them in over the whole nav run left two empty
    // capsules sitting in the corner for most of it; they now hold off until this far
    // through the nav (0 = with the first letter, 1 = not at all) and still land together
    // on the last one, right before their own labels reel in.
    var PILL_IN = 0.86;
    var PILL_LAG = 220;                                            // …and settle this much AFTER it
    var anims = [];
    hdr.classList.add("is-reeling");                               // park the letters BEFORE the first paint

    // Roll `cols` up into place one after another from `from`; returns when the last
    // one STARTS, so the runs chain: nav → Socials → Subscribe.
    function reel(cols, from) {
      cols.forEach(function (c, i) {
        anims.push(c.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
                             { duration: ROLL, delay: from + i * STEP, easing: EASE, fill: "both" }));
      });
      return from + cols.length * STEP;
    }

    // Handing the letters back to CSS is the one delicate step. Dropping `is-reeling`
    // flips the column transform from translateY(100%) to none — and .__col carries the
    // hover reel's own .42s transition (staggered by --hd), so that flip STARTS A
    // TRANSITION and every word reels a second time, in unison, the moment the WAAPI
    // animations are cancelled. So the transition is switched off inline, the class and
    // the animations are dropped and committed in that state, and the inline override is
    // only released a frame later — by which point there is no property change left to
    // animate and the hover reel gets its transition back untouched.
    var allCols = navCols.concat.apply(navCols, pillCols);
    function finish() {
      allCols.forEach(function (c) { c.style.transition = "none"; });
      hdr.classList.remove("is-reeling");
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      void hdr.offsetWidth;                                        // commit the rest state, transitions off
      requestAnimationFrame(function () {
        allCols.forEach(function (c) { c.style.transition = ""; });
      });
    }

    var TOTAL = NAV_MS;
    function run() {
      // The pill SHELLS fade in TOGETHER over the nav's run, so both are fully there
      // as the last nav letter lands — and only then do their labels reel in, one
      // pill after the other.
      pills.forEach(function (p) {
        anims.push(p.animate([{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "none" }],
                             { delay: NAV_MS * PILL_IN, duration: NAV_MS * (1 - PILL_IN) + PILL_LAG, easing: EASE, fill: "both" }));
      });
      TOTAL = reel(navCols, 0);
      pillCols.forEach(function (cols) { TOTAL = reel(cols, TOTAL); });
      setTimeout(finish, TOTAL + ROLL + 60);
    }

    var started = false;
    var start = function () { if (!started) { started = true; requestAnimationFrame(run); } };
    window.__bootReady.then(start);
    setTimeout(start, 20000);   // safety: never leave the header blank if the loader stalls
  })();

  /* ---------- Mobile nav toggle ---------- */
  var menuBtn = document.querySelector(".menu-btn");
  var mobileNav = document.querySelector(".mobile-nav");
  var overlay = document.querySelector(".mobile-nav__overlay");
  var closeBtn = document.querySelector(".mobile-nav__close");
  function setNav(open) {
    if (!mobileNav) return;
    document.body.classList.toggle("nav-open", open);
    mobileNav.classList.toggle("is-open", open);
    if (header) header.classList.toggle("menu-open", open);
    if (overlay) overlay.classList.toggle("show", open);
    if (menuBtn) menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (menuBtn) menuBtn.addEventListener("click", function () {
    setNav(!document.body.classList.contains("nav-open"));
  });
  if (closeBtn) closeBtn.addEventListener("click", function () { setNav(false); });
  if (overlay) overlay.addEventListener("click", function () { setNav(false); });
  document.querySelectorAll(".mobile-nav__item a, .mobile-nav__cta").forEach(function (a) {
    a.addEventListener("click", function () { setNav(false); });
  });

  /* ---------- Terminal demo (features section) ---------- */
  /* SCROLL-DRIVEN: the command + a trimmed apt-install slice is revealed
     character-by-character as you scroll through the pinned .features
     section. Progress maps to a character count, so the typing tracks
     scroll exactly (reverses on scroll-up); at the end it parks at a
     blinking prompt waiting for the next command. */
  (function terminalDemo() {
    var body = document.getElementById("term-body");
    var sec = document.querySelector(".features");
    if (!body || !sec) return;
    /* Geometry cache. update() and panCards() run every frame and each called
       sec.getBoundingClientRect(), which flushes style+layout for the whole document —
       measured at ~10ms per call on this page. The section's DOCUMENT position and
       height do not change while scrolling, so measure once and derive the viewport
       top as (documentTop - scrollY); reading scrollY does not flush.
       sizeSection() is the exception — it sets sec.style.height at runtime — so it
       re-measures itself at the end. */
    var secDocTop = 0, secH = 0;
    function measureSec() {
      var r = sec.getBoundingClientRect();
      secDocTop = r.top + (window.scrollY || window.pageYOffset || 0);
      secH = r.height;
    }
    function secTop() { return secDocTop - (window.scrollY || window.pageYOffset || 0); }
    measureSec();
    window.addEventListener("resize", measureSec, { passive: true });
    window.addEventListener("load", measureSec);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureSec);
    var PROMPT =
      '<span class="term-user">vishnu@ASUS-TUF-F16-Vishnu</span>' +
      '<span class="term-path">:~</span>$ ';
    // mysql prompt (for the SELECT line, after entering the monitor)
    var MYSQL = '<span class="term-mysql">mysql&gt;</span> ';
    // type: "cmd" = bash prompt; "sql" = mysql prompt; "out" = printed line.
    // The line flagged `proj:true` renders the projects as its result set.
    var script = [
      { t: "cmd", x: "sudo apt install mysql-server -y" },
      { t: "out", x: "Reading package lists... Done" },
      { t: "out", x: "Building dependency tree... Done" },
      { t: "out", x: "The following NEW packages will be installed:" },
      { t: "out", x: "  mysql-server mysql-server-8.0 mysql-client-8.0 mysql-common" },
      { t: "out", x: "Unpacking mysql-server-8.0 ..." },
      { t: "out", x: "Setting up mysql-server-8.0 ..." },
      { t: "out", x: "mysqld is running as pid 13300" },
      { t: "cmd", x: "sudo mysql" },
      { t: "out", x: "Welcome to the MySQL monitor.  Commands end with ; or \\g." },
      { t: "sql", x: "USE portfolio;" },
      { t: "out", x: "Database changed" },
      { t: "sql", x: "SELECT * FROM projects;", proj: true }
    ];
    // n=name, d=description (first outcome bullet), t=tech tags, h=subpage link
    // (4 existing only), code=GitHub repo (drives the "View code" notch button),
    // img=card image (cycles the 4 flow placeholders). Content from master_profile.yaml.
    // n=name, d=desc, t=visible card tags, h=subpage, code=GitHub, img=card image.
    // tools = full tech stack (from master_profile.yaml, fuller than the visible tags)
    // and dom = domain(s) — both drive the side-panel "Filter by" facets.
    var PROJECTS = [
      { n: "Market Data Platform", d: "28-pipeline NSE market-data ingestion layer feeding 12+ datasets into a partitioned store.", t: ["Python", "pandas", "ETL", "SQL"], tools: ["Python", "pandas", "NumPy", "SQL", "ETL"], dom: ["Data", "Finance"], h: "/projects/market-data-pipeline/", img: "images/projects/market-data-poster.jpg" },
      { n: "Product Explorer", d: "Full-stack TypeScript app scraping a book catalog into PostgreSQL, served via Next.js with real-time WebSocket scraping.", t: ["TypeScript", "NestJS", "PostgreSQL", "Redis"], tools: ["TypeScript", "NestJS", "Next.js", "PostgreSQL", "Redis", "WebSockets"], dom: ["Scraping", "Backend", "Full-Stack", "Data"], h: "/projects/product-explorer/", img: "images/projects/product-explorer-poster.jpg", video: "images/projects/product-explorer.mp4" },
      { n: "DekhLaw Legal-Emergency Platform", d: "Solo-built production legal-emergency platform — ~30 Express endpoints over PostgreSQL with JWT auth, a real-time Twilio call-dispatch engine, and Haversine lawyer matching, deployed on Railway and Vercel.", t: ["Node.js", "Express", "PostgreSQL", "Twilio"], tools: ["Node.js", "Express", "PostgreSQL", "SQLite", "Twilio", "JWT", "Cloudinary", "Railway", "Vercel"], dom: ["Full-Stack", "Backend", "DevOps"], img: "images/projects/dekhlaw-poster.jpg", video: "images/projects/dekhlaw.mp4" },
      { n: "Law Firm Website", d: "Production law-firm marketing site in Next.js 14 + TypeScript — 14 routes, Resend-backed lead capture, Zod-validated forms, and full SEO/JSON-LD, designed and shipped solo.", t: ["Next.js", "TypeScript", "Tailwind", "Framer Motion"], tools: ["Next.js", "React", "TypeScript", "Tailwind", "Framer Motion", "Resend", "Zod", "Vercel"], dom: ["Full-Stack", "Frontend"], h: "https://smartnperfectlegal.legal/", img: "images/projects/law-firm-poster.jpg", video: "images/projects/law-firm.mp4" },
      { n: "Job Application Bot", d: "Autonomous job-search bot — scrapes Indeed, Glassdoor, and LinkedIn listings, scores them against a master profile, and builds a tailored resume per match with an LLM, rendered on demand via FastAPI.", t: ["Python", "FastAPI", "Playwright", "LLM"], tools: ["Python", "FastAPI", "Playwright", "PostgreSQL", "spaCy", "Gemini", "Docker", "AWS", "GCP"], dom: ["Backend", "Scraping", "ML", "NLP", "DevOps"], img: "images/projects/job-bot-poster.jpg", video: "images/projects/job-bot.mp4" },
      { n: "Fraud Transaction Detection", d: "Fraud-detection model on 6.4M transactions — 95% caught at 0.995 ROC-AUC despite a 0.13% fraud rate.", t: ["Python", "scikit-learn", "pandas"], tools: ["Python", "scikit-learn", "pandas", "NumPy", "SciPy"], dom: ["ML", "Data", "Finance"], h: "/projects/fraud-detection/", code: "https://github.com/VishnujanNarayanan/Fraud_Transaction_Detection", img: "images/projects/fraud-detection.jpg" },
      { n: "Minute-Level Stock Prediction", d: "Intraday price-direction system over 9.4M NSE ticks, raising next-minute precision from 0.51 to 0.61.", t: ["Python", "scikit-learn", "Backtesting"], tools: ["Python", "scikit-learn", "pandas", "Backtesting"], dom: ["ML", "Quant", "Finance", "Data"], h: "/projects/nse-stock-prediction/", code: "https://github.com/VishnujanNarayanan/minute-level-stock-prediction", img: "images/projects/nse-stock-prediction.jpg" },
      { n: "Trader Sentiment Analysis", d: "Quantified how Bitcoin Fear & Greed sentiment drives trader PnL across 211K crypto trades, with a contrarian sentiment-gated signal.", t: ["Python", "pandas", "SciPy", "Statistics"], tools: ["Python", "pandas", "SciPy", "Matplotlib"], dom: ["Finance", "Quant", "Data"], code: "https://github.com/VishnujanNarayanan/Trader_sentiment_analysis", img: "images/projects/trader-sentiment.jpg" },
      { n: "Support Ticket Classifier", d: "NLP pipeline for support tickets — issue-type classification and rule-based entity extraction, served via a Gradio app. Urgency scored at chance and is reported, not claimed.", t: ["Python", "scikit-learn", "NLTK", "Gradio"], tools: ["Python", "scikit-learn", "NLTK", "Gradio"], dom: ["ML", "NLP"], code: "https://github.com/VishnujanNarayanan/ticket-classifier-nlp", img: "images/projects/ticket-classifier-poster.jpg", video: "images/projects/ticket-classifier.mp4" },
      { n: "Semantic Quote Retrieval", d: "Semantic quote search — fine-tuned sentence embeddings + FAISS index over ~2,500 quotes, served through Streamlit.", t: ["Python", "FAISS", "PyTorch", "Streamlit"], tools: ["Python", "FAISS", "PyTorch", "sentence-transformers", "Streamlit"], dom: ["ML", "NLP"], code: "https://github.com/VishnujanNarayanan/Quotes_Retrieval", img: "images/projects/quote-retrieval-poster.jpg", video: "images/projects/quote-retrieval.mp4" },
      { n: "Age & Gender Classifier", d: "Multi-task CNN predicting age and gender from a face photo, trained on 10,000+ UTKFace images with face detection and alignment.", t: ["Python", "TensorFlow", "Keras", "OpenCV"], tools: ["Python", "TensorFlow", "Keras", "OpenCV"], dom: ["ML", "Computer Vision"], code: "https://github.com/VishnujanNarayanan/Image_classifier", img: "images/projects/age-gender-poster.jpg", video: "images/projects/age-gender.mp4" },
      { n: "Neural Network From Scratch", d: "Feed-forward classifier built in pure NumPy — 97.4% accuracy / 0.995 ROC-AUC on Breast-Cancer-Wisconsin, with hand-derived backprop.", t: ["Python", "NumPy"], tools: ["Python", "NumPy"], dom: ["ML"], code: "https://github.com/VishnujanNarayanan/Neural_net_from_scratch", img: "images/projects/neural-net-scratch.jpg" },
      { n: "Linear Regression From Scratch", d: "Linear regression built end to end in pure NumPy — hand-derived gradient descent and a closed-form solver, validated vs scikit-learn.", t: ["Python", "NumPy"], tools: ["Python", "NumPy", "scikit-learn"], dom: ["ML"], code: "https://github.com/VishnujanNarayanan/Linear_regression_from_scratch", img: "images/projects/linear-regression-scratch.jpg" },
      { n: "Binance Futures Trading Bot", d: "CLI trading bot placing market, limit, and stop-limit orders and managing positions on the Binance USDT-M Futures Testnet.", t: ["Python", "python-binance", "CLI"], tools: ["Python", "python-binance", "CLI"], dom: ["Finance", "Backend"], code: "https://github.com/VishnujanNarayanan/binance-futures-trading-bot", img: "images/projects/trading-bot-1.jpg", imgs: ["images/projects/trading-bot-1.jpg", "images/projects/trading-bot-2.jpg", "images/projects/trading-bot-3.jpg", "images/projects/trading-bot-4.jpg"] },
      { n: "Functional Task Manager", d: "Browser task planner written in Scala 3 and compiled to JavaScript — state is one immutable Var, the UI a pure projection of it, with no manual DOM manipulation.", t: ["Scala 3", "Scala.js", "Laminar"], tools: ["Scala", "Scala.js", "Laminar", "sbt", "Vercel"], dom: ["Frontend", "Functional Programming"], h: "https://task-manager-using-functional-progr.vercel.app/", code: "https://github.com/VishnujanNarayanan/task_manager_using_functional_programming", img: "images/projects/task-manager-poster.jpg", video: "images/projects/task-manager.mp4" },
    ];

    // PROJECTS is the single source of truth for a project's card media. The flow
    // section renders its own cards from its own list, and used to repeat img/video
    // there — so a project that gained a real capture kept a stock placeholder in the
    // flow until someone remembered to edit both places (the Job Application Bot and
    // Market Data Platform were both stale that way). Publish a name-keyed registry
    // instead; flow.js reads it and carries no media paths of its own, so adding a
    // video here reaches every surface that shows the project.
    window.__PROJECT_MEDIA = PROJECTS.reduce(function (m, p) {
      m[p.n] = { img: p.img, video: p.video || null };
      return m;
    }, {});

    // Notched-corner card frame (Lando "helmet-grid" reference): base outline + a
    // brighter overlay outline that fades in on hover. Same viewBox/path as the ref.
    var F_BASE = "M8 .5h390.89a7.5 7.5 0 0 1 7.5 7.5v356.983a7.5 7.5 0 0 1-7.5 7.5H263.329a23.502 23.502 0 0 0-18.375 8.849l-16.499 20.695a22.502 22.502 0 0 1-17.593 8.473H8A7.5 7.5 0 0 1 .5 403V8A7.5 7.5 0 0 1 8 .5Z";
    // Hover overlay frame — same curved notch (bottom-right), but the three outer
    // corners (TL/TR/BL) are rounded to r=26 (a touch rounder than the flow cards)
    // instead of the base r=7. Fades in on hover and is geometry-matched EXACTLY to
    // the media's hover clip-path shape() so the outline and image edge coincide.
    var F_OVER = "M27 1 H379.89 A26 26 0 0 1 405.89 27 V364.983 A7 7 0 0 1 398.89 371.983 H263.329 A23.999 23.999 0 0 0 244.563 381.021 L228.064 401.715 A21.999 21.999 0 0 1 210.862 410 H27 A26 26 0 0 1 1 384 V27 A26 26 0 0 1 27 1 Z";
    function frameSvg(cls, d, w) {
      return '<span class="proj-card__frame ' + cls + '"><svg viewBox="0 0 407 411" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="' + d + '" stroke="currentColor" stroke-width="' + w + '" vector-effect="non-scaling-stroke"/></svg></span>';
    }
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    var esc = document.createElement("div");
    function escapeHtml(s) { esc.textContent = s; return esc.innerHTML; }
    function prefixOf(s) { return s.t === "cmd" ? PROMPT : s.t === "sql" ? MYSQL : ""; }
    function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

    // ---- Side-panel "Filter by" facets, derived from PROJECTS' tools/dom ----
    function facetCounts(key) {
      var m = {};
      PROJECTS.forEach(function (p) { (p[key] || []).forEach(function (v) { m[v] = (m[v] || 0) + 1; }); });
      return Object.keys(m).map(function (k) { return { label: k, n: m[k] }; })
        .sort(function (a, b) { return b.n - a.n || a.label.localeCompare(b.label); });
    }
    function facetItems(key) {
      return facetCounts(key).map(function (it) {
        return '<li><label class="filter__item"><input type="checkbox" class="filter__cb" data-facet="' + key +
          '" value="' + slug(it.label) + '"><span class="filter__box" aria-hidden="true"></span>' +
          '<span class="filter__label">' + escapeHtml(it.label) + "</span>" +
          '<span class="filter__n">' + it.n + "</span></label></li>";
      }).join("");
    }
    function groupHtml(key, name, open) {
      return '<div class="filter__group' + (open ? " is-open" : "") + '" data-group="' + key + '">' +
        '<button type="button" class="filter__folder" aria-expanded="' + (open ? "true" : "false") + '">' +
        '<span class="filter__chev" aria-hidden="true"></span><span class="filter__name">' + name + "</span></button>" +
        '<ul class="filter__items">' + facetItems(key) + "</ul></div>";
    }
    function panelHtml() {
      return '<canvas class="term-side-contours" aria-hidden="true"></canvas>' +
        '<div class="filter"><div class="filter__head">Filter by</div>' +
        groupHtml("tools", "Tools", true) + groupHtml("dom", "Domain", true) +
        '<button type="button" class="filter__clear" hidden>Clear all</button></div>';
    }

    // The projects result set rendered under the SELECT — reference-style cards:
    // image base, notched frame, hover-reveal wipe (clip-path ellipse), blue accent.
    function projectsHtml() {
      var rows = PROJECTS.map(function (p, n) {
        // Media links to the subpage if one exists, otherwise straight to GitHub.
        var primary = p.h || p.code || "";
        // Anything off-site opens in a new tab. Tested on the resolved URL rather than
        // on "is this p.code", because p.h is a site-relative path for most projects
        // but an absolute live-demo URL for the ones with no sub-page.
        var ext = /^https?:/i.test(primary);
        var openA = primary
          ? '<a class="proj-card__media" href="' + primary + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">"
          : '<span class="proj-card__media">';
        var closeA = primary ? "</a>" : "</span>";
        // data-tools / data-dom (lowercased, |-joined) let the side-panel filter match.
        var dataF = ' data-tools="|' + p.tools.map(slug).join("|") + '|" data-dom="|' + p.dom.map(slug).join("|") + '|"';
        // A multi-frame card ships every frame in data-frames; wireFrames() cycles
        // them on hover. p.img stays the first frame so the static markup is complete.
        if (p.imgs && p.imgs.length > 1) dataF += ' data-frames="' + p.imgs.join("|") + '"';
        return '<div class="proj-card"' + dataF + ">" +
          openA +
            // A video card ships its poster in the markup, so a crawler and anyone who
            // never hovers still get a real image. preload="none" keeps it off the wire
            // until hover; wireVideos() starts and pauses it.
            (p.video
              ? '<video class="proj-card__img proj-card__video" src="' + p.video + '" poster="' + p.img +
                '" muted loop playsinline preload="none" aria-hidden="true"></video>'
              : '<img class="proj-card__img" src="' + p.img + '" alt="" loading="lazy" decoding="async">') +
            '<span class="proj-card__reveal">' +
              '<span class="proj-card__desc">' + escapeHtml(p.d) + "</span>" +
            "</span>" +
          closeA +
          frameSvg("is-base", F_BASE, 2) + frameSvg("is-overlay", F_OVER, 2) +
          '<span class="proj-card__label">' +
            '<span class="proj-card__title">' + escapeHtml(p.n) + "</span>" +
          "</span>" +
          (p.code ? '<a class="proj-card__code" href="' + p.code + '" target="_blank" rel="noopener">View code <span aria-hidden="true">&#8599;</span></a>' : "") +
          "</div>";
      }).join("");
      // Side panel (LEFT, flush to the border) = "Filter by" facets. The cards live
      // in their OWN clipped viewport (.term-cards-view, top-fade mask) whose inner
      // .term-cards-pan is the layer that pans up on scroll — so the panel stays put
      // and the cards fade out at the top instead of overlapping the SELECT line.
      return '<div class="term-pgrid">' +
          '<aside class="term-side" aria-label="Filter projects" data-lenis-prevent>' + panelHtml() + "</aside>" +
          '<div class="term-cards-view"><div class="term-cards-pan">' +
            '<div class="term-projects">' + rows + "</div>" +
            '<div class="term-result__meta">' + PROJECTS.length + " rows in set (0.001 sec)</div>" +
          "</div></div>" +
        "</div>";
    }

    // The SELECT is the last script entry; everything before it is the "pre" block.
    var selIdx = script.length - 1;
    // total characters across all lines (+1 per line = the "enter"/newline beat)
    var total = 0, i;
    for (i = 0; i < script.length; i++) total += script[i].x.length + 1;

    // Body layout: preEl (install + monitor lines) → selEl (the SELECT line) →
    // projEl (project cards, built ONCE so images don't reload/flicker). Phase 2
    // collapses+fades preEl, easing selEl to the top, and expands+fades in projEl.
    //
    // The three wrappers — and the whole project-card result set — are now rendered
    // STATICALLY into index.html (see the generated block in #term-body, produced by
    // `node scripts/gen-project-cards.mjs` from the PROJECTS array + projectsHtml()
    // below). The cards are the densest keyword content on the site and used to exist
    // only after this script ran, so crawlers that don't execute JS never saw them.
    // This IIFE now ADOPTS that markup and only animates it. projectsHtml() is kept as
    // the single source of truth — the generator calls it, and the fallback below still
    // builds the DOM at runtime if the static block is missing (so the section survives
    // an un-regenerated index.html).
    var preEl = body.querySelector(".term-pre");
    var selEl = body.querySelector(".term-sel");
    var projEl = body.querySelector(".term-result");
    if (!preEl || !selEl || !projEl) {
      preEl = document.createElement("div"); preEl.className = "term-pre";
      selEl = document.createElement("div"); selEl.className = "term-sel";
      projEl = document.createElement("div"); projEl.className = "term-result"; projEl.innerHTML = projectsHtml();
      // preEl (collapses on reveal) + selEl (the `mysql> SELECT …` line) stay pinned at
      // the top; the side panel stays put too. Only .term-cards-pan (inside the clipped,
      // top-faded .term-cards-view) pans UP on scroll, so all 14 cards scroll through the
      // pinned 100vh terminal while the SELECT line + panel hold, fading out at the top.
      body.appendChild(preEl); body.appendChild(selEl); body.appendChild(projEl);
    }
    var panEl = projEl.querySelector(".term-cards-pan");
    var viewEl = projEl.querySelector(".term-cards-view");
    var sideEl = projEl.querySelector(".term-side");
    // How much further down the card content runs than the filter panel's box. The
    // panel holds still for exactly this much of the pan — the stretch where there are
    // still rows below the fold — and then travels with the cards, so the last row and
    // the foot of the panel leave the viewport together instead of the panel sitting
    // there alone under a finished grid. A layout read, so it is measured with the rest
    // of the geometry rather than per frame.
    var sideLead = 0;
    function measureSideLead() {
      sideLead = sideEl ? Math.max(0, panEl.scrollHeight - sideEl.offsetHeight) : 0;
    }

    // Stagger the card pop-in along the anti-diagonal (row+col): the top-left card
    // goes first, then each diagonal "wave" toward the bottom-right corner. Column
    // count is responsive (4 / 2), so read it live from the rendered grid and set
    // a per-card --cd transition-delay; the meta line follows after the last wave.
    var gridEl = projEl.querySelector(".term-projects");
    var cardEls = [].slice.call(projEl.querySelectorAll(".proj-card"));
    // How far PAST the cover line the filter's realign parks the page, and the matching
    // dead-zone the pan absorbs so that overshoot never clips the first row. Declared
    // up here because layoutCardStagger() → panCards() runs during setup.
    var ALIGN_EPS = 2;
    // Column-stagger constants + the seam element it closes against — declared here for
    // the same reason: sizeSection() → cardOverflow() → staggerCardH() runs during setup,
    // and a `var` read before its assignment line would be undefined (→ NaN height).
    var COL_OFFSET_FRAC = 0.75;  // offset at the cover threshold, in card heights
    var COL_CLOSE_AT = 0.8;      // fraction of the run to the seam at which it reaches 0
    var COL_OFFSET_MAX = 2.5;    // cap when scrolling back up, in card heights
    var COL_MIN_CARDS = 8;       // below this the grid reads as plain rows — no stagger
    var brandEl = document.querySelector(".brand-teaser");
    var CARD_STEP = 0.09;   // seconds between successive anti-diagonals (Lando-style flowing rise)
    var RISE_DUR = 0.9;     // seconds — matches the CSS .9s card rise transition
    // The cards wait until the threshold animation (the .term-pre collapse, ~0.6s)
    // is done, then a 0.3s gap, before the first card pops — so they don't appear
    // while the pre-text is still vanishing.
    var PRE_COLLAPSE = 0.6, GAP = 0.3, BASE_DELAY = PRE_COLLAPSE + GAP;
    // Hold (stick) the section pinned at the threshold just long enough for the first
    // cards to actually rise into view — so scrolling through the threshold can't pan
    // them away before they've loaded (which was cutting off the first row). SHORTER
    // than the full cascade: pre-collapse + gap + ~40% of one card's rise, then free
    // scroll while the rest cascade in. Tune the 0.4 for a longer/shorter wait.
    var STICK_MS = (BASE_DELAY + RISE_DUR * 0.4) * 1000;
    function layoutCardStagger() {
      var tpl = getComputedStyle(gridEl).gridTemplateColumns;
      var cols = tpl ? tpl.split(" ").filter(Boolean).length : 4;
      if (cols < 1) cols = 1;
      var maxDiag = 0;
      cardEls.forEach(function (el, i) {
        var diag = Math.floor(i / cols) + (i % cols);
        if (diag > maxDiag) maxDiag = diag;
        el.style.setProperty("--cd", (BASE_DELAY + diag * CARD_STEP) + "s");
      });
      projEl.style.setProperty("--meta-d", (BASE_DELAY + maxDiag * CARD_STEP + RISE_DUR) + "s");
      sizeSection();                                   // pin length tracks the card overflow
      panCards();                                      // re-seat the pan + the column stagger
    }
    layoutCardStagger();
    window.addEventListener("resize", layoutCardStagger, { passive: true });

    // ---- Side-panel filtering ----
    // Faceted filter: a card shows if it matches the selected Tools (any) AND the
    // selected Domains (any). No selection in a group = that group doesn't constrain.
    (function wireFilter() {
      var panel = projEl.querySelector(".term-side");
      if (!panel) return;
      var metaEl = projEl.querySelector(".term-result__meta");
      var clearBtn = panel.querySelector(".filter__clear");
      var sel = { tools: {}, dom: {} };  // value-sets of checked facets

      function matches(card, key) {
        var keys = Object.keys(sel[key]);
        if (!keys.length) return true;                 // group not constraining
        var data = card.getAttribute("data-" + key) || "";
        for (var i = 0; i < keys.length; i++) if (data.indexOf("|" + keys[i] + "|") >= 0) return true;
        return false;
      }
      // On a filter change: COMPLETELY vanish ALL currently-shown cards (the reverse of
      // the appear — sink + fade), then reappear the NEW (filtered) set with the SAME
      // staggered anti-diagonal rise the cards play initially at the threshold.
      var FADE = 550, EASE = "cubic-bezier(.19,1,.22,1)", CLICK_STEP = 0.06;
      var applyT = 0;
      function colCount() {
        var tpl = getComputedStyle(gridEl).gridTemplateColumns;
        var n = tpl ? tpl.split(" ").filter(Boolean).length : 4;
        return n < 1 ? 1 : n;
      }
      // Phase 1 — every currently-visible card sinks + fades out together.
      function vanishAll(done) {
        var vis = cardEls.filter(function (c) { return !c.classList.contains("is-filtered-out"); });
        if (!vis.length) { done(); return; }
        vis.forEach(function (c) {
          c.style.transition = "opacity " + FADE + "ms ease,transform " + FADE + "ms " + EASE;
          c.style.opacity = "0"; c.style.transform = "translateY(64px)";
        });
        clearTimeout(applyT); applyT = setTimeout(done, FADE);
      }
      // Park the page exactly at the cover threshold. Landing a hair PAST it
      // (rect.top ≈ −2px, not exactly 0) keeps the nav reel — which flips dark on
      // featuresEl.top ≤ 0 — dark instead of jittering to light on the boundary; 2px
      // is negligible for the pan.
      // This MUST actually move the page: the caller then re-derives the pan from the
      // real scroll position, and if the two disagree the reappearing set is drawn at
      // pan 0 while the section is still deep in its pin — so the next scroll frame
      // snaps the pan to match and the top rows vanish behind the viewport's clip.
      // `force` because Lenis ignores scrollTo while stopped (the reveal's stick lock)
      // or locked; the native scrollTo covers Lenis being absent; and writing Lenis's
      // internal scroll state stops its own rAF from restoring the previous position
      // on the very next frame.
      function alignToThreshold() {
        var target = window.scrollY + secTop() + ALIGN_EPS;
        var L = window.__lenis;
        if (L && L.scrollTo) L.scrollTo(target, { immediate: true, force: true });
        window.scrollTo(0, target);
        if (L) {
          if ("animatedScroll" in L) L.animatedScroll = target;
          if ("targetScroll" in L) L.targetScroll = target;
        }
      }
      // Phase 2 — drop the non-matching cards, then replay the threshold appear (rise +
      // fade, anti-diagonal stagger recomputed over the filtered grid) on the new set.
      function showFiltered() {
        var matching = [];
        cardEls.forEach(function (c) {
          if (matches(c, "tools") && matches(c, "dom")) { c.classList.remove("is-filtered-out"); matching.push(c); }
          else { c.classList.add("is-filtered-out"); }
        });
        // Re-size the section for the new card count: fewer cards → shorter (or no) pin,
        // so you don't have to scroll a fixed dead-zone past a 1-card result to leave.
        sizeSection();
        // FRESH start: drop any scroll-driven pan so the new set appears from the TOP
        // (not at the prior scrolled position — a 1-card result must be visible without
        // scrolling up). Realign scroll to the cover threshold so panCards() stays at 0.
        panEl.style.transform = "translateY(0px)";
        // Land a hair PAST the cover line (rect.top ≈ −2px, not exactly 0) so the nav
        // reel — which flips dark on featuresEl.top ≤ 0 — stays dark instead of jittering
        // to light when we realign right onto the boundary. 2px is negligible for the pan.
        alignToThreshold();
        matching.forEach(function (c) {                    // reset to the appear "from" state, no transition
          c.style.transition = "none"; c.style.opacity = "0"; c.style.transform = "translateY(64px)";
        });
        void gridEl.offsetWidth;                           // reflow: new grid layout + from-state stick
        var cols = colCount();
        matching.forEach(function (c, i) {
          var d = ((Math.floor(i / cols) + (i % cols)) * CLICK_STEP) + "s";
          c.style.transition = "opacity " + FADE + "ms ease " + d + ",transform " + FADE + "ms " + EASE + " " + d;
          c.style.opacity = "1"; c.style.transform = "none";
        });
        // Derive the pan + column stagger from the REAL scroll position rather than
        // assuming the realign landed. window.scrollTo above is synchronous, so the
        // rect here is already current — and if the align was clamped (e.g. near the
        // document end) the pan still agrees with where the page actually is, instead
        // of sitting at 0 and snapping on the next scroll frame.
        panCards();
        // Re-assert on the next two frames: Chrome's SCROLL ANCHORING reacts to the
        // grid shrinking (cards going display:none) by shifting scrollY to preserve the
        // visual position, which drags the section back off the threshold. Only ever
        // pulls back TO the threshold, and only for those two frames.
        var reassert = function () {
          if (window.innerWidth <= 820) return;
          alignToThreshold();
          panCards();
        };
        requestAnimationFrame(function () { reassert(); requestAnimationFrame(reassert); });
        var any = Object.keys(sel.tools).length + Object.keys(sel.dom).length > 0;
        if (metaEl) metaEl.textContent = matching.length + " row" + (matching.length === 1 ? "" : "s") + " in set" + (any ? " (filtered)" : " (0.001 sec)");
      }
      function apply() {
        var any = Object.keys(sel.tools).length + Object.keys(sel.dom).length > 0;
        if (clearBtn) clearBtn.hidden = !any;              // update the clear pill immediately
        sqlMorph(queryFor(sel));                           // rewrite the SELECT line to match
        vanishAll(showFiltered);                           // vanish ALL → reappear the filtered set
      }
      panel.addEventListener("change", function (e) {
        var cb = e.target.closest && e.target.closest(".filter__cb");
        if (!cb) return;
        var g = cb.getAttribute("data-facet"), v = cb.value;
        if (cb.checked) sel[g][v] = 1; else delete sel[g][v];
        apply();
      });
      panel.addEventListener("click", function (e) {
        var folder = e.target.closest && e.target.closest(".filter__folder");
        if (!folder) return;
        var grp = folder.parentNode, open = grp.classList.toggle("is-open");
        folder.setAttribute("aria-expanded", open ? "true" : "false");
      });
      if (clearBtn) clearBtn.addEventListener("click", function () {
        sel = { tools: {}, dom: {} };
        [].slice.call(panel.querySelectorAll(".filter__cb")).forEach(function (cb) { cb.checked = false; });
        apply();
      });
    })();

    // ---- Multi-frame cards: cycle the stills while hovered ----
    // A card whose PROJECTS entry carries `imgs` renders the first frame statically
    // (so a crawler and a no-JS reader still get a real image) and lists the rest in
    // data-frames. Hovering steps through them on a timer — the cheap version of a
    // screen recording for projects whose demo is a sequence of terminal states.
    (function wireFrames() {
      // Slower than the video cards run, on purpose: these are four static terminal
      // states, not motion. Each one has to be read before it is replaced, and there
      // is no continuity between frames to carry the eye across a fast cut.
      var STEP_MS = 1100;
      [].slice.call(projEl.querySelectorAll(".proj-card[data-frames]")).forEach(function (card) {
        var frames = card.getAttribute("data-frames").split("|").filter(Boolean);
        var img = card.querySelector(".proj-card__img");
        if (!img || frames.length < 2) return;

        // Decode every frame up front, on the first hover only. Swapping src to an
        // undecoded image blanks the element for a beat, which reads as a flicker.
        var warmed = false, timer = null, i = 0;
        function warm() {
          if (warmed) return;
          warmed = true;
          frames.forEach(function (src) { var pre = new Image(); pre.src = src; });
        }
        function stop() {
          if (timer) { clearInterval(timer); timer = null; }
          i = 0;
          img.src = frames[0];
        }
        card.addEventListener("pointerenter", function () {
          if (reduce || timer) return;          // reduced motion: hold frame 1
          warm();
          timer = setInterval(function () {
            i = (i + 1) % frames.length;
            img.src = frames[i];
          }, STEP_MS);
        });
        card.addEventListener("pointerleave", stop);
      });
    })();

    // ---- Video cards: play while hovered, pause when not ----
    // Loading follows the two rules the hero video established:
    //
    //  1. NOT preloaded at first paint. Same call as the transition videos — these are
    //     far below the fold and only ever play on hover, so fetching them on load
    //     would compete with the hero for bandwidth and the decoder, which is exactly
    //     the stutter that preload="none" fixed there.
    //  2. Warmed BEFORE they are needed, and the decoder PRIMED, not just buffered.
    //     Buffered bytes do not mean the decode pipeline is spun up; the hero pays for
    //     that under the boot loader, and paying for it on the first hover would put
    //     the stall somewhere visible. Here the trigger is the section approaching
    //     rather than boot: an observer with a one-viewport margin warms the videos
    //     while the terminal is still off screen, then rolls each briefly and parks it
    //     back at frame 0.
    //  3. HIDDEN = PAUSED. Pointerleave is not enough on its own: hover, then scroll
    //     away without moving the pointer, and the card keeps decoding off screen.
    (function wireVideos() {
      var vids = [].slice.call(projEl.querySelectorAll(".proj-card__video"));
      if (!vids.length) return;

      function prime(vid) {
        if (vid._warmed) return;
        vid._warmed = true;
        vid.preload = "auto";
        var park = function () { try { vid.pause(); vid.currentTime = 0; } catch (e) {} };
        var roll = function () {
          if (reduce) return;                  // reduced motion: never rolls, so never primes
          var pr;
          try { pr = vid.play(); } catch (e) { park(); return; }
          if (pr && pr.then) pr.then(function () { setTimeout(park, 160); }, park);
          else setTimeout(park, 160);
        };
        if (vid.readyState >= 3) { roll(); return; }
        vid.addEventListener("canplaythrough", roll, { once: true });
        vid.addEventListener("loadeddata", roll, { once: true });
        try { vid.load(); } catch (e) {}
      }

      if (window.IntersectionObserver) {
        var warmObs = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            vids.forEach(prime);
            warmObs.disconnect();
          });
        }, { rootMargin: "100% 0px" });
        warmObs.observe(projEl);

        // Off-screen cards must not keep decoding, however the pointer left them.
        var seenObs = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (!e.isIntersecting) e.target.pause(); });
        }, { threshold: 0 });
        vids.forEach(function (v) { seenObs.observe(v); });
      } else {
        vids.forEach(prime);                   // no observer support: just warm them
      }

      vids.forEach(function (vid) {
        var card = vid.closest(".proj-card");
        if (!card) return;
        card.addEventListener("pointerenter", function () {
          if (reduce) return;                  // reduced motion: the poster stands in
          prime(vid);                          // covers a hover that beats the observer
          // play() rejects if the gesture heuristics disagree; muted+playsinline is
          // the combination browsers allow, and a rejection just leaves the poster.
          var p = vid.play();
          if (p && p.catch) p.catch(function () {});
        });
        card.addEventListener("pointerleave", function () { vid.pause(); });
      });
    })();

    // ---- SQL syntax colouring (the `mysql>` lines, typed or edited) ----
    // Tokenised on every paint, and a token only takes its colour once it is FINISHED:
    // a word stays plain until a delimiter follows it (so `WHER`, and even `WHERE` with
    // nothing after it yet, is still being typed and reads as plain text — it turns blue
    // the moment the next character lands), and a quoted value stays plain until its
    // CLOSING quote is typed. Ranges are kept so the caret can be dropped INSIDE a token
    // without breaking its span.
    var SQL_KW = { select: 1, from: 1, where: 1, and: 1, or: 1, in: 1, use: 1, not: 1, like: 1, order: 1, by: 1, limit: 1 };
    var WORD = /[A-Za-z0-9_.]/;
    function sqlTokens(t) {
      var out = [], i = 0, n = t.length, j;
      while (i < n) {
        var c = t.charAt(i);
        if (c === '"' || c === "'") {                       // string literal
          j = i + 1; while (j < n && t.charAt(j) !== c) j++;
          var closed = j < n; if (closed) j++;              // no closing quote yet → still typing
          out.push([i, j, closed ? "sql-str" : ""]); i = j;
        } else if (WORD.test(c)) {                          // keyword or identifier
          j = i; while (j < n && WORD.test(t.charAt(j))) j++;
          out.push([i, j, j >= n ? ""                       // runs to the end → still being typed
            : SQL_KW[t.slice(i, j).toLowerCase()] ? "sql-kw" : "sql-id"]); i = j;
        } else if (c === " ") {
          j = i; while (j < n && t.charAt(j) === " ") j++;
          out.push([i, j, ""]); i = j;
        } else { out.push([i, i + 1, "sql-op"]); i++; }      // * = , ( ) ;
      }
      return out;
    }
    function sqlWrap(cls, s) { return cls ? '<span class="' + cls + '">' + escapeHtml(s) + "</span>" : escapeHtml(s); }
    // Mid-edit the line is HEAD (the part being typed/deleted) + TAIL (the settled suffix
    // that was never touched). Tokenising the whole thing left-to-right would let a
    // half-typed opening quote in the head PAIR with a quote sitting in the tail — while
    // typing `… IN ("Data", ") AND tool = "Python";` the run `") AND tool = "` would go
    // green as if it were a value. So the tail is coloured from the TARGET's own tokens
    // and only the head is tokenised live: an opened quote stays white until ITS OWN
    // closing quote is typed, and nothing behind it changes colour in the meantime.
    function sqlTokensFor(text, ed) {
      if (!ed || !ed.tail.length) return sqlTokens(text);
      var headLen = text.length - ed.tail.length;
      if (headLen < 0) return sqlTokens(text);
      var toks = sqlTokens(text.slice(0, headLen)), tstart = ed.target.length - ed.tail.length;
      sqlTokens(ed.target).forEach(function (tk) {
        if (tk[1] <= tstart) return;                       // wholly inside the head — skip
        toks.push([Math.max(tk[0], tstart) - tstart + headLen, tk[1] - tstart + headLen, tk[2]]);
      });
      return toks;
    }
    // Colour `text`, dropping `caret` (an HTML string) at index `cur` — inside a token if
    // that's where it sits, so the span it splits keeps its colour on both sides.
    function sqlHtml(text, cur, caret, ed) {
      var toks = sqlTokensFor(text, ed), h = "", k;
      if (cur == null) cur = -1;
      for (k = 0; k < toks.length; k++) {
        var a = toks[k][0], b = toks[k][1], cls = toks[k][2];
        if (cur > a && cur < b) h += sqlWrap(cls, text.slice(a, cur)) + caret + sqlWrap(cls, text.slice(cur, b));
        else { if (cur === a) h += caret; h += sqlWrap(cls, text.slice(a, b)); }
      }
      if (cur >= text.length) h += caret;
      return h;
    }
    function lineHtml(pfx, text, cursor, sql) {
      return '<div class="terminal__line">' + pfx +
        (sql ? sqlHtml(text, -1, "") : escapeHtml(text)) + (cursor || "") + "</div>";
    }
    // Build the typed text at `reveal` chars into preEl (pre-SELECT) + selEl (SELECT).
    /* Incremental cache for the typed script.
       renderText used to rebuild EVERY line from scratch and assign innerHTML twice,
       on every frame the reveal count moved — i.e. every frame you scroll through the
       typing. innerHTML is a parse plus a teardown/rebuild of the whole subtree, and
       the cost grows as more script is revealed, so it was worst exactly where the
       section is busiest (measured ~14ms/frame, the largest single cost on the page).
       Lines that are FULLY typed and no longer carry the cursor can never change, so
       their HTML is accumulated once here and only the live line is rebuilt per frame.
       The cache is dropped whenever the reveal moves backwards (scrolling up). */
    var cPre = "", cSel = "", cK = 0, cUsed = 0;
    function resetTextCache() { cPre = ""; cSel = ""; cK = 0; cUsed = 0; }
    function renderText(reveal) {
      if (reveal < cUsed) resetTextCache();               // scrolled back — cache invalid
      // Advance the cache over lines that are complete AND past their newline gap,
      // so the cursor can never be sitting in one of them.
      while (cK < script.length) {
        var cs = script[cK], clen = cs.x.length;
        if (cUsed + clen + 1 > reveal) break;
        var chtml = lineHtml(prefixOf(cs), cs.x,
          cK === selIdx ? '<span class="term-cursor is-blink"></span>' : "", cs.t === "sql");
        if (cK === selIdx) cSel += chtml; else cPre += chtml;
        cUsed += clen + 1; cK++;
      }
      var pre = cPre, sel = cSel, used = cUsed, done = reveal >= total, k;
      for (k = cK; k < script.length; k++) {
        var s = script[k], len = s.x.length, pfx = prefixOf(s), into;
        if (used + len <= reveal) {                       // whole line shown
          var cur = "";
          if (used + len + 1 > reveal && !done) cur = '<span class="term-cursor"></span>'; // in the newline gap
          into = lineHtml(pfx, s.x, k === selIdx ? '<span class="term-cursor is-blink"></span>' : cur, s.t === "sql");
          if (k === selIdx) sel += into; else pre += into;
          used += len + 1;
          if (cur) break;
        } else {                                          // partially typed (live) line
          var part = s.x.slice(0, Math.max(0, reveal - used));
          into = lineHtml(pfx, part, '<span class="term-cursor"></span>', s.t === "sql");
          if (k === selIdx) sel += into; else pre += into;
          break;
        }
      }
      if (pre !== lastPreHtml) { lastPreHtml = pre; preEl.innerHTML = pre; }
      if (sel !== lastSelHtml) { lastSelHtml = sel; selEl.innerHTML = sel; }
    }
    var lastPreHtml = null, lastSelHtml = null;

    /* ---- Live SQL: the SELECT line rewrites itself as the facets are toggled ----
       Clicking a tool/domain doesn't just filter the cards — the query above them is
       edited to match, so the line always reads as the SQL that produced the result
       set below it. The edit is a MINIMAL IN-PLACE one, an extension of the flow
       section's CLI morph (flow.js setSwap/domainText): that one keeps the common
       PREFIX and retypes the tail; this one keeps the common prefix AND the common
       SUFFIX, so the cursor walks back INTO the line, deletes only the characters that
       actually changed and types the replacement there. It then STAYS at that spot
       (blinking) rather than returning to the end — the next edit starts its walk from
       wherever it was left, which is usually already near the next thing to change.
       Unticking "NumPy" out of `tool IN ("Python", "NumPy", "pandas")` therefore deletes
       exactly `NumPy` — "pandas" and any AND-ed domain clause after it are never touched.
       Clauses are ordered by WHICH FACET WAS TICKED FIRST, and values within a clause by
       click order, so a new tick is always an insertion at the end of its own clause
       rather than a rewrite of the line.
       Within a facet the filter matches ANY selected value (see matches() below), so
       multiple values render as `IN ("a", "b")` — the SQL that actually means that —
       while facets are joined with AND, mirroring the AND across groups. */
    var SQL_BASE = "SELECT * FROM projects";
    var COLS = { tools: "tool", dom: "domain" };
    var LABELS = { tools: {}, dom: {} };   // slug → the human label shown in the panel
    ["tools", "dom"].forEach(function (k) {
      facetCounts(k).forEach(function (it) { LABELS[k][slug(it.label)] = it.label; });
    });
    // A lone value reads as `tool = "Python"`. The moment a second joins it becomes
    // `tool IN (…)`, and the clause STAYS in the IN form until the facet empties out —
    // otherwise dropping back to one value would collapse `IN ("Python", "pandas")` to
    // `= "Python"`, which means deleting and retyping "Python" for no reason. Sticky IN
    // makes that untick delete exactly `, "pandas"`. Both forms are the same query.
    var usedIn = { tools: false, dom: false };
    function clauseFor(key, vals) {
      if (!vals.length) { usedIn[key] = false; return ""; }
      if (vals.length > 1) usedIn[key] = true;
      var names = vals.map(function (v) { return '"' + (LABELS[key][v] || v) + '"'; });
      return (names.length === 1 && !usedIn[key]) ? COLS[key] + " = " + names[0]
                                                  : COLS[key] + " IN (" + names.join(", ") + ")";
    }
    // Clause order = the order the facets were first ticked (a facet that empties out
    // drops off and re-joins at the end). So ticking a domain first then a tool appends
    // ` AND tool = …` after the domain clause instead of re-ordering — nothing already
    // typed has to move. Values inside a clause keep their click order for the same reason.
    var facetOrder = [];
    function queryFor(state) {
      var parts = [];
      ["tools", "dom"].forEach(function (k) {
        var on = Object.keys(state[k]).length > 0, at = facetOrder.indexOf(k);
        if (on && at < 0) facetOrder.push(k);
        else if (!on) { if (at >= 0) facetOrder.splice(at, 1); usedIn[k] = false; }
      });
      facetOrder.forEach(function (k) { parts.push(clauseFor(k, Object.keys(state[k]))); });
      return SQL_BASE + (parts.length ? " WHERE " + parts.join(" AND ") : "") + ";";
    }
    var MOVE_MS = 14, UNTYPE_MS = 22, TYPE_MS = 36;   // per char: cursor travel / delete / type (20% slower than the first pass)
    var sqlShown = SQL_BASE + ";";         // what the SELECT line currently reads
    var sqlCur = sqlShown.length;          // where the caret sits inside it
    var sqlRaf = 0, sqlT0 = 0, sqlOwned = false;   // sqlOwned: past the reveal, we own selEl
    var sqlEd = null;                      // the running edit plan (see sqlMorph)
    function renderSel(text, cur, blink, ed) {
      if (!sqlOwned) return;               // pre-reveal the scroll typing still owns the line
      var cls = "term-cursor" + (blink ? " is-blink" : "") + (cur < text.length ? " is-over" : "");
      selEl.innerHTML = '<div class="terminal__line">' + MYSQL +
        sqlHtml(text, cur, '<span class="' + cls + '"></span>', ed) + "</div>";
    }
    function sqlStep(now) {
      if (!sqlT0) sqlT0 = now;
      var el = now - sqlT0, e = sqlEd;
      if (el < e.t1) {                                   // 1 — walk the caret to the edit point
        sqlShown = e.from;
        sqlCur = e.startCur + e.moveDir * Math.min(e.moveN, Math.floor(el / MOVE_MS));
      } else if (el < e.t2) {                            // 2 — backspace ONLY the changed span
        var d = Math.min(e.del, Math.floor((el - e.t1) / UNTYPE_MS));
        sqlCur = e.editEnd - d; sqlShown = e.from.slice(0, sqlCur) + e.tail;
        renderSel(sqlShown, sqlCur, false, e); sqlRaf = requestAnimationFrame(sqlStep); return;
      } else if (el < e.t3) {                            // 3 — type the replacement in place
        var i = Math.min(e.ins, Math.floor((el - e.t2) / TYPE_MS));
        sqlCur = e.p + i; sqlShown = e.target.slice(0, sqlCur) + e.tail;
        renderSel(sqlShown, sqlCur, false, e); sqlRaf = requestAnimationFrame(sqlStep); return;
      } else {                                           // done — the caret STAYS where the
        sqlShown = e.target; sqlCur = e.p + e.ins;       // last character was typed/deleted
        sqlRaf = 0; sqlEd = null; renderSel(sqlShown, sqlCur, true); return;
      }
      renderSel(sqlShown, sqlCur, false);
      sqlRaf = requestAnimationFrame(sqlStep);
    }
    // Morph the line to `target` with the smallest possible edit. Retargeting mid-edit is
    // fine: the new plan starts from the text AND caret position on screen RIGHT NOW, so
    // rapid clicking never jumps or replays.
    function sqlMorph(target) {
      if (target === sqlShown && !sqlRaf) return;
      if (reduce) {
        sqlRaf = 0; sqlEd = null; sqlShown = target; sqlCur = target.length;
        renderSel(target, sqlCur, true); return;
      }
      var from = sqlShown, m = Math.min(from.length, target.length), p = 0;
      while (p < m && from.charCodeAt(p) === target.charCodeAt(p)) p++;   // common prefix
      var s = 0, sm = m - p;                                              // common suffix
      while (s < sm && from.charCodeAt(from.length - 1 - s) === target.charCodeAt(target.length - 1 - s)) s++;
      var del = from.length - s - p, ins = target.length - s - p;         // the changed span only
      var editEnd = p + del, startCur = Math.min(Math.max(sqlCur, 0), from.length);
      var moveN = Math.abs(editEnd - startCur);          // caret walks either way to get there
      var t1 = moveN * MOVE_MS, t2 = t1 + del * UNTYPE_MS, t3 = t2 + ins * TYPE_MS;
      sqlEd = { from: from, target: target, tail: from.slice(from.length - s), p: p, del: del, ins: ins,
                editEnd: editEnd, startCur: startCur, moveN: moveN, moveDir: editEnd >= startCur ? 1 : -1,
                t1: t1, t2: t2, t3: t3 };
      sqlT0 = 0;                                          // re-seed the clock on the next frame
      if (!sqlRaf) sqlRaf = requestAnimationFrame(sqlStep);
    }

    var term = body.closest(".terminal");

    if (reduce) { renderText(total); sqlOwned = true; term.classList.add("is-revealing"); term.classList.add("is-covered"); return; }

    // Scroll model. The section slides UP from the bottom: rect.top travels from
    // +vh (appearing) → 0 (reaches the top / fully covers) → −(height−vh) (past).
    //  • Phase 1 is SCROLL-DRIVEN: rect.top 6/7·vh → 0 types the whole script; at
    //    full cover the last line is `mysql> SELECT * FROM projects;` (no projects).
    //  • Reaching the top (rect.top ≤ 0) is a THRESHOLD that fires a TIMED (not
    //    scroll-based) CSS reveal: the pre-lines fade+collapse so SELECT eases to
    //    the top, then the project cards come in (transition-delay). The reveal is
    //    LATCHED — once fired it never reverses, so scrolling back up keeps the
    //    cards on screen (and stops the per-frame re-typing fighting the scroll).
    var raf = 0, lastR = -1, atTop = false;
    // Scroll LOCK: at the threshold the section STICKS (pins) just long enough for the
    // first cards to rise in (STICK_MS), so they aren't panned away mid-animation — the
    // cause of the first row getting cut off / not loading. Released early so you can
    // start scrolling soon after.
    var lenis = window.__lenis, locked = false, lockY = 0, stickT = 0;
    var SCROLL_KEYS = { 32: 1, 33: 1, 34: 1, 35: 1, 36: 1, 38: 1, 40: 1 };
    function blockScroll(e) { e.preventDefault(); }
    function blockKeys(e) { if (SCROLL_KEYS[e.keyCode]) e.preventDefault(); }
    function clampScroll() { if (locked && window.scrollY !== lockY) window.scrollTo(0, lockY); }
    // Momentum carry: leftover scroll speed at the reveal becomes a decaying DOWNWARD
    // offset on the cards layer (they start a bit lower and ease up), instead of panning
    // them UP into the clip (which cut the top row). momOff eases to 0 on its own rAF so
    // it still animates while the stick has scrolling frozen.
    var momOff = 0, momRAF = 0, MOM_SCALE = 1.2, MOM_MAX = 60;
    function animMom() {
      momOff += (0 - momOff) * 0.09;
      if (Math.abs(momOff) < 0.3) { momOff = 0; momRAF = 0; panCards(); return; }
      panCards(); momRAF = requestAnimationFrame(animMom);
    }
    function engageStick() {
      if (locked || window.innerWidth <= 820) return;        // no pin on mobile
      // Land EXACTLY at the cover line (rect.top = 0) so the base pan is 0 — the cards
      // appear un-panned with full top clearance regardless of scroll overshoot/momentum.
      var vel = (lenis && typeof lenis.velocity === "number") ? lenis.velocity : scrollVel;
      lockY = window.scrollY + secTop(); // scrollY where rect.top = 0
      locked = true;
      if (lenis) { lenis.scrollTo(lockY, { immediate: true }); lenis.stop(); }
      else window.scrollTo(0, lockY);
      // Nav flip: frame() reads getBoundingClientRect() which can land at a sub-pixel
      // positive value after the immediate scroll commit (float imprecision at exactly 0),
      // leaving the threshold undetected while the page is locked. Force it here —
      // engageStick only fires when r.top ≤ 0, so dark is always correct at this point.
      if (window.__navLight) window.__navLight(false, true);
      if (window.__headerTheme) window.__headerTheme(1, true);
      // Hand the killed momentum to the cards as a downward coast that eases up.
      momOff = Math.min(MOM_MAX, Math.max(0, Math.abs(vel) * MOM_SCALE));
      if (momRAF) cancelAnimationFrame(momRAF);
      momRAF = requestAnimationFrame(animMom);
      window.addEventListener("wheel", blockScroll, { passive: false });
      window.addEventListener("touchmove", blockScroll, { passive: false });
      window.addEventListener("keydown", blockKeys, false);
      window.addEventListener("scroll", clampScroll, { passive: true });
      stickT = setTimeout(releaseStick, STICK_MS || 1200);
    }
    function releaseStick() {
      if (!locked) return; locked = false; clearTimeout(stickT);
      if (lenis) lenis.start();
      window.removeEventListener("wheel", blockScroll, { passive: false });
      window.removeEventListener("touchmove", blockScroll, { passive: false });
      window.removeEventListener("keydown", blockKeys, false);
      window.removeEventListener("scroll", clampScroll, { passive: true });
    }
    // How far the (visible) cards extend past their viewport — drives BOTH the section
    // height and the pan, so the two stay in lock-step.
    var PAN_PAD = 24;
    function cardOverflow() {
      // + the column stagger's depth: the offset columns hang up to four-fifths of a
      // card below the grid's layout box, and `translate` doesn't affect scrollHeight;
      // without this the pin is that much too short and their last row can never scroll fully
      // into view. Uses the MAX (threshold) offset so the pin length stays constant
      // rather than shifting under the mapping as the offset closes.
      var ov = panEl.scrollHeight - viewEl.clientHeight + staggerCardH() * COL_OFFSET_FRAC;
      return ov > 0 ? ov + PAN_PAD : 0;                 // 0 when the cards already fit
    }
    // Size the section so the PINNED scroll length == the card overflow: more projects
    // below → a longer pin (scrolling down reveals them); all projects already visible
    // → overflow 0 → height 100vh → no extra pin, so you scroll on out of the section
    // normally (no fixed dead-zone). Recomputed on init, resize, and every filter change.
    function sizeSection() {
      measureSideLead();                                 // same triggers as the pin length
      var prevH = sec.style.height;
      if (window.innerWidth <= 820) { sec.style.height = ""; }         // mobile: natural flow
      else sec.style.height = (window.innerHeight + cardOverflow()) + "px";
      if (sec.style.height === prevH) return;            // nothing moved; don't re-measure
      measureSec();                                      // height just changed
      // .features just changed height — the contour loop caches section geometry.
      if (window.__remeasureContours) window.__remeasureContours();
      // ...and so does every scroll effect BELOW this section: changing the pin length
      // moves them in the DOCUMENT, but their cached document-top was measured against
      // the OLD height. Without this their thresholds fire at the wrong scroll position
      // — most visibly the socials fan, whose cards spread early/late by exactly the
      // height delta after the reveal's post-collapse re-size (and after every filter).
      window.dispatchEvent(new Event("layoutshift"));
    }
    // ---- Column stagger ----
    // The EVEN columns (2 and 4, i.e. zero-based index 1 and 3) sit half a card lower
    // than columns 1 and 3, and close that gap as the section scrolls: they pan UP
    // faster than the odd columns until all four land flush on the grid line exactly
    // as the pin hands off to Skills (the bulge). Reversible — scroll back up and they
    // drop away again.
    //
    // This is a property of the COLUMN, not of a card and not of the reveal: it's
    // re-derived from each visible card's live column index, so a filtered set (which
    // reflows cards into different columns) keeps the same rhythm without being tied
    // to the vanish/reappear animation. It's written to the independent CSS `translate`
    // property, NOT `transform` — `transform` carries the .9s reveal/filter transition,
    // so folding this into it would re-trigger that easing on every scroll frame and
    // smear. `translate` has no transition, so per-frame writes land instantly and the
    // two compose (translate is applied before transform).
    // The offset closes on a scroll span that ENDS at the bulge's midpoint, not at the
    // pin handoff. The bulge (.skills-curve, the projects→skills seam) is driven by
    // `.brand-teaser`: p_bulge = (vh − top) / (0.6·vh), so it is exactly half-drawn when
    // its top sits at 0.7·vh. Reading the same element keeps the two in lock-step
    // regardless of the pin length (which changes with every filter), so this also
    // covers a filtered 1–2 card result that has no pinned scroll at all.
    var BULGE_RANGE = 0.6, BULGE_MID = 0.5;              // mirror the seam's own constants
    var brandGap = null;                                 // doc-space terminal-top -> seam distance
    window.addEventListener("resize", function () { brandGap = null; }, { passive: true });
    function colOffsetProgress() {
      var top = secTop();
      if (!brandEl) return Math.min(1, Math.max(0, -top / Math.max(1, secH - window.innerHeight)));
      var vh = window.innerHeight;
      // Layout distance from the terminal's top to the seam. It IS constant — which is
      // exactly why it must not be measured live: both terms shift with scroll by the
      // same amount, so the difference never changes, but getBoundingClientRect flushed
      // style+layout every frame to rediscover it. Cached as a document-space delta.
      if (brandGap === null) brandGap = (brandEl.getBoundingClientRect().top + (window.scrollY || 0)) - (secDocTop);
      var gap = brandGap;
      var span = gap - vh * (1 - BULGE_RANGE * BULGE_MID);  // threshold → bulge half-drawn
      if (span <= 0) return 1;
      // NOT clamped below 0: scrolling back up past the threshold (toward the blog)
      // carries p negative, so the columns keep parting further instead of resting at
      // the threshold offset. Clamped above at 1; applyColumnOffset closes the gap over
      // COL_CLOSE_AT of that run, so they are flush a little before the bulge.
      return Math.min(1, -top / span);
    }
    // Card height when the stagger is live, else 0. A small (filtered) result set sits
    // in normal, flush rows: the stagger only earns its keep once the grid is deep
    // enough for the column rhythm to read. Counted on the VISIBLE cards, so it
    // switches on/off with the filter.
    function staggerCardH() {
      if (reduce || window.innerWidth <= 820) return 0;
      var shown = 0, first = null;
      for (var i = 0; i < cardEls.length; i++) {
        if (cardEls[i].classList.contains("is-filtered-out")) continue;
        if (!first) first = cardEls[i];
        shown++;
      }
      return shown >= COL_MIN_CARDS && first ? first.offsetHeight : 0;
    }
    function applyColumnOffset(p) {
      if (!staggerCardH()) { clearColumnOffset(); return; }
      var tpl = getComputedStyle(gridEl).gridTemplateColumns;
      var cols = tpl ? tpl.split(" ").filter(Boolean).length : 4;
      if (cols < 1) cols = 1;
      // Scrolling up keeps opening the gap; cap it so it can't run away on a long
      // scroll back through the blog (the cards stay latched-visible up there).
      // Closes over COL_CLOSE_AT of the run rather than all of it, so the columns are
      // flush before the seam rather than exactly at it. Floored at 0 — p is clamped
      // above at 1, so past the close point the term goes negative and would other-
      // wise lift the offset columns above their neighbours.
      var frac = Math.max(0, Math.min(COL_OFFSET_MAX, (1 - p / COL_CLOSE_AT) * COL_OFFSET_FRAC));
      var off = null, vi = 0;
      for (var i = 0; i < cardEls.length; i++) {
        var el = cardEls[i];
        if (el.classList.contains("is-filtered-out")) { el.style.translate = ""; continue; }
        if (off === null) off = frac * el.offsetHeight;  // one read: the cards are uniform
        el.style.translate = (vi % cols) % 2 ? "0 " + off.toFixed(1) + "px" : "0 0px";
        vi++;
      }
    }
    function clearColumnOffset() {
      cardEls.forEach(function (el) { el.style.translate = ""; });
    }
    // Map the pinned scroll to a vertical PAN of the cards layer inside its clipped
    // viewport. Because sizeSection() made the pin length == the overflow, the last card
    // lands exactly as the pin releases to Skills. The side panel doesn't move.
    // Written to `translate`, NOT `transform`: .term-side carries the .9s reveal
    // transition on `transform`, so folding the pan into it would re-trigger that
    // easing every scroll frame. `translate` has no transition and composes with it.
    function panSide(px) {
      if (!sideEl) return;
      sideEl.style.translate = px ? "0 " + (-px).toFixed(1) + "px" : "";
    }
    function panCards() {
      if (window.innerWidth <= 820) { panEl.style.transform = ""; panSide(0); clearColumnOffset(); return; }
      var pinScroll = secH - window.innerHeight;            // == cardOverflow() (cached; was sec.offsetHeight)
      applyColumnOffset(colOffsetProgress());
      // momOff (≥0) coasts the cards DOWN then eases to 0 — the reveal's momentum carry.
      // `|| 0`: layoutCardStagger() calls this during setup, before momOff is assigned.
      var mom = momOff || 0;
      if (pinScroll <= 0) { panEl.style.transform = "translateY(" + mom.toFixed(1) + "px)"; panSide(0); return; }
      // The pan's zero point is ALIGN_EPS past the cover line, not on it. The filter's
      // realign deliberately parks the page 2px past that line (so the nav reel, which
      // flips dark on featuresEl.top ≤ 0, doesn't jitter to light on the boundary) — and
      // because the pan maps scroll 1:1, those 2px became 2px of pan and sliced the top
      // border off the first row of the non-offset columns. Absorbing the same epsilon
      // here keeps the first row flush; over a several-hundred-px pin it's invisible.
      var travel = -secTop() - ALIGN_EPS;
      var range = Math.max(1, pinScroll - ALIGN_EPS);
      var past = Math.min(1, Math.max(0, travel / range));
      var cardPan = past * range;
      panEl.style.transform = "translateY(" + (-cardPan + mom).toFixed(1) + "px)";
      panSide(Math.max(0, cardPan - sideLead));
    }
    function update() {
      raf = 0;
      var r = { top: secTop() }, vh = window.innerHeight;
      // Top bar: reversible at the threshold — hidden while the terminal covers the
      // top (r.top ≤ 0), back the moment you scroll up past it. Toggled every frame
      // (independent of the latched card reveal below).
      term.classList.toggle("is-covered", r.top <= 0);
      if (atTop) { panCards(); return; }                  // latched: cards stay; pan to reveal all rows
      if (r.top <= 0) {                                   // threshold reached → fire the reveal once
        atTop = true; term.classList.add("is-revealing");
        renderText(total); lastR = total;
        // Stick ONLY when the threshold was crossed by scrolling INTO the section.
        // In-page anchors are native jumps (Lenis is not configured to intercept them),
        // so clicking Contact / Socials — or loading the homepage with a hash, which is
        // what the sub-page nav links do — lands far past this section in a single step.
        // engageStick() would then scrollTo(lockY) BACK to projects and freeze the page
        // for STICK_MS: the click looks like it gets stuck at projects instead of going
        // where it was aimed. A real scroll can only ever cross this line a few px at a
        // time, so "more than a viewport past the cover line" means it was a jump.
        if (r.top > -vh) engageStick();
        // The scroll typing is done with the line — from here the facet clicks own it.
        sqlOwned = true; renderSel(sqlShown, sqlCur, true);
        // The pin length was sized at init while .term-pre was still expanded, so the
        // cards' viewport was shorter and the overflow (thus the pan) came out too big.
        // Re-size once the pre-text collapse finishes so the revealed geometry drives the
        // pin — matching what a filter click gets (last row lands as the pin releases).
        var resize = function () { sizeSection(); panCards(); };
        preEl.addEventListener("transitionend", function onEnd(e) {
          if (e.propertyName !== "max-height") return;     // wait for the height collapse, not opacity
          preEl.removeEventListener("transitionend", onEnd); resize();
        });
        setTimeout(resize, (PRE_COLLAPSE + 0.05) * 1000);  // fallback if no transitionend
        panCards(); return;
      }
      var typeStart = vh * (6 / 7);
      var typeT = Math.min(1, Math.max(0, (typeStart - r.top) / (typeStart - 0)));
      var reveal = Math.round(typeT * total);
      if (reveal !== lastR) { lastR = reveal; renderText(reveal); }
    }
    // SNAP-TO-THRESHOLD: a pre-threshold buffer just ABOVE the full-cover position.
    // If a scroll SETTLES inside it (while still approaching DOWN), auto-scroll the
    // rest of the way so the section lands exactly at its cover position (rect.top = 0).
    var snapT = 0, lastY = window.scrollY, dir = 1, scrollVel = 0;
    function maybeSnap() {
      if (locked || window.innerWidth <= 820 || dir < 0) return; // only approaching down
      var r = sec.getBoundingClientRect(), buffer = window.innerHeight * 0.2;
      if (r.top > 0 && r.top <= buffer) {
        // Land a few px PAST the cover line (rect.top ≈ −4, not exactly 0). Lenis easing
        // tends to settle a hair short of the target, leaving rect.top a fraction above 0
        // — which never trips the `r.top <= 0` reveal threshold, so the snap looked full
        // screen but the cards never loaded. The overshoot guarantees the reveal fires.
        var target = window.scrollY + r.top + 4;             // scrollY that makes rect.top ≈ −4
        if (lenis) lenis.scrollTo(target, { duration: 0.5 });
        else window.scrollTo({ top: target, behavior: "smooth" });
      }
    }
    function onScroll() {
      var y = window.scrollY; dir = y >= lastY ? 1 : -1; scrollVel = y - lastY; lastY = y;
      if (!raf) raf = requestAnimationFrame(update);
      clearTimeout(snapT); snapT = setTimeout(maybeSnap, 140); // fire once the scroll settles
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  })();

  /* ---------- Projects→Skills curved seam ---------- */
  /* The dark projects band's bottom edge starts straight and bulges
     (curves out) downward into the light skills section as it scrolls up. */
  (function () {
    var path = document.querySelector(".skills-curve__path");
    var sec = document.querySelector(".brand-teaser");
    if (!path || !sec) return;
    var MAX_DEPTH = 100; // viewBox units (box is 140px tall)
    var RANGE = 0.6;     // fraction of viewport over which it curves out
    var ticking = false;
    // Cached document geometry — see the other scroll loops; a live rect here flushed
    // style+layout on every scroll frame.
    var curveTop = null;
    function measureCurve() { curveTop = sec.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0); }
    window.addEventListener("resize", measureCurve, { passive: true });
    window.addEventListener("load", function () { measureCurve(); render(); });
    // .brand-teaser sits directly under the projects section, whose height is set from JS
    // (at the reveal, on resize, and on every filter click) — so its DOCUMENT position
    // moves by that delta and the cached one is wrong. The pin announces the change with
    // "layoutshift"; without listening for it the seam computed its progress against a
    // stale position and bulged out early, or read as already done and never appeared to
    // trigger at all. Which of the two you got depended on whether the pin had re-sized
    // before or after the one measurement — hence "sometimes".
    window.addEventListener("layoutshift", function () { measureCurve(); render(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measureCurve(); render(); });
    function render() {
      ticking = false;
      if (window.innerWidth <= 820) return;
      var vh = window.innerHeight;
      if (curveTop === null) measureCurve();
      var top = curveTop - (window.scrollY || window.pageYOffset || 0);
      // p = 0 when the seam first appears at the bottom of the screen,
      // 1 once it has risen RANGE*vh — straight → fully curved.
      var p = (vh - top) / (RANGE * vh);
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      var d = (p * MAX_DEPTH).toFixed(1);
      path.setAttribute("d", "M0 0 L100 0 Q50 " + d + " 0 0 Z");
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(render); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", render);
    render();
  })();

  /* ---------- Flow journey ---------- */
  /* The flow section's three.js parallax journey lives in flow.js,
     loaded only on pages that contain .flow. */

  /* Vanta NET background is initialised inline in index.html (#vanta-bg). */
})();

/* ============================================================
   Check Out My Socials: scroll-driven fanned-card spread.
   Cards start stacked at centre (pushed down 10rem, upright) and
   fan out into a symmetric peacock spread as the section scrolls
   into view. Pure function of scroll → reverses on scroll-up.
   ============================================================ */
(function socialsFan() {
  const layout = document.querySelector(".callout-socials-card-layout");
  if (!layout) return;
  const cards = Array.from(layout.querySelectorAll(".callout-socials-card-w"));
  if (!cards.length) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mq = window.matchMedia("(max-width: 820px)");

  // px-per-rem (root font-size) for the rem-based fan offsets.
  const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;


  /* ---- Exact fan + hover, reverse-engineered from the live Lando matrices ----
     (lando_social_hover_matrix + lando_social_hover_bouncy_matrix). All px values
     are at 20rem card width (rem=16) and scale responsively with the card size. */

  // REST (settled) fan pose per card, decoded from REST matrices. px @ rem16.
  // rotation is exactly 7deg x slot; x/y/scale lifted verbatim from the capture.
  const REST = [
    { x: -380,    y: 92.47, r: -21, s: 0.7756 },
    { x: -278.67, y: 50.67, r: -14, s: 0.8498 },
    { x: -139.33, y: 16.47, r:  -7, s: 0.9346 },
    { x:    0,    y:  0,    r:   0, s: 1.0000 },
    { x:  139.33, y: 16.47, r:   7, s: 0.9346 },
    { x:  278.67, y: 50.67, r:  14, s: 0.8498 },
    { x:  380,    y: 92.47, r:  21, s: 0.7756 },
  ];
  const STACK_Y = 160;     // px: stacked start offset (reference translate(0,10rem))
  const POP_LIFT = 31.67;  // px: hovered card lifts up (matrix-exact)
  const POP_SCALE = 1.08;  // hovered card scale multiplier (matrix-exact)
  // Δx (px @ rem16) per [hovered][card] — room-dependent slide-away, hardcoded
  // from the settled matrices (rows 4-6 mirror 2-0). Hovered card's own Δx = 0.
  const DX = [
    [   0,  47.29,  81.06, 101.33,  67.56,  33.78,   0],
    [   0,   0,     94.57, 121.60,  67.56,  33.78,   0],
    [   0, -47.28,   0,    141.87,  81.07,  33.78,   0],
    [   0, -40.53, -94.58,   0,     94.58,  40.53,   0],
    [   0, -33.78, -81.07,-141.87,   0,     47.28,   0],
    [   0, -33.78, -67.56,-121.60, -94.57,   0,      0],
    [   0, -33.78, -67.56,-101.33, -81.06, -47.29,   0],
  ];
  // Δr (deg) is the clean closed form sign(i-h) * 3/(|i-h|+1) (matrix-exact).
  const drot = (h, i) => (i === h ? 0 : Math.sign(i - h) * 3 / (Math.abs(i - h) + 1));

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // Extra horizontal/vertical spread of the fan offsets (NOT the card size) so the
  // cards sit a little less congested — applied consistently to rest AND hover.
  const SPREAD = 1.16;
  // Responsive: the captured values are at 20rem cards; scale offsets to the
  // actual rendered card width so the fan stays proportional on smaller screens.
  // paint() runs every frame while the springs settle, and offsetWidth FLUSHES
  // style+layout — a synchronous reflow of the whole document from an animation
  // loop. The card's layout width only changes on resize (it is set in rem/vw and
  // is explicitly independent of the transform), so measure it there instead and
  // read the cached value per frame.
  let _sf = 0;
  function measureSizeFactor() {
    const cw = (cards[0] && cards[0].offsetWidth) || 320; // layout width, ignores transform
    _sf = (cw / (20 * rem())) * SPREAD;
  }
  function sizeFactor() {
    if (!_sf) measureSizeFactor();
    return _sf;
  }

  // How far apart the cards sit AT REST. Applied to the resting x only — the hover
  // push (DX) is added on top untouched, so parting the fan around the hovered card
  // still moves exactly as far as the captured values say. Shrinking the cards left
  // the resting gaps looking too wide for them; this closes the spread back up
  // without touching the hover behaviour or the shared sizeFactor (which the hover
  // offsets ride through too).
  const REST_TIGHTEN = 0.90;
  function restX(i) { return REST[i].x * REST_TIGHTEN; }

  // ---- target pose (px, pre-sizeFactor) for the current hover state ----
  let hovered = -1;
  function targetOf(i) {
    const base = REST[i];
    if (hovered < 0) return { x: restX(i), y: base.y, r: base.r, s: base.s };
    if (i === hovered) return { x: restX(i), y: base.y - POP_LIFT, r: base.r, s: base.s * POP_SCALE };
    return { x: restX(i) + DX[hovered][i], y: base.y, r: base.r + drot(hovered, i), s: base.s };
  }

  // ---- hover spring (snappy, with bounce): underdamped spring to the target ----
  const STIFF = 320, DAMP = 21; // zeta ~0.59 (~10% overshoot), settle ~0.37s — snappy
  const cur = REST.map((p, i) => ({ x: restX(i), y: p.y, r: p.r, s: p.s }));
  const vel = REST.map(() => ({ x: 0, y: 0, r: 0, s: 0 }));

  // ---- reveal spring (the initial fan-out also BOUNCES): pCur springs 0<->1,
  // triggered when the section scrolls into view (a timed overshoot tween, like
  // the reference ScrollTrigger — not a scroll-scrub). p can overshoot past 1 so
  // the cards spring slightly past their fanned pose then settle = the fan bounce. */
  const PR_STIFF = 260, PR_DAMP = 20; // zeta ~0.62 (~9% overshoot), settle ~0.4s
  let pCur = reduce ? 1 : 0, pVel = 0, pT = reduce ? 1 : 0;

  function springStep(dt) {
    let moving = false;
    // reveal
    {
      const f = PR_STIFF * (pT - pCur) - PR_DAMP * pVel;
      pVel += f * dt; pCur += pVel * dt;
      if (Math.abs(pT - pCur) > 0.0005 || Math.abs(pVel) > 0.0005) moving = true;
    }
    // hover
    for (let i = 0; i < cur.length; i++) {
      const t = targetOf(i);
      for (const k of ["x", "y", "r", "s"]) {
        const f = STIFF * (t[k] - cur[i][k]) - DAMP * vel[i][k];
        vel[i][k] += f * dt;
        cur[i][k] += vel[i][k] * dt;
        if (Math.abs(t[k] - cur[i][k]) > 0.01 || Math.abs(vel[i][k]) > 0.01) moving = true;
      }
    }
    return moving;
  }

  // fan out once the card layout is ~85% up the viewport; fold back when it leaves
  // evalReveal runs on every scroll event; getBoundingClientRect there flushes
  // style+layout for the whole document. The layout block's DOCUMENT position is
  // static, so cache it and derive the viewport centre from scrollY.
  let _layTop = 0, _layH = 0;
  function measureLayout() {
    const r = layout.getBoundingClientRect();
    _layTop = r.top + (window.scrollY || window.pageYOffset || 0);
    _layH = r.height;
  }
  /* ---- Socials copy: type, then reel, then highlight -----------------------------
     Three beats, each on its own line of scroll:
       1. the HEADING ("Check Out" / "My Socials") types in, a beat EARLIER than the
          cards fan out, so the words are already being written as the spread starts;
       2. scrolling on, the FOLLOW line types;
       3. the moment that line finishes, the three social LINKS reel in from nothing —
          the same per-letter roll the nav does on load — and the blue highlight sweeps
          across "My Socials" and the follow line, left to right, like a text selection
          being dragged over them. Until then there is NO blue behind either line.
     Skipped on mobile and under reduced motion, where the fan does not run either:
     the two lines keep their plain CSS background and the links are simply there. */
  const HEAD_STEP = 32, FOLLOW_STEP = 18;
  const LINK_STEP = 32, LINK_ROLL = 420, LINK_EASE = "cubic-bezier(.19,1,.22,1)";
  const socialsInner = document.querySelector(".callout-socials-layout");
  const linksWrap = document.querySelector(".callout-socials-links-layout");
  const hlEls = [document.querySelector(".callout-socials-heading__line.is-hl"),
                 document.querySelector(".callout-socials-follow")].filter(Boolean);
  const staged = !reduce && !mq.matches && !!socialsInner;
  // Each typer hosts its OWN element, never a shared ancestor. `is-typing` on the host is
  // what hides the not-yet-typed letters, so with both on .callout-socials-layout the
  // heading's finish() stripped the class off the whole section and the follow line, still
  // waiting its turn, was simply revealed — it appeared instead of typing.
  const headEl = document.querySelector(".callout-socials-heading");
  const followEl = document.querySelector(".callout-socials-follow");
  // hold 120: the cursor travels with the heading while it types and is gone almost the
  // instant it stops. It used to sit there for the default beat and a bit — and once the
  // highlight swept "My Socials" the text (and so the cursor, which is currentColor) went
  // white, leaving a white block parked at the end of the line.
  const headType = !staged || !headEl ? null : makeTypeIn(headEl, [
    { el: headEl.querySelector(".callout-socials-heading__line:not(.is-hl)"), step: HEAD_STEP },
    { el: headEl.querySelector(".callout-socials-heading__line.is-hl"),       step: HEAD_STEP }
  ], { hold: 120 });
  // hold 120: no resting cursor here either — it clears almost as soon as the line
  // finishes, instead of parking a blinking block at the end of "…social media".
  const followType = !staged || !followEl ? null : makeTypeIn(followEl, [
    { el: followEl, step: FOLLOW_STEP }
  ], { hold: 120 });
  const linkCols = staged && linksWrap
    ? Array.from(linksWrap.querySelectorAll(".pill-char__col")) : [];
  if (staged) {
    // Background off until beat 3 — and applied with transitions MUTED. .hl-sweep carries
    // the sweep's own `color` transition, so adding it after the browser has painted the
    // line in its resting white animates that white → black flip. Below the fold nobody
    // sees it; arriving straight into the section (?go=socials from a sub-page) it played
    // in full view and the line typed itself out white before turning black.
    hlEls.forEach(function (el) { el.style.transition = "none"; el.classList.add("hl-sweep"); });
    void document.documentElement.offsetWidth;                       // commit it unanimated
    requestAnimationFrame(function () { hlEls.forEach(function (el) { el.style.transition = ""; }); });
    if (linkCols.length) linksWrap.classList.add("is-reeling");       // letters parked below their clips
  }
  // Beat 3. The links roll up staggered; the highlight rides across at the same time.
  // Handing the letters back to CSS is the delicate step: .pill-char__col carries the
  // hover reel's own transition, so dropping is-reeling while the animations are
  // cancelled would start a transition and reel every word a second time. Mute it,
  // drop class and animations together, commit, release a frame later.
  let lit = false;
  // The blue takes SWEEP_MS to cross a line, so flipping the whole line to white at one
  // moment leaves the tail of a wide sentence white on a still-unhighlighted background —
  // invisible until the wipe catches up. Each CHARACTER instead turns white as the edge
  // reaches it: the type-in already left every glyph as its own span, so the delay is just
  // where that glyph sits across the line.
  const SWEEP_MS = 750;                                        // matches the CSS sweep
  function highlight() {
    hlEls.forEach(function (el) {
      var chars = el.querySelectorAll(".wtype-c");
      if (chars.length) {
        var r = el.getBoundingClientRect();
        Array.prototype.forEach.call(chars, function (c) {
          var cr = c.getBoundingClientRect();
          var t = (cr.left + cr.width / 2 - r.left) / Math.max(1, r.width);
          c.style.transitionDelay = Math.max(0, Math.round(SWEEP_MS * t) - 40) + "ms";
        });
      }
      el.classList.add("is-lit");
    });
  }
  function lightUp() {
    if (lit) return;
    lit = true;
    highlight();                                              // the blue rides in WITH the links
    if (!linkCols.length) return;
    const anims = linkCols.map(function (c, i) {
      return c.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
                       { duration: LINK_ROLL, delay: i * LINK_STEP, easing: LINK_EASE, fill: "both" });
    });
    setTimeout(function () {
      linkCols.forEach(function (c) { c.style.transition = "none"; });
      linksWrap.classList.remove("is-reeling");
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      void linksWrap.offsetWidth;
      requestAnimationFrame(function () { linkCols.forEach(function (c) { c.style.transition = ""; }); });
    }, linkCols.length * LINK_STEP + LINK_ROLL + 60);
  }
  // Resized down to mobile before any of it ran → show the copy as it is.
  window.addEventListener("resize", function () {
    if (!mq.matches || lit) return;
    if (headType && !headType.ran()) headType.reveal();
    if (followType && !followType.ran()) followType.reveal();
    lightUp(); highlight();
  }, { passive: true });

  // Beat 2 + everything it drags with it, as one call: used both by the scroll threshold
  // and by an anchor JUMP, which never crosses that threshold gradually.
  function playFollow() {
    if (!followType || followType.ran()) return;
    followType.start();
    // A short beat after the line lands, the links roll in and the blue is dragged
    // across the two lines — together, one gesture.
    setTimeout(lightUp, followType.ms + 180);
  }
  // The whole section, played back to back — for arrivals that are not a scroll.
  // On an ARRIVAL both lines are triggered together — there is no scroll left to stage
  // them against, so waiting for the heading to finish just left the section looking
  // half-done. (Scrolling in still gets the two separate thresholds.)
  // Put every beat back to its "not yet played" state. Clicking the Socials link a
  // second time used to land on a section that had already run: the two type-ins latch on
  // started/done, `lit` latches, and the fan spring was already resting at 1 — so the jump
  // arrived at a finished section. Coming from a SUB-page never hit this, because that is
  // a fresh document with nothing played yet, which is why it only looked broken from the
  // homepage.
  function rearmStage() {
    if (!staged) return;
    lit = false;
    // Drop the highlight with its transition muted: removing .is-lit otherwise animates
    // the sweep BACKWARDS across the line before the replay can run it forwards.
    hlEls.forEach(function (el) {
      el.style.transition = "none";
      el.classList.remove("is-lit");
      Array.prototype.forEach.call(el.querySelectorAll(".wtype-c"), function (c) { c.style.transitionDelay = ""; });
    });
    void document.documentElement.offsetWidth;
    requestAnimationFrame(function () { hlEls.forEach(function (el) { el.style.transition = ""; }); });
    if (linkCols.length) linksWrap.classList.add("is-reeling");     // letters parked below their clips again
    if (headType) headType.rearm();
    if (followType) followType.rearm();
    pCur = 0; pVel = 0;                                             // fan folded, ready to spring out again
  }
  // replay=true → rewind first, so a click always plays the sequence instead of landing
  // on the finished state the last visit left behind.
  function playAll(replay) {
    if (reduce || mq.matches) return;
    if (replay) rearmStage();
    if (headType) headType.start();
    playFollow();
    pT = 1;
    kick();
  }
  window.__socialsPlay = playAll;

  let lastY = window.scrollY || window.pageYOffset || 0, firstEval = true;
  function evalReveal() {
    if (reduce) { pT = 1; return; }
    if (!_layH) measureLayout();
    const y = window.scrollY || window.pageYOffset || 0;
    const vh = window.innerHeight;
    // JUMPED in (the Socials button is a plain anchor, so it lands here in one step and
    // never crosses beat 2's line by scrolling): play the WHOLE sequence, heading first
    // and the follow line behind it, instead of leaving the section half-arrived until
    // the visitor happens to scroll further. Re-measure first — a jump usually means the
    // sections above just changed height (the projects pin sizes itself from JS), and a
    // stale document position would put the section nowhere near where it really is.
    const jumped = Math.abs(y - lastY) > vh * 0.5;
    lastY = y;
    if (jumped || firstEval) measureLayout();
    const center = (_layTop - y) + _layH / 2;
    const inView = center < vh * 1.02 && center > -_layH;
    // ARRIVED, rather than scrolled in. Two ways that happens: a jump from elsewhere on
    // the page, or the page LOADING already parked here — coming from a sub-page, whose
    // Socials link carries ?go=socials, the boot IIFE performs that scroll before this
    // section ever initialises, so its first reading shows no movement at all and only
    // the heading's line matches. Either way the whole sequence plays.
    const arrived = firstEval && inView;
    firstEval = false;
    if (inView && (jumped || arrived)) { playAll(); return; }
    if (headType && center < vh * 1.02) headType.start();       // a beat BEFORE the fan
    if (center < vh * 0.65) playFollow();                       // …and this one later, on its own line
    pT = center < vh * 0.85 ? 1 : 0;
  }

  function paint() {
    const p = pCur;
    const S = sizeFactor();
    for (let i = 0; i < cards.length; i++) {
      const c = cur[i];
      // arrival lerps stacked -> current spring pose; translations scale with S
      const x = (c.x * S) * p;
      const y = STACK_Y + (c.y * S - STACK_Y) * p;
      const rot = c.r * p;
      const s = 1 + (c.s - 1) * p;
      cards[i].style.transform =
        `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${s.toFixed(4)})`;
    }
  }

  function clearMobile() { cards.forEach((c, i) => { c.style.transform = ""; c.style.zIndex = origZ[i]; }); }

  // ---- frame loop (runs while the spring is settling) ----
  const origZ = cards.map((c) => c.style.zIndex || getComputedStyle(c).zIndex || "0");
  let raf = 0, last = 0;
  function frame(ts) {
    if (mq.matches) { clearMobile(); raf = 0; return; }
    const dt = Math.min(0.032, last ? (ts - last) / 1000 : 0.016);
    last = ts;
    const moving = springStep(dt);
    paint();
    raf = moving ? requestAnimationFrame(frame) : 0;
    if (!moving) last = 0;
  }
  function kick() { if (!raf && !mq.matches) { last = 0; raf = requestAnimationFrame(frame); } }

  function setHover(h) {
    if (mq.matches) return;
    hovered = h;
    // z-index is intentionally NOT changed on hover — the rest stacking
    // (1,2,3,10,3,2,1) holds throughout, exactly like the reference.
    kick();
  }

  // scroll re-evaluates the reveal trigger, then springs (fan-out/fold bounce)
  //
  // Gated on the section being anywhere near the viewport. This fired on every scroll
  // event for the WHOLE page — the socials fan sits thousands of pixels below the flow,
  // where there is nothing for it to evaluate and nothing on screen to animate. The
  // reveal is a pure function of scroll position, so re-entering the zone re-evaluates
  // it correctly; the observer also pokes it on each transition so the pose is right the
  // moment it matters.
  let nearView = true;
  let ticking = false;
  function onScroll() {
    if (!nearView || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (mq.matches) clearMobile();
      else { evalReveal(); kick(); }
      ticking = false;
    });
  }

  cards.forEach((c, i) => c.addEventListener("pointerenter", () => setHover(i)));
  // Leaving is NOT just leaving the layout box. The cards are absolutely positioned and
  // transformed inside it — fanned out, dipped and rotated — so the box holds plenty of
  // empty ground that belongs to no card, and the outermost cards hang past its edges.
  // Sliding off a card into that empty ground fired no leave at all and the fan stayed
  // parted. So while something IS hovered, any pointer move that is not over a card
  // clears it; the layout's own leave stays as the cheap common case.
  layout.addEventListener("pointerleave", () => setHover(-1));
  document.addEventListener("pointermove", (e) => {
    if (hovered < 0) return;                                   // nothing to clear → no work
    const t = e.target;
    if (!(t && t.closest && t.closest(".callout-socials-card-w"))) setHover(-1);
  }, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { measureSizeFactor(); measureLayout(); if (mq.matches) clearMobile(); else { evalReveal(); kick(); } });
  window.addEventListener("load", () => { measureSizeFactor(); measureLayout(); });
  // The projects terminal sets .features' height from JS (at the reveal, on resize and on
  // every filter click), which shifts this section's DOCUMENT position — re-measure and
  // re-evaluate the trigger, or the fan opens against a stale position.
  window.addEventListener("layoutshift", () => { measureLayout(); if (!mq.matches) { evalReveal(); kick(); } });
  if (window.__lenis && typeof window.__lenis.on === "function") window.__lenis.on("scroll", onScroll);
  if ("IntersectionObserver" in window) {
    const host = layout.closest("section") || layout;
    new IntersectionObserver((es) => {
      nearView = es[0].isIntersecting;
      if (nearView) onScroll();                    // settle the pose on the way in
    }, { rootMargin: "700px 0px 700px 0px" }).observe(host);
  }
  if (mq.matches) clearMobile(); else { evalReveal(); kick(); }
})();

/* ---------- Skills: logo cluster parallax around/with the Linux logo ----------
   The Linux logo AND the six small skill logos each drift UPWARD as the page
   scrolls, at their own data-speed. progress = 0 (everything at its base/current
   position) when the cluster centre crosses the viewport centre — i.e. roughly
   HALFWAY through the section's scroll — then they keep lifting past that point.
   3 logos are faster than Linux (data-speed > 0.14, z BEHIND it) and 3 are slower
   (< 0.14, z ON TOP), giving real depth. */
(function () {
  var stack = document.querySelector(".standards__logo-stack");
  if (!stack) return;
  // include the Linux main image — it parallaxes too (rests at mid-scroll).
  var imgs = Array.prototype.slice.call(stack.querySelectorAll("[data-speed]"));
  if (!imgs.length) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  if (reduce) return;                                  // leave them at their base positions
  var data = imgs.map(function (el) {
    return {
      el: el,
      speed: parseFloat(el.getAttribute("data-speed")) || 0.15,
      rot: parseFloat(el.getAttribute("data-rot")) || 0    // static tilt for an organic scatter
    };
  });
  var ticking = false;
  // Cached document geometry (see the other scroll loops).
  var stackTop = null, stackH = 0;
  function measureStack() {
    var q = stack.getBoundingClientRect();
    stackTop = q.top + (window.scrollY || window.pageYOffset || 0); stackH = q.height;
  }
  window.addEventListener("resize", measureStack, { passive: true });
  window.addEventListener("load", measureStack);
  // .features' JS-set height moves this stack in the document (see sizeSection).
  window.addEventListener("layoutshift", function () { measureStack(); onScroll(); });
  function render() {
    ticking = false;
    if (stackTop === null) measureStack();
    var r = { top: stackTop - (window.scrollY || window.pageYOffset || 0), height: stackH };
    var vh = window.innerHeight || document.documentElement.clientHeight;
    // progress in px: 0 when the cluster centre sits at the viewport centre (mid-
    // scroll), growing positive as it scrolls up past that line → each logo (Linux
    // included) lifts by progress*speed and keeps going.
    var progress = (vh * 0.5) - (r.top + r.height / 2);
    for (var i = 0; i < data.length; i++) {
      data[i].el.style.transform = "translateY(" + (-progress * data[i].speed).toFixed(1) + "px) rotate(" + data[i].rot + "deg)";
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(render); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  if (window.__lenis && typeof window.__lenis.on === "function") window.__lenis.on("scroll", onScroll);
  render();
})();

/* ============================================================
   QuickForge chat window — the messages image scrolls within a
   fixed "window" connected under the header bar. Scroll-driven &
   reversible: as the section scrolls up through the viewport, the
   feed pans so the window travels down through the messages.
   ============================================================ */
(function chatFeedScroll() {
  var win  = document.querySelector(".bt-chat__window");
  var feed = document.querySelector(".bt-chat__feed");
  if (!win || !feed) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  var ticking = false;

  // Three layout reads per scroll frame (offsetHeight + clientHeight + rect) for a
  // widget that is only on screen for one section. All three are static between
  // resizes, so they are measured once; the observer switches the handler off entirely
  // outside the section.
  var feedH = 0, winH = 0, winTop = null, near = true;
  function measureChat() {
    feedH = feed.offsetHeight; winH = win.clientHeight;
    winTop = win.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
  }
  window.addEventListener("resize", measureChat, { passive: true });
  window.addEventListener("load", measureChat);
  function render() {
    ticking = false;
    if (window.innerWidth <= 820) { feed.style.transform = ""; return; }
    if (!near) return;
    if (winTop === null) measureChat();
    var maxShift = feedH - winH;                             // travel room
    if (maxShift <= 0) { feed.style.transform = "translateY(0)"; return; }
    var r = { top: winTop - (window.scrollY || window.pageYOffset || 0) }, vh = window.innerHeight;
    // p: 0 when the window sits low in the viewport, 1 once it has risen near
    // the top — scrubs the feed up so we read down through the messages.
    var p = (vh * 1.0 - r.top) / (vh * 1.35);
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    feed.style.transform = "translateY(" + (-p * maxShift).toFixed(1) + "px)";
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(render); } }

  if (reduce) { render(); return; }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      near = es[0].isIntersecting;
      if (near) { measureChat(); onScroll(); }
    }, { rootMargin: "600px 0px 600px 0px" }).observe(win);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", render);
  if (window.__lenis && typeof window.__lenis.on === "function") window.__lenis.on("scroll", onScroll);
  if (feed.complete) render(); else feed.addEventListener("load", render);
  render();
})();

/* ---- Subscribe modal (2026-08-11) ---------------------------------------------
   Every [data-subscribe-open] button (header CTA, mobile nav, the "Get the next
   one" block at the foot of a post) opens the same <dialog> from the generated
   header partial. The email field inside it is Substack's embed iframe — a static
   site has no backend to accept a POST, so the handoff has to happen there.
   <dialog>.showModal() gives focus trapping, Esc-to-close and inertness for free;
   this only adds backdrop-click closing and pausing Lenis so the page behind the
   modal does not scroll. */
(function subscribeModal() {
  var dlg = document.getElementById("subscribe-modal");
  if (!dlg || typeof dlg.showModal !== "function") return;

  function open() {
    if (dlg.open) return;
    dlg.showModal();
    if (window.__lenis && typeof window.__lenis.stop === "function") window.__lenis.stop();
  }
  function close() {
    if (dlg.open) dlg.close();
  }

  document.addEventListener("click", function (e) {
    var opener = e.target.closest("[data-subscribe-open]");
    if (opener) {
      e.preventDefault();
      // The mobile menu sits above the dialog's backdrop; close it first.
      var panel = document.querySelector(".mobile-nav.is-open");
      if (panel) document.querySelector(".mobile-nav__close")?.click();
      open();
      return;
    }
    if (e.target.closest("[data-subscribe-close]")) close();
  });

  // Clicking the backdrop: the dialog element's own box is the panel, so a click
  // whose coordinates fall outside that rect landed on the backdrop.
  dlg.addEventListener("click", function (e) {
    var r = dlg.getBoundingClientRect();
    var out =
      e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (out) close();
  });

  dlg.addEventListener("close", function () {
    if (window.__lenis && typeof window.__lenis.start === "function") window.__lenis.start();
  });
})();

/* ---- Sub-page header pills (2026-08-11) --------------------------------------
   On the homepage the hero block builds the per-letter reel on both CTA pills as
   part of the zoom-out choreography. Sub-pages have no .hero, so that block never
   runs and the pills sat there as plain text — hovering them did nothing, which is
   what made the blog header feel unlike the homepage. Build the same structure
   here; the roll is CSS (.pill-btn:hover .pill-char__col), and there is no world
   flip to drive because sub-pages are always the light world. */
(function subpageHeaderPills() {
  if (document.querySelector(".hero")) return;   // homepage owns these
  var hdr = document.querySelector("header");
  if (!hdr) return;
  buildPillReel(hdr.querySelector(".pill-btn--glass"));
  buildPillReel(hdr.querySelector(".pill-btn--dark"));
})();

/* ---- Nav scale handed across a page hop (2026-08-13) --------------------------
   updateHeroExit shrinks the two nav groups to .88 once you scroll off the hero, as
   an inline transform with a .3s transition. That is homepage-only state living in
   one document, so arriving on a sub-page the nav is simply at scale 1 from its very
   first frame — there is nothing to animate FROM, and the size change reads as a snap.
   (Leaving a sub-page is fine: the homepage's own scroll handler drives the shrink.)
   So the outgoing scale is recorded on the way out and replayed on arrival: apply it
   instantly, then transition to 1 on the next frame, which is the expansion.
   RESTORE IS SUB-PAGE ONLY — deliberately. On the homepage updateHeroExit owns this
   transform and sets it from real scroll position every frame; touching it there would
   fight that, and the ask was to leave the leaving-the-blog direction alone. */
(function navScaleHandoff() {
  var KEY = "vj:nav-scale";
  var groups = [
    [document.querySelector(".header__nav-left"), "left center"],
    [document.querySelector(".header__nav-right"), "right center"]
  ].filter(function (g) { return g[0]; });
  if (!groups.length) return;

  function scaleOf(el) {
    var t = getComputedStyle(el).transform;
    if (!t || t === "none") return 1;
    var m = /matrix\(([^,]+),/.exec(t);            // matrix(a, b, c, d, e, f) → a is scaleX
    return m ? parseFloat(m[1]) || 1 : 1;
  }
  // Record on the way out. pagehide (not beforeunload) so it also fires when the page
  // goes into the back/forward cache.
  addEventListener("pagehide", function () {
    try { sessionStorage.setItem(KEY, String(scaleOf(groups[0][0]))); } catch (e) {}
  });

  if (document.querySelector(".hero")) return;     // homepage: updateHeroExit owns it
  var from = 1;
  try { from = parseFloat(sessionStorage.getItem(KEY)); } catch (e) {}
  // Consume it either way, so a later plain load does not replay a stale expansion.
  try { sessionStorage.removeItem(KEY); } catch (e) {}
  if (!(from > 0) || from > 0.999) return;         // arrived from an already-expanded nav

  groups.forEach(function (g) {
    g[0].style.transition = "none";
    g[0].style.transformOrigin = g[1];
    g[0].style.transform = "scale(" + from + ")";
  });
  // Two frames: the first commits the shrunk pose, the second starts the transition
  // (setting both in one frame would be coalesced into no animation at all).
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      groups.forEach(function (g) {
        g[0].style.transition = "transform .3s var(--ease-default)";   // matches updateHeroExit
        g[0].style.transform = "scale(1)";
      });
    });
  });
})();

/* ---- Nav WORLD handed across a page hop (2026-08-14) --------------------------
   Clicking Blog from the projects run leaves a header in the DARK world (white nav,
   inverted pills) and lands on a sub-page whose header is black from its very first
   frame — the white→black reel that the same crossing plays while scrolling never
   happens, so the colour just snaps. Same shape of problem as navScaleHandoff above,
   and the same shape of fix: record the outgoing world, and on arrival start in it
   and roll to the arriving one.

   The reel itself is the header's existing one — __navLight(true) rolls each nav
   letter up to its black __b copy with the usual left-to-right stagger, and
   `is-rolled` does the same inside the pills — so this only has to paint the dark
   world first and hand the CTA backgrounds their .5s colour ride. Sub-page only:
   the homepage drives its own world from scroll position every frame.

   "Was dark" is NOT read off the nav's colour alone: setHeaderTheme deliberately
   leaves the __a letters at their old colour while rolling to the light world, so a
   homepage header can be white-lettered in either world. It is white letters AND no
   header--on-light — which is also what keeps a sub-page → sub-page hop (black text,
   no class) from being mistaken for a dark-world exit. */
(function navWorldHandoff() {
  var KEY = "vj:nav-world";
  var hdr = document.querySelector("header");
  if (!hdr) return;
  var link = hdr.querySelector(".header__nav-left a");
  if (!link) return;

  function isLight(el) {                          // is this element's text a light colour?
    var m = /rgba?\(([^,]+),([^,]+),([^,)]+)/.exec(getComputedStyle(el).color);
    return m ? (+m[1] + +m[2] + +m[3]) / 3 >= 128 : false;
  }
  // The dark world is white letters AND no header--on-light: setHeaderTheme leaves __a at
  // its old colour while rolling to light, so colour alone cannot tell the worlds apart,
  // and the class alone would read a sub-page (black text, no class) as dark.
  function isDarkWorld() { return isLight(link) && !hdr.classList.contains("header--on-light"); }

  addEventListener("pagehide", function () {
    try { sessionStorage.setItem(KEY, isDarkWorld() ? "dark" : "light"); } catch (e) {}
  });

  var was = "light";
  try { was = sessionStorage.getItem(KEY) || "light"; } catch (e) {}
  try { sessionStorage.removeItem(KEY); } catch (e) {}   // consume, so a later plain load is clean
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.__navLight || window.__bootShown) return;  // the intro reel-in owns the header instead

  var links = Array.prototype.slice.call(hdr.querySelectorAll(".header__nav-left a"));
  var glass = hdr.querySelector(".header__ctas .pill-btn--glass");
  var dpill = hdr.querySelector(".header__ctas .pill-btn--dark");
  var pills = [glass, dpill].filter(Boolean);
  var spans = pills.map(function (p) { return p.querySelector(".pill-btn-span"); });
  // Every leaf the two reels transform. Their transitions are muted whenever a world is
  // PAINTED (it must appear instantly, with no reel of its own) and released again before
  // the roll that follows.
  var leaves = Array.prototype.slice.call(
    hdr.querySelectorAll(".header__nav-left a .nav-char__a,.header__nav-left a .nav-char__b," +
                         ".header__ctas .pill-char__a,.header__ctas .pill-char__b"));
  function mute(on) {
    var v = on ? "none" : "";
    leaves.forEach(function (el) { el.style.transition = v; });
    links.forEach(function (a) { a.style.transition = v; });
    pills.forEach(function (p) { p.style.transition = v; });
  }
  // Commit whatever was just painted, then run `then` — two frames, because setting the
  // start and end poses in one frame is coalesced into no animation at all.
  function commit(then) {
    void hdr.offsetWidth;
    requestAnimationFrame(function () { requestAnimationFrame(then); });
  }

  /* ---- Sub-page arrival: we left the projects run (dark) and landed on a page that is
     black from its first frame, so the white → black reel never played. Paint the dark
     world, then roll to light with the header's own reel. */
  if (!document.querySelector(".hero")) {
    if (was !== "dark") return;
    mute(true);
    links.forEach(function (a) { a.style.color = "#fcfcfc"; });   // matches setHeaderTheme's he = 1
    if (glass) glass.style.backgroundColor = "#050419";
    if (dpill) dpill.style.backgroundColor = "#d0e1eb";
    if (spans[0]) spans[0].style.color = "#fcfcfc";
    if (spans[1]) spans[1].style.color = "#050419";
    commit(function () {
      var t = "color .5s var(--ease-default),background-color .5s var(--ease-default)";
      mute(false);
      links.forEach(function (a) { a.style.transition = t; });
      pills.forEach(function (p) { p.style.transition = t; p.classList.add("is-rolled"); });
      if (glass) glass.style.backgroundColor = "#fcfcfc";
      if (dpill) dpill.style.backgroundColor = "#050419";
      window.__navLight(true, true);              // the nav's own reel (skipTheme: no homepage pills here)

      // Hand back to CSS once the reel has landed: mute, drop the classes and the inline
      // overrides, commit, release. Both worlds end on the same painted colours here, so
      // nothing moves — without the mute, dropping the classes would reel a second time.
      setTimeout(function () {
        mute(true);
        hdr.classList.remove("header--on-light");
        pills.forEach(function (p) { p.classList.remove("is-rolled"); p.style.backgroundColor = ""; });
        links.forEach(function (a) { a.style.color = ""; });
        spans.forEach(function (s) { if (s) s.style.color = ""; });
        void hdr.offsetWidth;
        requestAnimationFrame(function () { mute(false); });
      }, 1200);
    });
    return;
  }

  /* ---- Homepage arrival: the other direction. A sub-page's nav links carry ?go=<id>, so
     coming back to Projects lands the page deep in the DARK run in one jump — flow.js's
     reel thresholds never see the crossing (it scrolls past them in a single step) and the
     header is simply white on arrival. Once the jump has settled into the dark world, paint
     the light world we came from and roll DOWN to the white __a copy, which is the same
     reel that crossing plays when it is scrolled.
     __a is already white by then (the projects watcher ran __headerTheme(1, true)), so this
     only has to put the black __b copy in front of it and take it away again. */
  if (was !== "light") return;
  var tries = 0;
  (function settle() {
    if (tries++ > 14) return;                     // never went dark (landed at the top) → nothing to do
    if (!isDarkWorld()) { setTimeout(settle, 60); return; }
    mute(true);
    hdr.classList.add("header--on-light");        // black letters, instantly: the world we came from
    pills.forEach(function (p) { p.classList.add("is-rolled"); });
    if (glass) glass.style.backgroundColor = "#fcfcfc";
    if (dpill) dpill.style.backgroundColor = "#050419";
    commit(function () {
      mute(false);
      window.__navLight(false, true);             // roll down to the white __a — the dark world
      if (window.__headerTheme) window.__headerTheme(1, true);   // pills unroll + ride their bg across
      else pills.forEach(function (p) { p.classList.remove("is-rolled"); });
    });
  })();
})();

/* ---- Footer headline TYPE-IN (2026-08-14) -------------------------------------
   "Data in. / Products out." types itself in the same way the blog intro and the
   socials heading do, on the footer's own arrival — an IntersectionObserver here
   rather than a scroll threshold, because the footer is not pinned and has no
   state machine of its own to hang off. Runs on every page (the footer is shared),
   so the blog pages' variant of the headline types too.

   The highlighted word keeps its markup: makeTypeIn walks child nodes, so the
   .is-hl span survives with its letters inside it and simply types in its colour. */
(function footerHeadlineType() {
  var h = document.querySelector(".lfooter__headline");
  if (!h || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var rows = Array.prototype.slice.call(h.querySelectorAll(".lfooter__hl-row"));
  if (!rows.length) return;
  var HEAD_STEP = 45;

  // ONCE PER FOOTER, PER SESSION. The footer is shared by all ten pages, so without this
  // it replayed on every single navigation. There are exactly two headlines — the default
  // one and the blog pages' variant — and each earns its entrance once: the key is derived
  // from the headline's own text, so the two are tracked separately and no third can appear.
  // A visitor who bounces between home and a post sees it twice at most. Already seen →
  // return before anything is hidden, so the footer simply renders as plain markup.
  // An explicit RELOAD resets the whole set, not just this page's entry: refreshing the
  // homepage means the homepage footer types again AND the blog one does when you next
  // reach it. sessionStorage survives a refresh (it lives as long as the tab), so without
  // this a hard refresh could never show the entrance again. Back/forward and in-site
  // links do not reset anything.
  var PREFIX = "vj:footer-in:";
  var KEY = PREFIX + (rows[0].textContent || "").trim().toLowerCase().replace(/[^a-z]+/g, "-").slice(0, 32);
  var reloaded = (function () {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      if (nav) return nav.type === "reload";
      return !!(performance.navigation && performance.navigation.type === 1);
    } catch (e) { return false; }
  })();
  try {
    if (reloaded) {
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf(PREFIX) === 0) sessionStorage.removeItem(k);
      });
    } else if (sessionStorage.getItem(KEY) === "1") return;
  } catch (e) {}
  function markSeen() { try { sessionStorage.setItem(KEY, "1"); } catch (e) {} }
  // Spent when you LEAVE the page, even if the footer never came into view. Marking it
  // only when the entrance plays left a hole big enough to drive through: the homepage
  // footer is a long scroll away, so leaving before reaching it recorded nothing and the
  // entrance played again on the next visit — which is the "it runs every time" symptom.
  // pagehide (not beforeunload) so it also fires on the way into the back/forward cache.
  addEventListener("pagehide", markSeen);

  // No lingering cursor here — it clears shortly after the last letter (the only
  // resting cursor left on the page is the blog description's).
  var typer = makeTypeIn(h, rows.map(function (el) { return { el: el, step: HEAD_STEP }; }), { gap: 120, hold: 420 });
  if (!typer) return;

  // …and once it lands, the eight column links reel in from nothing. They already carry
  // the per-letter .lreel clips (footerLinkReel builds them for the hover roll, further
  // down this file — so the columns are only READ at reel time, not now), which means
  // this only has to park the letter columns below their clips and roll them up.
  var cols = document.querySelector(".lfooter__cols");
  var LETTER_STEP = 26, LINK_GAP = 72, LINK_ROLL = 560, EASE = "cubic-bezier(.19,1,.22,1)";
  // The column LABELS ("Pages" / "Follow On") wait for the links under them and simply
  // fade in once the reel is done; the "Email me" pill POPS in after it the way the
  // header CTAs do on load — shell first, its own letters reeling up inside it.
  if (cols) cols.classList.add("is-reeling", "labels-wait");
  var mail = document.querySelector(".lfooter__email");
  var mailCols = mail ? Array.prototype.slice.call(mail.querySelectorAll(".pill-char__col")) : [];
  if (mail) mail.classList.add("is-waiting", "is-reeling");
  function popEmail() {
    if (!mail) return;
    mail.classList.remove("is-waiting");
    // The pill is CENTRED with its own transform (translateX(-50%) in the bottom tab), so
    // a bare scale() keyframe would replace that and shove it to the right. Compose the
    // pop onto whatever transform it is already resting at.
    var base = getComputedStyle(mail).transform;
    if (base === "none") base = "";
    var anims = [mail.animate([{ opacity: 0, transform: (base + " scale(.94)").trim() },
                               { opacity: 1, transform: base || "none" }],
                              { duration: 420, easing: EASE, fill: "both" })];
    mailCols.forEach(function (c, i) {
      anims.push(c.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
                           { duration: LINK_ROLL, delay: 180 + i * LETTER_STEP, easing: EASE, fill: "both" }));
    });
    setTimeout(function () {
      mailCols.forEach(function (c) { c.style.transition = "none"; });
      mail.classList.remove("is-reeling");
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      void mail.offsetWidth;
      requestAnimationFrame(function () { mailCols.forEach(function (c) { c.style.transition = ""; }); });
    }, 180 + mailCols.length * LETTER_STEP + LINK_ROLL + 60);
  }
  function reelLinks() {
    if (!cols) return;
    var cs = Array.prototype.slice.call(cols.querySelectorAll(".lreel__col"));
    if (!cs.length) { cols.classList.remove("is-reeling", "labels-wait"); popEmail(); return; }
    // BOTTOM UP: the links arrive from the last row upward (both columns together,
    // since the two sit at the same heights), each one's letters still rolling up
    // left to right within it. Ordered by where they actually are on screen rather
    // than by DOM order, so the two columns interleave by row.
    var links = Array.prototype.slice.call(cols.querySelectorAll(".lfooter__navlink"))
      .map(function (a) { return { a: a, top: a.getBoundingClientRect().top }; })
      .sort(function (x, y) { return y.top - x.top; });
    var anims = [], last = 0;
    links.forEach(function (L, li) {
      Array.prototype.forEach.call(L.a.querySelectorAll(".lreel__col"), function (c, i) {
        var delay = li * LINK_GAP + i * LETTER_STEP;
        if (delay > last) last = delay;
        anims.push(c.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
                             { duration: LINK_ROLL, delay: delay, easing: EASE, fill: "both" }));
      });
    });
    // Same handoff as the other reels: .lreel__col carries the hover roll's own
    // transition, so dropping is-reeling while the animations are cancelled would
    // start a transition and reel all eight a second time.
    // The labels and the pill come in while the LAST links are still rolling, rather than
    // waiting for the reel to be completely over — the tail of the footer reads as one
    // movement instead of a pause and then two more things.
    setTimeout(function () {
      cols.classList.remove("labels-wait");                 // "Pages" / "Follow On" fade in
      popEmail();
    }, last + LINK_ROLL * 0.45);
    setTimeout(function () {
      cs.forEach(function (c) { c.style.transition = "none"; });
      cols.classList.remove("is-reeling");
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      void cols.offsetWidth;
      requestAnimationFrame(function () { cs.forEach(function (c) { c.style.transition = ""; }); });
    }, last + LINK_ROLL + 60);
  }
  function play() { markSeen(); typer.start(); setTimeout(reelLinks, typer.ms + 140); }
  if (!("IntersectionObserver" in window)) { typer.reveal(); reelLinks(); return; }   // popEmail rides along
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.disconnect();
      play();
    });
  }, { rootMargin: "0px 0px -15% 0px", threshold: 0.2 });
  io.observe(h);
})();

/* ---- Socials button plays the section (2026-08-14) ----------------------------
   #socials is a plain anchor: it lands in the middle of the section in one step, so the
   scroll thresholds that stage the copy are never crossed one at a time and the section
   sat there half-arrived. socialsFan exposes __socialsPlay for exactly this — the click
   still jumps natively, and the sequence is kicked off on the frame after it lands. */
(function socialsClickPlays() {
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href$="#socials"]') : null;
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var href = a.getAttribute("href") || "";
    if (href.charAt(0) !== "#" && href !== location.pathname + "#socials") return;   // other document
    var sec = document.getElementById("socials");
    if (sec) {
      // CENTRE the section in the viewport, matching the ?go=socials arrival (see
      // centreDelta in the boot IIFE): the spare height is split evenly above and below,
      // so the framing does not depend on how tall the browser window is. Still a JUMP,
      // never an animated scroll: travelling there would cross the projects pin, whose
      // stick grabs any crossing that arrives by scrolling.
      e.preventDefault();
      var r = sec.getBoundingClientRect();
      var y = Math.max(0, r.top - (window.innerHeight - r.height) / 2 + (window.scrollY || 0));
      if (window.__lenis && window.__lenis.scrollTo) window.__lenis.scrollTo(y, { immediate: true, force: true });
      window.scrollTo(0, y);
      if (history.replaceState) { try { history.replaceState(null, "", "#socials"); } catch (err) {} }
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (window.__socialsPlay) window.__socialsPlay(true); });
    });
  });
})();

/* ---- Contact goes to the BOTTOM of the page (2026-08-14) -----------------------
   #contact is the footer's own id, so the browser's native jump parks the footer's TOP
   at the top of the viewport — which leaves the email pill and the legal row below the
   fold and reads as landing just short. Same-document Contact links are intercepted and
   taken to the end of the document instead, smoothly and through Lenis where it is
   running. Cross-document Contact links are left alone: they carry ?go=contact and are
   handled on arrival by applyHash, which lands at the same place. */
(function contactToBottom() {
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href$="#contact"]') : null;
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var href = a.getAttribute("href") || "";
    if (href.charAt(0) !== "#" && href !== location.pathname + "#contact") return;  // other document
    if (!document.getElementById("contact")) return;
    e.preventDefault();
    var y = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    // JUMP, exactly as the native anchor did — do NOT animate the way there. A smooth
    // scroll travels THROUGH the pinned projects terminal, and engageStick() grabs any
    // crossing that arrives by scrolling: the page locks at projects for the stick and
    // the click never reaches the footer. A single step lands past the pin's threshold
    // by more than a viewport, which is exactly how that check tells a jump from a scroll.
    if (window.__lenis && window.__lenis.scrollTo) window.__lenis.scrollTo(y, { immediate: true, force: true });
    window.scrollTo(0, y);                       // also move the real scroller, in case Lenis is absent
    if (history.replaceState) { try { history.replaceState(null, "", "#contact"); } catch (err) {} }
  });
})();

/* ---- Post action rail (2026-08-11) --------------------------------------------
   Back is a plain link. Like is stored in localStorage and is per-browser only:
   this site is static, so there is nowhere to keep a shared count — showing a
   number would mean inventing one. Share uses the Web Share sheet where the
   browser has one (mobile, Safari) and falls back to copying the URL. */
(function postRail() {
  var rail = document.querySelector(".post-rail");
  if (!rail) return;

  var like = rail.querySelector("[data-like]");
  if (like) {
    var key = "liked:" + location.pathname;
    try {
      if (localStorage.getItem(key) === "1") like.setAttribute("aria-pressed", "true");
    } catch (e) {}
    like.addEventListener("click", function () {
      var on = like.getAttribute("aria-pressed") !== "true";
      like.setAttribute("aria-pressed", on ? "true" : "false");
      try { on ? localStorage.setItem(key, "1") : localStorage.removeItem(key); } catch (e) {}
    });
  }

  // The rail's share button opens a small grid of the same targets that sit under
  // the byline — cloned from that row rather than duplicated in markup, so the two
  // can never disagree — plus a copy-link item. navigator.share is not used: the
  // rail is desktop-only (hidden under 1200px) and desktop browsers largely have
  // no share sheet.
  var share = rail.querySelector("[data-share]");
  var toast = rail.querySelector("[data-share-toast]");
  var row = document.querySelector(".share-row");
  var pop = null;

  function flash(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { toast.hidden = true; }, 1800);
  }

  function buildPop() {
    pop = document.createElement("div");
    pop.className = "post-rail__pop";
    pop.hidden = true;
    if (row) {
      Array.prototype.forEach.call(row.querySelectorAll(".share-btn"), function (a) {
        var c = a.cloneNode(true);
        c.className = "post-rail__pop-btn";
        // Choosing a target closes the panel. The outside-click handler below cannot do
        // it — these live INSIDE the rail — and they open in a new tab, so the page never
        // navigates away either; the panel just sat there open over the article.
        c.addEventListener("click", close);
        pop.appendChild(c);
      });
    }
    var copy = document.createElement("button");
    copy.type = "button";
    copy.className = "post-rail__pop-btn";
    copy.setAttribute("aria-label", "Copy link");
    copy.title = "Copy link";
    copy.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
    copy.addEventListener("click", function () {
      var url = share.getAttribute("data-share");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { flash("Link copied"); }, function () { flash(url); });
      } else {
        flash(url);
      }
      close();
    });
    pop.appendChild(copy);
    rail.appendChild(pop);
  }

  function open() {
    if (!pop) buildPop();
    pop.hidden = false;
    share.setAttribute("aria-expanded", "true");
  }
  function close() {
    if (pop) pop.hidden = true;
    share.setAttribute("aria-expanded", "false");
  }

  if (share) {
    share.setAttribute("aria-expanded", "false");
    // Toggle. No stopPropagation: the document handler below decides for itself whether
    // a click concerns it, which is sturdier than relying on this one click never
    // reaching it. (Anything else on the page calling stopPropagation on the way up
    // would silently disable the outside-click close under the old arrangement.)
    share.addEventListener("click", function (e) {
      e.preventDefault();
      if (pop && !pop.hidden) close(); else open();
    });
    document.addEventListener("click", function (e) {
      if (!pop || pop.hidden) return;
      if (share.contains(e.target)) return;   // the toggle handles its own click
      if (pop.contains(e.target)) return;     // a share target closes via its own handler
      close();                                // anywhere else dismisses the panel
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }
})();

/* ---- Footer link reel (2026-08-12) --------------------------------------------
   Same idea as buildPillReel, with its own classes: each letter becomes a clip
   holding the live copy and a sky-blue copy waiting underneath, and CSS rolls the
   column up on hover. Built in JS because the alternative is eight hand-written
   links of per-letter markup in partials/footer.html. */
(function footerLinkReel() {
  var links = document.querySelectorAll(".lfooter__navlink");
  if (!links.length) return;
  var STEP = 0.022;   // per-letter stagger, left to right

  Array.prototype.forEach.call(links, function (a) {
    if (a.querySelector(".lreel")) return;          // already built
    var txt = a.textContent.trim();
    if (!txt) return;
    a.setAttribute("aria-label", txt);
    a.textContent = "";
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      var clip = document.createElement("span");
      clip.className = "lreel";
      clip.setAttribute("aria-hidden", "true");
      var col = document.createElement("span");
      col.className = "lreel__col";
      col.style.setProperty("--rd", (i * STEP).toFixed(3) + "s");
      var top = document.createElement("span");
      top.className = "lreel__a";
      top.textContent = ch;
      var bot = document.createElement("span");
      bot.className = "lreel__b";
      bot.textContent = ch;
      col.appendChild(top);
      col.appendChild(bot);
      clip.appendChild(col);
      a.appendChild(clip);
    }
  });
})();

/* ---- Rail hands off to the footer (2026-08-12) --------------------------------
   The fixed rail would otherwise sit on top of the footer. Once the footer's top
   comes within a margin of the rail's bottom, the rail stops holding its fixed
   position and rides up 1:1 with the scroll — the overlap is applied as a
   translate, so it leaves with the page instead of vanishing abruptly. */
(function railFooterHandoff() {
  var rail = document.querySelector(".post-rail");
  var footer = document.querySelector(".lfooter");
  if (!rail || !footer) return;
  var GAP = 24;        // release this far before the footer edge
  var FADE = 90;       // travel over which it fades out
  var ticking = false;

  // This only has anything to say when the footer is close enough to push the rail.
  // Ungated it ran two getBoundingClientRect calls on every scroll frame for the whole
  // page — including the flow section, thousands of pixels away. An IntersectionObserver
  // on the footer turns it off outside that zone; the correct pose out there is simply
  // "unshifted", which is applied once on the way out.
  var footerNear = true;
  function resetRail() {
    if (parseFloat(rail.dataset.shift || "0") !== 0) {
      rail.dataset.shift = "0";
      rail.style.transform = ""; rail.style.opacity = ""; rail.style.pointerEvents = "";
    }
  }
  function update() {
    ticking = false;
    if (!footerNear) { resetRail(); return; }
    var r = rail.getBoundingClientRect();
    // Measured against the untranslated position, so the maths can't compound.
    var current = parseFloat(rail.dataset.shift || "0");
    var bottom = r.bottom + -current;
    var over = footer.getBoundingClientRect().top - (bottom + GAP);
    var shift = over < 0 ? over : 0;
    if (shift !== current) {
      rail.dataset.shift = String(shift);
      rail.style.transform = shift ? "translateY(" + shift + "px)" : "";
      rail.style.opacity = shift ? String(Math.max(0, 1 + shift / FADE)) : "";
      rail.style.pointerEvents = shift < -FADE ? "none" : "";
    }
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  if (window.__lenis && typeof window.__lenis.on === "function") window.__lenis.on("scroll", onScroll);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      footerNear = es[0].isIntersecting;
      onScroll();                                   // settle the pose on either transition
    }, { rootMargin: "600px 0px 600px 0px" }).observe(footer);
  }
  update();
})();
