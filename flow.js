/* ============================================================
   Flow — three.js parallax journey (rewritten 2026-06-16)
   The flow section is a horizontal, scroll-driven journey of four
   stages. Vertical scroll inside the 500vh section translates a
   sticky horizontal track; a transparent three.js canvas renders
   the 3D depth scene (a focal form per stage + an indigo particle
   field) that parallaxes as the camera dollies along the journey.
   DOM carries the crisp content (titles, cards) and the wavy
   journey spine pinned at the bottom.
   Vanilla JS. Loaded with defer; no-ops on pages without .flow.
   ============================================================ */
(function () {
  "use strict";

  var flow = document.querySelector(".flow");
  if (!flow) return;

  var isMobile = window.matchMedia("(max-width: 820px)").matches;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DEBUG = /[?&]debug/.test(location.search);   // ?debug → on-screen GL diagnostics
  var dbg = null;

  var wrapper = flow.querySelector(".flow__wrapper");
  var track = flow.querySelector(".flow__track");
  var sky = flow.querySelector(".flow__sky");
  var panels = Array.prototype.slice.call(flow.querySelectorAll(".flow-panel"));
  var journey = flow.querySelector(".flow-journey");
  var nodeEls = Array.prototype.slice.call(flow.querySelectorAll(".flow-journey__node"));
  var lineEl = flow.querySelector(".flow-journey__line");
  var fillEl = flow.querySelector(".flow-journey__fill");
  var nodesEl = flow.querySelector(".flow-journey__nodes");
  var hdr = document.querySelector("header");   // top nav flips to black at the bg threshold
  var N = panels.length || 4;

  // Terminal — a rolling shell pinned top-left of the flow section. Row 0 (`cd
  // highlights`) types as the section scrolls INTO place, then commits when it pins.
  // Below it sits ONE `cat domain N` line PER ZONE: crossing a threshold rolls the
  // stack up and the fresh (active) line starts typing toward its target; the active
  // line morphs direction-aware + dynamically paced (see the engine below), and
  // reversing back across a threshold un-spawns it and re-activates the previous one.
  var CD_HOME = "~/portfolio-website", CD_DIR = "~/portfolio-website/highlights";
  var CD_CERTS = "~/portfolio-website/certificates";   // cwd the header command is typed from (came from `cd certificates`)
  var CD_BLOGS  = "~/portfolio-website/blogs";              // landing prompt dir after the blog handover
  var LINE_LEAD  = "cd certificates";                   // lead-in row: typed from home across the video zoom-out
  var LINE_CD    = "cd ../highlights && cat scraping";  // header row: typed from ~/certificates across the flow approach
  var LINE_REV   = "cd highlights && cat scraping";     // reverse morph target (from home): `cd certificates` ↔ this on scroll up/down
  var LINE_UP    = "cd ..";                             // last zone types this (done as the zone-4 cards fly out)
  var LINE_BLOG  = "cd blogs";                          // flow→blog: enter the blog dir (spawned when the cards fly out)
  // Two back-strings — the `../` differs by the line's prompt/cwd, exactly like the hero side
  // (LINE_REV `cd highlights…` from home vs LINE_CD `cd ../highlights…` from ~/certificates):
  var LINE_BLOG_BACK_PRE  = "cd highlights && cat rest-apis";    // PRE-commit morph of `cd blogs` (its prompt is ~/portfolio-website$ → no `../`)
  var LINE_BLOG_BACK_POST = "cd ../highlights && cat rest-apis"; // POST-commit reverse, typed INTO the blogs$ line (~/…/blogs$ → needs `../`)
  var cdStack = flow.querySelector(".flow__cd-stack");
  var flowCd = flow.querySelector(".flow__cd");   // CLI wrapper — carries the scroll-darkened colour vars
  var writingEl = document.getElementById("blog"); // the writing/blog section — drives the exit approach

  /* ---------- Geometry cache ----------
     getBoundingClientRect / clientWidth / offsetHeight FLUSH style+layout. Called from
     the per-frame loop they force a synchronous reflow of a ~17,000px document, which
     measured at 10-17ms/frame — several times the cost of everything this loop actually
     computes. None of the geometry they read changes while scrolling: a section's
     position in the DOCUMENT and its size are functions of layout, not of scroll.
     So measure once, then derive the viewport rect as (documentTop - scrollY).
     window.scrollY does not flush layout, so the per-frame path becomes read-free.
     Re-measured on resize (and after load, when fonts/images can still shift things). */
  var geo = { flowTop: 0, flowH: 0, wrTop: 0, wrH: 0, jw: 0 };
  function measureGeo() {
    var sy = window.scrollY || window.pageYOffset || 0;
    var r = flow.getBoundingClientRect();
    geo.flowTop = r.top + sy;
    geo.flowH = r.height;
    if (writingEl) {
      var w = writingEl.getBoundingClientRect();
      geo.wrTop = w.top + sy; geo.wrH = w.height;
    }
    geo.jw = (journey && journey.clientWidth) || window.innerWidth;
  }
  function scrollNow() { return window.scrollY || window.pageYOffset || 0; }
  // Same shape as a DOMRect for the properties this file reads (top/bottom/height).
  function flowRect() {
    var t = geo.flowTop - scrollNow();
    return { top: t, bottom: t + geo.flowH, height: geo.flowH };
  }
  function writingRect() {
    if (!writingEl) return null;
    var t = geo.wrTop - scrollNow();
    return { top: t, bottom: t + geo.wrH, height: geo.wrH };
  }
  // The stack is an APPEND-ONLY terminal log, like a real shell: the `cd highlights`
  // row is committed first, then every zone threshold crossed — forward OR backward —
  // appends a NEW `cat domain N` row UNDER the last one and the whole stack scrolls up.
  // Scrolling back never rolls the stack back down; it just prints the next line below.
  function makeRow(path) {
    var row = document.createElement("p"); row.className = "flow__cd-row flow__cd-row--pending";
    row.innerHTML = '<span class="b-usr">vishnu@portfolio</span>:<span class="b-path">' + path +
      '</span>$&nbsp;<span class="flow__cd-cmd"></span><span class="flow__cd-caret"></span>';
    if (cdStack) cdStack.appendChild(row);
    return { row: row, cmd: row.querySelector(".flow__cd-cmd") };
  }
  var leadRow = cdStack ? makeRow(CD_HOME) : null;  // row -1: `~$ cd certificates` — the lead-in (types over the zoom-out)
  var cdHead = cdStack ? makeRow(CD_CERTS) : null;  // row 0: `~/certificates$ cd ../highlights && cat scraping`
  if (cdHead) cdHead.row.style.display = "none";    // header stays hidden until the lead-in finishes
  var domLines = [];                                 // appended command rows, oldest→newest (append-only log)
  function renderStack() {                            // newest row = cur, one above = prev, rest = past; scroll up
    var rows = [leadRow];
    if (cdHead && cdHead.row.style.display !== "none") rows.push(cdHead);
    for (var d = 0; d < domLines.length; d++) if (domLines[d].row.style.display !== "none") rows.push(domLines[d]);
    for (var r = 0; r < rows.length; r++) {
      var cls = "flow__cd-row";
      cls += r === rows.length - 1 ? " flow__cd-row--cur"
           : r === rows.length - 2 ? " flow__cd-row--prev" : " flow__cd-row--past";
      if (rows[r].zone >= 2) cls += " flow__cd-row--dark";   // zones 3-4 (light bg) type in black
      rows[r].row.className = cls;
    }
    var lh = cdLineH || cdLineHeight();
    if (cdStack) cdStack.style.transform = "translateY(" + (-Math.max(0, rows.length - 2) * lh).toFixed(1) + "px)";
  }
  var cdLineH = 0;
  function cdLineHeight() { return (cdLineH = cdHead ? (cdHead.row.offsetHeight || cdLineH) : 0); }

  // The terminal is ONE element. Reparent it to <body> so, when it rides in the video zoom-out
  // region, it clears the fixed hero video's stacking (z-index). Then position it MANUALLY every
  // frame across all phases — parked bottom-left → ride up → pinned at rest → scroll away at the
  // flow end — instead of relying on the sticky wrapper, so the same element covers the whole
  // journey (no second terminal, no handoff). Desktop only; on mobile the CSS keeps it hidden.
  var cdEl = flow.querySelector(".flow__cd");
  if (cdEl && cdEl.parentNode) document.body.appendChild(cdEl);
  var termREST = 98;                                    // resting screen top = header height + 18px
  function computeRest() { var h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")); termREST = (h || 80) + 18; }
  computeRest();
  window.addEventListener("resize", computeRest);
  var lastCdTop = null;
  var termH = 0;   // last measured CLI height (read in the ride phase, reused for the exit slide)
  var lastCdZ = null;
  function positionTerminal(rect) {
    if (!cdEl) return;
    var vhh = window.innerHeight;
    if (window.innerWidth <= 820) { cdEl.style.position = ""; cdEl.style.top = ""; cdEl.style.transform = ""; cdEl.style.opacity = ""; lastCdTop = null; return; }
    cdEl.style.position = "fixed";
    // z-index stays LOW (1) through hero/ride/pin so the CLI sits UNDER the hero video (hidden
    // until the zoom-out reveals it); it's only lifted above the blog panel during the exit slide.
    var wantZ = "1";
    var top;
    if (rect.top > 0) {
      // Ride from the park spot up to the resting top-left over the approach window, in
      // lockstep with the hero video + marquee handover but ARRIVING at the pin: rideP is
      // 0 at the marquee-lift start (rect.top = vh ⟺ ye = 2vh, so it begins moving with
      // them — no delay) and 1 at the pin (rect.top = 0). Keyed to rect.top — the SAME
      // clock as the header typing (approachP) and the card reveal (inPlace) — so the CLI
      // lands top-left EXACTLY as the header finishes typing and the cards fly in.
      // offsetHeight is read ONLY in this phase (the stack is still growing as rows type
      // in); during the pin top is a constant, so the forced layout read is skipped there.
      var parkTop = vhh - (termH = cdEl.offsetHeight) - Math.max(vhh * 0.06, 40);
      var rideP = clamp((vhh - rect.top) / vhh, 0, 1);
      top = parkTop - rideP * (parkTop - termREST);      // parked bottom-left → ride up, reaching rest at the pin
    }
    else if (rect.bottom >= vhh)  top = termREST;                                   // pinned through the flow section
    else {
      // Flow ending — the blog/writing section rises to cover the page. Hold the CLI pinned
      // at rest until the blog covers 79% of the viewport (its top passes 21% down), then
      // move it up 1:1 WITH the blog's rise — the same speed as the section itself — so it
      // reads as attached to the blog, sliding away as it takes the full page. It's never
      // covered (its z-index sits above the blog panel while sliding).
      var wr0 = writingRect();
      if (wr0) {
        var slideStart = vhh * 0.21;                       // blog top at 21% down ⟺ blog covers 79%
        if (wr0.top < slideStart) {
          top = termREST - (slideStart - wr0.top);         // 1:1 with the blog's rise → same speed
          wantZ = "4";                                     // lift above the blog panel while sliding out
        } else {
          top = termREST;
        }
      } else {
        top = termREST - (vhh - rect.bottom);
      }
    }
    // Same reason as the journey nodes: `top` is a layout property and this runs every
    // frame. The CSS base is top:calc(var(--header-height) + 18px), which is exactly
    // termREST, so offsetting from it by transform lands in the identical place while
    // invalidating nothing. (At the pin, top === termREST → translateY(0).)
    var ts = (top - termREST).toFixed(1);
    if (ts !== lastCdTop) { lastCdTop = ts; cdEl.style.transform = "translateY(" + ts + "px)"; }
    if (wantZ !== lastCdZ) { lastCdZ = wantZ; cdEl.style.zIndex = wantZ; }
    // No fade-in — the CLI is fully visible as soon as it's positioned (it now sits UNDER the
    // video in z-index, so the video zoom-out reveals it rather than it fading up over the top).
    cdEl.style.opacity = "1";
  }

  /* ---------- Domain lines — rolling stack, direction-aware, dynamically paced ------
     The ACTIVE zone z (= round(global)) owns the bottom line; committed zones behind
     it show their forward value, zones ahead are empty, and the stack rolls up so the
     active line + the one above stay in view. Each zone has a FORWARD target (its next
     domain, z+2) and a BACKWARD target (its previous domain, z; zone 0 → nothing).
     Whenever the active zone or the scroll direction changes, the active line RE-ANCHORS
     and starts typing toward the matching target, dynamically paced over the scroll
     REMAINING to the threshold it's heading to (exit when forward, entry when back) —
     so reversing near a threshold has little scroll left and types faster. Crossing a
     threshold forward starts a fresh empty line typing the next command; crossing back
     un-spawns it (the zone ahead is empty) and re-activates the previous, committed line. */
  // The 4 highlight domains are numbered 1..4 and rendered as `cat <word>`. The terminal
  // is already `cd`'d into scraping (domain 1 = the highlights we're on), so the FORWARD
  // reveal starts at domain 2 (etl-ml) — see domFwdTarget (z+2). Keeping the NUMBER-based
  // direction-aware logic from main means each zone knows its forward target (z+2) and
  // backward target (z), so reversing untypes and retypes the correct neighbour with a
  // MINIMAL edit — just more untyping than before, since the words share only `cat ` and
  // then diverge (unlike the old single-digit `cat domain N`).
  var DOMAIN_WORDS = { 1: "scraping", 2: "etl-ml", 3: "infra-ops", 4: "rest-apis" };
  var DOM_PER_CHAR = 0.06;   // global-scroll units per char for the reversal correction (min pace)
  var domFrom = "", domTarget = "", domBoundary = 0, domBack = 0, domFwd = 0;
  var domDisp = "", domActiveZ = -1, domDirState = 1, domStartG = 0, domEndG = 0, domLastG = null, domDir = 1;
  function domainStr(num) { return num >= 1 ? "cat " + (DOMAIN_WORDS[num] || ("domain " + num)) : ""; }
  function domFwdTarget(z) { return domainStr(clamp(z + 2, 0, N)); }   // a zone's forward / committed value
  // Direction-aware target for a zone. Boundary zones only "run" a command toward the
  // INTERIOR: first zone types on forward scroll only (empty arriving back out the top),
  // last zone on backward only (empty arriving forward out the bottom); reversing in
  // either untypes. Interior zones type their forward domain (z+2) going down, their
  // backward domain (z) going up — so reversing re-types the correct neighbour.
  function dirTarget(z, dir) {
    if (z === 0)     return dir >= 0 ? domFwdTarget(0) : "cd ..";   // back out of highlights on the way up
    // Last zone (mirror of zone 0): forward types `cd ..` (leave highlights) held until the
    // zone centre then over the second half; backward re-types its own domain (`cat infra`),
    // so scrolling back up through it counts the domains down like every interior zone.
    if (z === N - 1) return dir >= 0 ? LINE_UP : domainStr(z);
    return dir >= 0 ? domFwdTarget(z) : domainStr(clamp(z, 0, N));
  }
  // Set up a from→target morph as a MINIMAL edit: keep the longest common prefix,
  // untype only the chars that diverge, then type the rest. So `cat doma` → `cat
  // domain 1` just keeps typing `in 1` (no untyping), and `cat domain 3` → `cat
  // domain 1` untypes only `3`. Untype happens solely when it's absolutely necessary.
  function setSwap(from, target) {
    domFrom = from; domTarget = target;
    var m = Math.min(from.length, target.length), lcp = 0;
    while (lcp < m && from.charCodeAt(lcp) === target.charCodeAt(lcp)) lcp++;
    domBoundary = lcp;
    domBack = from.length - domBoundary;            // chars to untype off `from`
    domFwd = target.length - domBoundary;           // chars to type on for `target`
  }
  // Text for progress s (0..1): first untype `domBack` chars off `from`, then type
  // `domFwd` chars of `target` — the shared prefix is common to both, so it's seamless.
  function domainText(s) {
    var total = domBack + domFwd;
    if (total === 0) return domTarget;
    var k = Math.round(clamp(s, 0, 1) * total);
    return k <= domBack ? domFrom.slice(0, domFrom.length - k)
                        : domTarget.slice(0, domBoundary + (k - domBack));
  }
  // ONE append-only stack, ONE element (moved to <body> and positioned manually below), NO
  // separate hero terminal and NO handoff: the lead row types `cd certificates` from home across
  // the video zoom-out; when that finishes the header row appears and types `cd ../highlights &&
  // cat scraping` across the flow approach; then the zone engine appends `cat <domain>` lines.
  var started = false;
  // Reversal (restored): once the section has been pinned, scrolling back UP out of the pin
  // appends a fresh `cd certificates` line UNDER the last (`cd ..`) and types it as you go up; if
  // you reverse DOWN it minimal-edit-morphs `cd certificates` → `cd highlights && cat scraping`
  // (keeping the shared `cd ` prefix). A LOCAL swap so it never touches the zone engine globals.
  var apDir = 1, apLastP = null, apStartP = 0, certLine = null;
  // Re-lead: a FRESH `cd certificates` line popped when the return trip crosses the line
  // where the video/marquee/CLI start moving up (heroPB leaving 1) — see driveTerminal.
  var apPrevHeroPB = null, leadLine = null;
  var certFrom = "", certTarget = "", certBoundary = 0, certBack = 0, certFwd = 0;
  var certDisp = "", certDir = 0, certAnchorPP = 0, certEndPP = 1;
  function certSet(from, target) {
    certFrom = from; certTarget = target;
    var m = Math.min(from.length, target.length), lcp = 0;
    while (lcp < m && from.charCodeAt(lcp) === target.charCodeAt(lcp)) lcp++;
    certBoundary = lcp; certBack = from.length - lcp; certFwd = target.length - lcp;
  }
  function certText(s) {
    var total = certBack + certFwd;
    if (total === 0) return certTarget;
    var k = Math.round(clamp(s, 0, 1) * total);
    return k <= certBack ? certFrom.slice(0, certFrom.length - k)
                         : certTarget.slice(0, certBoundary + (k - certBack));
  }
  function commitCert() {                          // freeze the reversal line into the append-only log
    if (certLine) certLine.cmd.textContent = LINE_REV;
    certLine = null; certDir = 0; certDisp = "";
  }
  function freezeCert() {                           // freeze the reversal line AS-IS (whatever it currently shows)
    if (certLine) certLine.cmd.textContent = certDisp || LINE_LEAD;
    certLine = null; certDir = 0; certDisp = "";
  }

  // inPlace = section pinned; approachP = header typing progress (0..1); gg = globalRaw;
  // heroPB = video zoom-out progress (0..1) driving the lead-in row.
  function driveTerminal(inPlace, approachP, gg, heroPB) {
    if (!cdStack || !cdHead || !leadRow) return;
    if (!inPlace) {                                 // pre-pin OR scrolled back up out of the pin
      if (apLastP === null) apLastP = approachP;
      if (approachP > apLastP + 1e-5) apDir = 1;        // scrolling down toward the pin
      else if (approachP < apLastP - 1e-5) apDir = -1;  // scrolling up toward the certs
      apLastP = approachP;
      if (!started) {                               // FIRST approach: lead-in + header typing
        // Sync the `cd certificates` typing to the handwritten cert WRITE (main.js __certWrite),
        // NOT raw scroll: before the threshold it tracks the scroll zoom (heroPB, clamped at the
        // threshold); once crossed, the TIMED completion (cw.t) carries it the rest of the way, so
        // the last letter lands the exact moment the handwritten word auto-completes and POPS.
        var cw = window.__certWrite, leadP, popped;
        if (cw) {
          leadP = cw.crossed ? (cw.pBThr + (1 - cw.pBThr) * clamp(cw.t, 0, 1)) : Math.min(clamp(heroPB, 0, 1), cw.pBThr);
          popped = cw.crossed && cw.t >= 0.999;
        } else {
          leadP = clamp(heroPB, 0, 1); popped = heroPB >= 0.999;   // fallback: scroll-driven
        }
        leadRow.cmd.textContent = LINE_LEAD.slice(0, Math.round(leadP * LINE_LEAD.length));
        var headOn = popped || approachP > 0;            // header line spawns the moment the word POPS
        cdHead.row.style.display = headOn ? "" : "none";
        cdHead.cmd.textContent = headOn ? LINE_CD.slice(0, Math.round(clamp(approachP, 0, 1) * LINE_CD.length)) : "";
      } else {                                      // session running → append the `cd certificates` reversal line
        leadRow.cmd.textContent = LINE_LEAD; cdHead.cmd.textContent = LINE_CD; cdHead.row.style.display = "";
        // Re-lead POP: crossing the line where the video/marquee/CLI START MOVING UP on the
        // way BACK (heroPB leaving its clamped 1 ⟺ ye = 2vh ⟺ rect.top = vh) pops a FRESH
        // `cd certificates` line — the return-trip mirror of the first-run lead-in — instead
        // of only morphing the existing one. It types `cd certificates` with the video zoom
        // while up in that region, then hands off to the reversal morph (→ `cd highlights &&
        // cat scraping`) when you scroll forward back past the line. Movements that DON'T reach
        // this line never touch it — the reversal morph below is left exactly as it was.
        if (apPrevHeroPB === null) apPrevHeroPB = heroPB;
        var crossBackThr = apPrevHeroPB >= 0.999 && heroPB < 0.999;   // crossed the "starts moving up" line going up
        apPrevHeroPB = heroPB;
        if (crossBackThr && !leadLine) {
          freezeCert();                             // freeze the existing reversal line as-is (its typed `cd certificates`)
          // We've `cd`'d back into certificates → pop a FRESH, EMPTY prompt in that dir. It does
          // NOT re-type `cd certificates` (that's the frozen line above); it just waits empty.
          leadLine = makeRow(CD_CERTS); leadLine.zone = -1; domLines.push(leadLine);
          leadLine.cmd.textContent = "";
        }
        if (leadLine) {
          if (heroPB < 0.999) {
            // Up in the video region on the return: keep the new prompt EMPTY however far back
            // you scroll (nothing to untype — the `cd certificates` already happened, above).
            leadLine.cmd.textContent = "";
          } else {
            // Scrolled forward back past the line → type `cd ../highlights && cat scraping`
            // (LINE_CD) FROM THE START with the approach, exactly like the first-run header;
            // finishes at the pin. Reversing back up past the line empties it again.
            leadLine.cmd.textContent = LINE_CD.slice(0, Math.round(clamp(approachP, 0, 1) * LINE_CD.length));
          }
        }
        if (!certLine && !leadLine && apDir < 0 && domLines.length) {   // crossing UP past the cards threshold → spawn it
          certLine = makeRow(CD_HOME); certLine.zone = -1; domLines.push(certLine);   // `cd certificates` runs from home (after zone-0's `cd ..`)
          apStartP = approachP; certDir = -1; certSet("", LINE_LEAD); certAnchorPP = 0; certEndPP = 1; certDisp = "";
        }
        if (certLine) {
          var pp = apStartP > 1e-6 ? clamp((apStartP - approachP) / apStartP, 0, 1) : 1;
          // Direction flip → re-swap toward that direction's target, anchored at the current pp:
          // scrolling UP heads to `cd certificates` (pp→1), reversing DOWN morphs back to
          // `cd highlights && cat scraping` (pp→0), untyping only past the shared `cd ` prefix.
          if (apDir < 0 && certDir !== -1) { certDir = -1; certSet(certDisp, LINE_LEAD); certAnchorPP = pp; certEndPP = 1; }
          else if (apDir >= 0 && certDir !== 1) { certDir = 1; certSet(certDisp, LINE_REV); certAnchorPP = pp; certEndPP = 0; }
          var cspan = certEndPP - certAnchorPP;
          var cs = Math.abs(cspan) < 1e-6 ? 1 : (pp - certAnchorPP) / cspan;
          certDisp = certText(cs); certLine.cmd.textContent = certDisp;
          if (certDir === 1 && cs >= 1) commitCert();   // fully morphed back → freeze into the log
        }
      }
      renderStack();
      // Reset the zone engine so re-entering the pin spawns a FRESH line.
      domDisp = ""; domLastG = null; domDir = 1; domActiveZ = -1;
      return;
    }
    leadRow.cmd.textContent = LINE_LEAD;          // committed lead-in
    cdHead.row.style.display = "";
    cdHead.cmd.textContent = LINE_CD;             // committed header
    started = true; apLastP = approachP;
    leadLine = null;                              // re-lead line (if any) is absorbed into the log at the pin, left as typed
    apPrevHeroPB = null;                          // re-arm the re-lead threshold for the next exit
    if (certLine) commitCert();                   // re-entered the pin → freeze the reversal line into the log
    if (domLastG === null) domLastG = gg;
    if (gg > domLastG + 1e-6) domDir = 1;           // keep last direction while paused
    else if (gg < domLastG - 1e-6) domDir = -1;
    domLastG = gg;

    var z = clamp(Math.round(gg), 0, N - 1);
    var thr = domDir >= 0 ? z + 0.5 : z - 0.5;          // the threshold ahead in the travel direction
    if (z !== domActiveZ) {
      // Threshold crossed — PRINT a fresh new line UNDER the last and type the whole
      // command from empty toward this zone's DIRECTION-AWARE target (dirTarget): forward
      // types the forward domain (e.g. zone 1 → `cat etl-ml`), backward the backward one
      // (count DOWN — zone 3 → `cat etl-ml`, zone 2 → `cat scraping`). The two boundary zones
      // type `cd ..` toward the OUTSIDE (zone 1 back, last zone forward) — held empty until
      // the zone centre, then typed over the second half (see below).
      // Going back appends below just like forward; the stack only ever scrolls up.
      var ln = makeRow(CD_DIR); ln.zone = z; domLines.push(ln);
      setSwap("", dirTarget(z, domDir));
      if ((z === 0 && domDir < 0) || (z === N - 1 && domDir >= 0)) {
        // Boundary zone LEAVING (zone 1 back → `cd ..` up; last zone forward → `cd ..` down):
        // hold empty until HALFWAY (the zone centre), then type `cd ..` over the second half
        // (char-capped) — the exit command lands just before you leave the dir.
        var eB = Math.min(Math.abs(thr - z), (domBack + domFwd) * DOM_PER_CHAR);
        domStartG = z; domEndG = z + (thr >= z ? eB : -eB); domDisp = "";
      } else {
        domStartG = gg; domEndG = thr; domDisp = "";
      }
      domActiveZ = z; domDirState = domDir;
    } else if (domDir !== domDirState) {
      // Same zone, direction reversed: retype/untype toward the new direction's target.
      // In an INTERIOR zone the word changes (forward domain ↔ backward domain) — setSwap
      // keeps `cat ` and untypes/retypes the rest. In a BOUNDARY zone this is where typing
      // STARTS or UNTYPES: first zone typed forward
      // then scrolled back → untype to empty; last zone starts empty then types on the
      // backward scroll (and untypes again if you scroll forward). setSwap makes it a
      // MINIMAL edit — keep the common prefix, untype only the divergent tail, else keep
      // typing. Hold until HALFWAY (zone centre), then play the change out toward the
      // start point; the span is capped by chars changed (DOM_PER_CHAR each) so a few
      // letters type quickly instead of smearing across the whole second half.
      setSwap(domDisp, dirTarget(z, domDir));
      var chars = domBack + domFwd;
      var half = Math.abs(thr - z);
      var edit = Math.min(half, chars * DOM_PER_CHAR);
      domStartG = z; domEndG = z + (thr >= z ? edit : -edit);
      domDirState = domDir;
    }
    var span = domEndG - domStartG;
    domDisp = domainText(Math.abs(span) < 1e-6 ? 1 : (gg - domStartG) / span);

    // The bottom (newest) line is live/typing; every earlier line stays frozen at what it
    // printed. renderStack styles + scrolls the append-only log up (shared with the
    // approach branch so the pin crossing stays continuous — no reset/snap).
    if (domLines.length) domLines[domLines.length - 1].cmd.textContent = domDisp;
    renderStack();
  }

  /* ---------- Flow → blog handover (the mirror of the hero → flow lead-in) ----------
     `cd ..` is typed by the ZONE ENGINE on the last-zone line (dirTarget(N-1) = LINE_UP),
     finishing as the pin ends and the zone-4 cards fly out — the handover NEVER touches it.
     The moment the pin ends the handover SPAWNS one NEW line and types `cd blogs`, finishing
     precisely as the blog panels fly in (writing rect.top ≤ 0.5vh ⟺ flow rect.bottom ≤
     0.5vh, since .writing sits directly under .flow); then a fresh blogs$ prompt lands.

     Commit-then-spawn, exactly like the hero-side cert reversal (see driveTerminal):
      • PRE-COMMIT (threshold NOT yet reached): the `cd blogs` line is still live, so
        reversing MORPHS IT IN PLACE → `cd highlights && cat rest-apis` (no `../` — it sits
        at the ~/portfolio-website$ prompt).
      • COMMIT (threshold reached forward): `cd blogs` freezes, the blogs$ prompt spawns.
      • POST-COMMIT: the committed `cd blogs` is never edited — reversing types the back
        command `cd ../highlights && cat rest-apis` INTO that same blogs$ line (no extra
        line), and re-forwarding untypes it. */
  var HP_BLOG_END = 0.5;   // `cd blogs` finishes AS the blog panels fly in (bp = 1)
  var blogHO = null;       // { blogRow, promptRow, committed } while the handover is live
  var lastHp = -1;         // last hp — for the change-gate + the scroll direction
  // Minimal-edit morph for the PRE-COMMIT `cd blogs` ↔ `cd ../highlights && cat rest-apis`
  // swap (its own state so it never collides with the zone engine or the cert reversal).
  var blogFrom = "", blogTarget = "", blogBnd = 0, blogBk = 0, blogFw = 0;
  var blogDisp = "", blogDir = 1, blogAnchor = 0, blogEnd = 1;
  function blogSwap(from, target) {
    blogFrom = from; blogTarget = target;
    var m = Math.min(from.length, target.length), l = 0;
    while (l < m && from.charCodeAt(l) === target.charCodeAt(l)) l++;
    blogBnd = l; blogBk = from.length - l; blogFw = target.length - l;
  }
  function blogTextAt(s) {
    var total = blogBk + blogFw;
    if (total === 0) return blogTarget;
    var k = Math.round(clamp(s, 0, 1) * total);
    return k <= blogBk ? blogFrom.slice(0, blogFrom.length - k)
                       : blogTarget.slice(0, blogBnd + (k - blogBk));
  }
  // Commit the handover as-is (freeze every line into the append-only log — NOTHING is
  // removed) and re-arm so re-entering the flow pin spawns a FRESH zone line and a future
  // forward trip spawns a fresh `cd blogs`. Mirrors line-299 + commitCert on the hero side.
  function commitHandover() {
    if (!blogHO) return;
    blogHO = null; blogDisp = ""; blogDir = 1; lastHp = -1;
    // Re-entering the flow pin from the blog is always UPWARD → seed the zone engine backward
    // so it spawns the last zone's `cat infra` line (not a `cd ..` flash) and re-spawns fresh.
    domActiveZ = -1; domDisp = ""; domLastG = null; domDir = -1;
    renderStack();
  }
  function driveBlogHandover(flowBottom) {
    if (!cdStack || window.innerWidth <= 820) return;
    var vhh = window.innerHeight;
    var hp = clamp((vhh - flowBottom) / vhh, 0, 1);   // 0 at the pin end (cards flying out) → 1 once flow has fully left
    if (hp <= 1e-4) { commitHandover(); return; }     // back inside the pin → the zone engine owns the stack
    if (blogHO && Math.abs(hp - lastHp) < 1e-4) return;   // nothing moved → skip the DOM writes
    var dir = lastHp < 0 ? 1 : (hp > lastHp + 1e-5 ? 1 : (hp < lastHp - 1e-5 ? -1 : blogDir));
    var bp = clamp(hp / HP_BLOG_END, 0, 1);           // 0 at cards-fly-out → 1 at panels-fly-in
    lastHp = hp;
    domActiveZ = -1; domDisp = ""; domLastG = null;   // keep the zone engine parked while the handover owns the stack
    if (!blogHO) {                                     // cards fly out → SPAWN the new `cd blogs` line
      var blogRow = makeRow(CD_HOME); blogRow.zone = 99;   // `~/portfolio-website$ cd blogs`
      domLines.push(blogRow);
      blogHO = { blogRow: blogRow, promptRow: null, committed: false };
      blogDisp = ""; blogDir = 1; blogSwap("", LINE_BLOG); blogAnchor = 0; blogEnd = 1;
    }
    if (!blogHO.committed) {
      // PRE-COMMIT — the cd blogs line morphs in place (cd blogs ↔ cd highlights && cat rest-apis).
      if (dir < 0 && blogDir !== -1) { blogDir = -1; blogSwap(blogDisp, LINE_BLOG_BACK_PRE); blogAnchor = bp; blogEnd = 0; }
      else if (dir >= 0 && blogDir !== 1) { blogDir = 1; blogSwap(blogDisp, LINE_BLOG); blogAnchor = bp; blogEnd = 1; }
      var span = blogEnd - blogAnchor;
      blogDisp = blogTextAt(Math.abs(span) < 1e-6 ? 1 : (bp - blogAnchor) / span);
      blogHO.blogRow.cmd.textContent = blogDisp;
      if (blogDir === 1 && bp >= 1) {                 // threshold reached forward → COMMIT (freeze + land the prompt)
        blogHO.blogRow.cmd.textContent = LINE_BLOG;
        blogHO.promptRow = makeRow(CD_BLOGS); blogHO.promptRow.zone = 99;   // `~/portfolio-website/blogs$` — the ONE new line
        domLines.push(blogHO.promptRow);
        blogHO.committed = true;
      }
    } else {
      // POST-COMMIT — `cd blogs` is frozen and never edited. Reversing types the back command
      // INTO the blogs$ line spawned at the threshold (no extra line); re-forwarding untypes it.
      var up = clamp(1 - bp, 0, 1);                   // 0 at the landing → 1 back at the pin
      blogHO.promptRow.cmd.textContent = LINE_BLOG_BACK_POST.slice(0, Math.round(up * LINE_BLOG_BACK_POST.length));
    }
    renderStack();
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 2); }
  function easeIn(t) { return t * t * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }

  /* ---------- Zone-title poses ----------
     A title pose = where the .flow-panel__content sits relative to its rest spot:
       ex  extra px slide on X (the mid slide-in layered onto the appear)
       sx  translate %        tx/ty translate3d px      ry/rx rotateY/rotateX deg
     REST = identity. APPEAR = the hero entrance origin (3D, bottom-right).
     EXIT = the hero fly-out target (opposite corner). */
  function buildPoses(vw) {
    return {
      REST: { ex: 0, sx: 0, tx: 0, ty: 0, ry: 0, rx: 0 },
      APPEAR: { ex: vw * 0.22, sx: 50, tx: -222.2, ty: 88, ry: 60, rx: 35 },
      EXIT: { ex: 0, sx: -50, tx: 222.2, ty: -88, ry: 60, rx: 35 }
    };
  }
  function lerpPose(a, b, t) {
    return {
      ex: lerp(a.ex, b.ex, t), sx: lerp(a.sx, b.sx, t), tx: lerp(a.tx, b.tx, t),
      ty: lerp(a.ty, b.ty, t), ry: lerp(a.ry, b.ry, t), rx: lerp(a.rx, b.rx, t)
    };
  }
  function poseStr(base, p) {
    return base + " translateX(" + p.ex + "px) perspective(1000px) translate(" + p.sx +
      "%) translate3d(" + p.tx + "px," + p.ty + "px,0) rotateY(" + p.ry + "deg) rotateX(" + p.rx + "deg)";
  }
  // Hybrid entrance pose: the APPEAR 3D part (sx/tx/ty/ry/rx) resolved by factor f
  // (1=full → 0=resolved), the horizontal slide from mid (mx) to rest by factor s.
  function scrollPose(src, mx, f, s) {
    return {
      ex: lerp(mx, 0, s), sx: f * src.sx, tx: f * src.tx,
      ty: f * src.ty, ry: f * src.ry, rx: f * src.rx
    };
  }
  // Scroll-driven slide factor: stays at mid until d=-0.5+GAP, slides mid→rest by
  // d=0, then sticky. (The 3D appear + the exit are TIMED, fired at the threshold.)
  function slideFactor(d) {
    var GAP = 0.05;
    return smooth(clamp((d + 0.5 - GAP) / (0.5 - GAP), 0, 1));
  }
  // A panel's live title pose right now: interpolated if a timed _anim is in
  // flight, else the steady pose for its side of the active index. Lets a new
  // animation capture the current pose as its `from` so a mid-flight reversal
  // doesn't jump.
  function poseOf(panel, P, activeIdx, pi) {
    var a = panel._anim;
    if (a) {
      var el = Date.now() - a.t0 - a.delay;
      if (el < 0) return a.from;
      return lerpPose(a.from, a.to, easeOut(clamp(el / a.dur, 0, 1)));
    }
    return pi === activeIdx ? P.REST : (pi < activeIdx ? P.EXIT : P.APPEAR);
  }

  /* ---------- Sky hue cross-fade between stages ---------- */
  // All four zones share ONE gradient anchored to the hero's Vanta background
  // (rgb 208,225,235 = 0xd0e1eb) so hero→flow and zone→zone have no shade step.
  // TOP (viewport top, the hero seam) is exactly the hero colour; it eases a
  // touch lighter toward the bottom for soft depth — identical across zones.
  var TOP = [[208, 225, 235], [208, 225, 235], [208, 225, 235], [208, 225, 235]];
  var MID = [[223, 233, 242], [223, 233, 242], [223, 233, 242], [223, 233, 242]];
  var BOT = [[238, 243, 248], [238, 243, 248], [238, 243, 248], [238, 243, 248]];
  function rgb(c1, c2, t) {
    return "rgb(" + Math.round(lerp(c1[0], c2[0], t)) + "," +
      Math.round(lerp(c1[1], c2[1], t)) + "," + Math.round(lerp(c1[2], c2[2], t)) + ")";
  }
  var lastSky = "";
  function paintSky(g) {
    var i0 = clamp(Math.floor(g), 0, N - 1), i1 = clamp(i0 + 1, 0, N - 1), t = g - i0;
    var s = "linear-gradient(180deg," +
      rgb(TOP[i0], TOP[i1], t) + " 0%," + rgb(MID[i0], MID[i1], t) + " 55%," +
      rgb(BOT[i0], BOT[i1], t) + " 100%)";
    // Only touch the style when the rounded stops actually changed — a same-string
    // write still forces a full-viewport repaint of the sky layer every frame.
    if (s !== lastSky) { lastSky = s; sky.style.background = s; }
  }

  /* ---------- Floating cards: fly-in / rest / fly-out ---------- */
  // NOTE: the old .flow-card "floats" system lived here — a DIRS table of entry/exit
  // directions (including the diagonals), a cardState() pose function with its own
  // entry/exit windows, depth parallax, tilt and idle float. It was the DOM half of the
  // horizontal card journey. Those elements no longer exist in the markup (0 .flow-card
  // in the page, and no data-from/to/depth/tilt attributes anywhere), so `cards` was
  // permanently empty and the whole system was unreachable. Removed with the rest of the
  // horizontal/diagonal machinery — the per-stage .flow-pcard grid carries the cards now.
  /* ---------- Per-stage cards (the GL "image" replaced by 4 square cards) ----------
     Each stage shows a 2x2 grid of square cards reusing the Projects-section
     .proj-card look (notched frame + hover reveal + blue activation). Hovering a
     card OR its matching text item in .flow-panel__list activates BOTH (the
     .is-active class mirrors the card's :hover). Built here from CARD_DATA so the
     verbose frame SVG isn't duplicated 16× in the HTML. */
  // Card media is NOT listed here. main.js publishes window.__PROJECT_MEDIA from
  // PROJECTS — the single source of truth — and mediaFor() resolves it by name, so a
  // project that gains a poster or a hover video shows it on every surface at once.
  // Repeating img/video here is what left the Job Application Bot and Market Data
  // Platform on a stock placeholder in the flow after their cards gained real captures.
  var FALLBACK_IMG = "images/flow/data-collection.jpg";
  // A few flow entries use a shorter display name than the project card does.
  var MEDIA_ALIAS = {
    "DekhLaw API": "DekhLaw Legal-Emergency Platform",
    "Fraud Detection": "Fraud Transaction Detection"
  };
  function mediaFor(c) {
    // Blog cards resolve their cover from window.__BLOG_MEDIA, which gen-post.mjs
    // emits from partials/posts.json keyed by href. Changing which post a zone shows
    // is a one-line CARD_DATA edit and the picture follows. Posts with no cover fall
    // back to the gradient face below.
    if (c.k === "b") return { img: (window.__BLOG_MEDIA || {})[c.href] || null, video: null };
    var reg = window.__PROJECT_MEDIA || {};
    var m = reg[MEDIA_ALIAS[c.n] || c.n];
    return {
      img: (m && m.img) || c.img || FALLBACK_IMG,
      video: (m && m.video) || c.video || null
    };
  }
  var CARD_DATA = [
    [ // 01 Anti-Bot Scraping
      { k: "p", n: "Market Data Platform", d: "28-pipeline NSE ingestion layer feeding 12+ datasets.", t: ["Python", "Playwright", "ETL"], href: "/projects/market-data-pipeline/" },
      { k: "p", n: "Job Application Bot", d: "Scrapes Indeed, Glassdoor & LinkedIn; tailors a resume per match.", t: ["Python", "Playwright", "FastAPI"], href: "https://github.com/VishnujanNarayanan/Job_Application_Bot", ext: true },
      { k: "p", n: "Product Explorer", d: "Crawlee/Playwright scraper streaming a catalog over WebSockets.", t: ["Crawlee", "Playwright", "NestJS"], href: "/projects/product-explorer/" },
      { k: "b", n: "Scraping 20 Years of NSE Filings", d: "Beating bot defenses to backfill two decades of insider filings.", t: ["Scraping", "Playwright"], href: "/blog/how-i-scraped-nse-insider-filings/" }
    ],
    [ // 02 Resilient ETL & ML
      { k: "p", n: "Fraud Detection", d: "95% of fraud caught at 0.995 ROC-AUC on 6.4M transactions.", t: ["scikit-learn", "pandas"], href: "/projects/fraud-detection/" },
      { k: "p", n: "Minute-Level Stock Prediction", d: "Next-minute price direction over 9.4M NSE ticks.", t: ["scikit-learn", "Backtesting"], href: "/projects/nse-stock-prediction/" },
      { k: "p", n: "Semantic Quote Retrieval", d: "Fine-tuned embeddings + FAISS over ~2,500 quotes.", t: ["FAISS", "PyTorch", "Streamlit"], href: "https://github.com/VishnujanNarayanan/Quotes_Retrieval", ext: true },
      { k: "b", n: "Resumable ETL Pipelines", d: "Incremental loads, adaptive backoff, and reruns that repair gaps.", t: ["ETL", "Python"], href: "/blog/building-resumable-etl-pipelines/" }
    ],
    [ // 03 Deploys & Uptime
      { k: "p", n: "Functional Task Manager", d: "Scala 3 cross-compiled by sbt and shipped to Vercel as static JS.", t: ["Scala.js", "sbt", "Vercel"], href: "https://task-manager-using-functional-progr.vercel.app/", ext: true },
      { k: "p", n: "Job Application Bot", d: "Dockerized pipeline on AWS & GCP, Postgres on Neon.", t: ["Docker", "AWS", "GCP"], href: "https://github.com/VishnujanNarayanan/Job_Application_Bot", ext: true },
      { k: "b", n: "Common Data Ingestion Bugs", d: "~30 bugs across a year of collection, sorted by cause. Eight threw no error at all.", t: ["Data engineering", "Reliability"], href: "/blog/a-year-of-ingestion-bugs/" },
      { k: "b", n: "How to Test a Data Pipeline", d: "92 passing tests, 3 broken features, and the checks that would have caught them.", t: ["Testing", "CI"], href: "/blog/how-to-test-a-data-pipeline/" }
    ],
    [ // 04 APIs & Apps
      { k: "p", n: "DekhLaw API", d: "~30 Express endpoints, JWT auth, and Twilio voice orchestration.", t: ["Express", "Twilio", "JWT"] },
      { k: "p", n: "Law Firm Website", d: "Next.js 14 site — 14 routes, Resend lead capture, full SEO.", t: ["Next.js", "TypeScript", "Resend"], href: "https://smartnperfectlegal.legal/", ext: true },
      { k: "b", n: "HTTP 429 and Retry Logic", d: "Transient, permanent, exhausted — the retry logic that keeps a scheduled run alive.", t: ["APIs", "Reliability"], href: "/blog/http-429-retry-logic/" },
      { k: "b", n: "Local LLM vs API", d: "A 7B model on a 6GB GPU against a hosted 70B — latency, quotas, structured output.", t: ["LLMs", "APIs"], href: "/blog/local-llm-vs-api/" }
    ]
  ];
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function cardHtml(c, i) {
    // A card with `video` renders one, poster-first; applyActive() below plays it while
    // the card is the active one. preload="none" keeps it off the wire until then.
    var mv = mediaFor(c);
    var face = c.k === "b"
      ? (mv.img
          ? '<img class="proj-card__img" src="' + mv.img + '" alt="" loading="lazy" decoding="async">'
          : '<span class="proj-card__shot" aria-hidden="true"></span>')
      : mv.video
        ? '<video class="proj-card__img proj-card__video" src="' + mv.video + '" poster="' + mv.img +
          '" muted loop playsinline preload="none" aria-hidden="true"></video>'
        : '<img class="proj-card__img" src="' + mv.img + '" alt="" loading="lazy" decoding="async">';
    var openA = c.href ? '<a class="proj-card__media" href="' + c.href + '"' + (c.ext ? ' target="_blank" rel="noopener"' : "") + ">" : '<span class="proj-card__media">';
    var closeA = c.href ? "</a>" : "</span>";
    return '<div class="proj-card flow-pcard' + (c.k === "b" ? " proj-card--blog" : "") + '" data-card="' + i + '">' +
      openA + face +
        '<span class="proj-card__reveal"><span class="proj-card__desc">' + esc(c.d) + "</span></span>" +
      closeA +
      '<span class="proj-card__label">' +
        '<span class="proj-card__title">' + esc(c.n) + "</span></span>" +
    "</div>";
  }
  Array.prototype.slice.call(flow.querySelectorAll(".flow-panel__cards")).forEach(function (grid) {
    var pi = parseInt(grid.getAttribute("data-panel"), 10) || 0;
    var data = CARD_DATA[pi] || [];
    grid.innerHTML = data.map(function (c, i) {
      return cardHtml(c, i);
    }).join("");
  });

  // Card videos ship preload="none" so they do not compete with the hero for bandwidth
  // or the decoder at first paint — the same call as the transition videos. They are
  // warmed once the flow section comes within a viewport, and the decoder is PRIMED
  // (rolled briefly, parked at frame 0) rather than merely buffered, because buffered
  // bytes do not spin the decode pipeline up and that cost would otherwise land on the
  // first hover. Mirrors wireVideos() in main.js; see the hero's loadVideo().
  (function warmFlowVideos() {
    var vids = Array.prototype.slice.call(flow.querySelectorAll(".proj-card__video"));
    if (!vids.length || reduce) return;
    function prime(v) {
      if (v._warmed) return;
      v._warmed = true;
      v.preload = "auto";
      var park = function () { try { v.pause(); v.currentTime = 0; } catch (e) {} };
      var roll = function () {
        var pr;
        try { pr = v.play(); } catch (e) { park(); return; }
        if (pr && pr.then) pr.then(function () { setTimeout(park, 160); }, park);
        else setTimeout(park, 160);
      };
      if (v.readyState >= 3) { roll(); return; }
      v.addEventListener("canplaythrough", roll, { once: true });
      v.addEventListener("loadeddata", roll, { once: true });
      try { v.load(); } catch (e) {}
    }
    if (!window.IntersectionObserver) { vids.forEach(prime); return; }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        vids.forEach(prime);
        obs.disconnect();
      });
    }, { rootMargin: "100% 0px" });
    obs.observe(flow);
  })();
  // Hover coupling — hovering a card OR its matching text item activates BOTH (the
  // .is-active class mirrors the card's :hover). The cards are transformed EVERY frame
  // (cursor parallax + the horizontal scroll-slide) and their pointer-events toggle on
  // and off per active stage, so per-element pointerenter/pointerleave miss transitions:
  // a card slides under, or out from, a near-stationary cursor — or its pointer-events
  // flip — without the pointer ever crossing an element boundary, leaving hovers stuck
  // or never firing. Instead HIT-TEST the live geometry: read what's actually under the
  // cursor on each pointer move AND each render frame (refreshHover in loop()), so the
  // active pair always tracks the card that's really beneath the cursor right now.
  function applyActive(panel, idx, on) {
    var els = panel.querySelectorAll('.flow-panel__item[data-card="' + idx + '"], .flow-panel__cards .proj-card[data-card="' + idx + '"]');
    Array.prototype.forEach.call(els, function (el) {
      el.classList.toggle("is-active", on);
      // Video cards play only while active. Keyed off this rather than pointerenter
      // for the same reason .is-active is: the cards move every frame and their
      // pointer-events flip per stage, so element-level hover events get missed.
      var vid = el.classList.contains("proj-card") ? el.querySelector(".proj-card__video") : null;
      if (!vid) return;
      if (on && !reduce) {
        var p = vid.play();
        if (p && p.catch) p.catch(function () {});   // autoplay refused: poster stands in
      } else {
        vid.pause();
      }
    });
  }
  var hoverPanel = null, hoverIdx = -1, hoverX = -1, hoverY = -1;
  function refreshHover() {
    var host = null;
    if (hoverX >= 0) {
      var el = document.elementFromPoint(hoverX, hoverY);
      host = el && el.closest ? el.closest("[data-card]") : null;
      if (host && !flow.contains(host)) host = null;       // ignore data-card outside the flow
    }
    var panel = host ? host.closest(".flow-panel") : null;
    var idx = host ? +host.getAttribute("data-card") : -1;
    if (panel === hoverPanel && idx === hoverIdx) return;   // no change
    if (hoverPanel && hoverIdx >= 0) applyActive(hoverPanel, hoverIdx, false); // clear the old pair
    if (panel && idx >= 0) applyActive(panel, idx, true);   // activate the new pair
    hoverPanel = panel; hoverIdx = idx;
  }
  window.addEventListener("pointermove", function (e) {
    hoverX = e.clientX; hoverY = e.clientY; refreshHover();
  }, { passive: true });
  window.addEventListener("pointerleave", function () {     // cursor left the window
    hoverX = hoverY = -1; refreshHover();
  }, { passive: true });

  // ---- Per-letter VERTICAL REEL on the zone list text ----------------------
  // Each .flow-panel__item's letters are wrapped in a reel clip (__a on top, an
  // identical __c waiting just below). When the item is .is-active — which fires
  // when the cursor is over the TEXT or its matching CARD (same hit-test as the
  // hover coupling above) — the column rolls up letter-by-letter (staggered) so
  // every glyph reels over to its clone. Words stay intact so wrapping is normal.
  (function buildItemReels() {
    var REEL_STEP = 0.012;  // per-letter stagger (s)
    Array.prototype.forEach.call(flow.querySelectorAll(".flow-panel__item"), function (item) {
      var text = item.textContent;
      item.setAttribute("aria-label", text);
      var last = text.replace(/\s+/g, "").length - 1;         // index of the final letter
      item.textContent = "";
      var gi = 0;
      text.split(/(\s+)/).forEach(function (chunk) {           // keep the whitespace chunks
        if (chunk === "") return;
        if (/^\s+$/.test(chunk)) { item.appendChild(document.createTextNode(" ")); return; }
        var word = document.createElement("span");
        word.className = "reel-word";
        word.setAttribute("aria-hidden", "true");
        for (var i = 0; i < chunk.length; i++) {
          var clip = document.createElement("span"); clip.className = "reel-char";
          var col  = document.createElement("span"); col.className  = "reel-char__col";
          // Forward (hover-in): left → right. Reverse (unhover): last letter back first.
          col.style.setProperty("--hd", (gi * REEL_STEP).toFixed(3) + "s");
          col.style.setProperty("--hd-rev", ((last - gi) * REEL_STEP).toFixed(3) + "s");
          var a = document.createElement("span"); a.className = "reel-char__a"; a.textContent = chunk[i];
          var c = document.createElement("span"); c.className = "reel-char__c"; c.textContent = chunk[i];
          col.appendChild(a); col.appendChild(c);
          clip.appendChild(col);
          word.appendChild(clip);
          gi++;
        }
        item.appendChild(word);
      });
    });
  })();

  // Staggered columns + cursor parallax (like the reference nav images, whose two
  // columns sit offset by ±2.25rem and drift with the mouse). Each card carries a
  // per-COLUMN baseY offset (left col up, right col down) so it's not a flat grid, plus
  // a DEPTH so it drifts toward the cursor by a different amount. Both are folded into
  // the card's own transform (the .flow-panel__cards container still owns the slide).
  panels.forEach(function (panel) {
    // Cards are stored ON their panel: the per-frame pose is a panel-level quantity, so
    // the loop walks panels and applies one result to that panel's cards.
    var list = panel._pcards = [];
    Array.prototype.slice.call(panel.querySelectorAll(".flow-panel__cards .flow-pcard")).forEach(function (el, i) {
      // dir matches the reference: left column y = −p, right column y = +p.
      // panel = owning stage. dir is the only per-card variable left: it picks which of
      // the panel's two mirrored column poses this card takes. (rowSign used to drive the
      // per-ROW diagonal enter/exit; that effect is gone with the horizontal slide.)
      list.push({ el: el, dir: (i % 2 === 0) ? -1 : 1 });
    });
  });
  var mTY = 0, mCY = 0;       // cursor Y target / current (smoothed), normalised −0.5..0.5
  var mSplay = 0, splayVel = 0;   // scroll-momentum column splay: held offset (rem) + its velocity
  var SPLAY_MAX = 4;              // rem clamp on the held offset (also sets the off-screen fly distance)
  var lastCsel;                   // previous active card stage — detects the zone-swap threshold
  if (!reduce) window.addEventListener("pointermove", function (e) {
    mTY = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });


  /* ---------- Journey spine: wavy path + station nodes ---------- */
  var NODE_PTS = [{ x: 0.12, y: 0.46 }, { x: 0.38, y: 0.70 }, { x: 0.64, y: 0.40 }, { x: 0.90, y: 0.28 }];
  var VBW = 1200, VBH = 150;
  function buildPath() {
    var pts = NODE_PTS.map(function (n) { return [n.x * VBW, n.y * VBH]; });
    var all = [[0, pts[0][1]]].concat(pts).concat([[VBW, pts[pts.length - 1][1]]]);
    var d = "M" + all[0][0].toFixed(1) + " " + all[0][1].toFixed(1);
    for (var i = 0; i < all.length - 1; i++) {
      var p0 = all[i - 1] || all[i], p1 = all[i], p2 = all[i + 1], p3 = all[i + 2] || all[i + 1];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += " C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + " " + c2x.toFixed(1) + " " + c2y.toFixed(1) + " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    return d;
  }
  var fillLen = 0;
  var curveXY = [];  // sampled {x,y} of the fixed spine, for y-at-x lookup
  if (lineEl && fillEl) {
    var d = buildPath();
    lineEl.setAttribute("d", d);
    fillEl.setAttribute("d", d);
    fillLen = fillEl.getTotalLength();
    // Spine is scroll-drawn left→right (not just faded in): both the faint base
    // line and the highlight start fully hidden (offset = full length) and the
    // loop reels the dashoffset to 0 as you scroll into the section.
    lineEl.style.strokeDasharray = fillLen;
    lineEl.style.strokeDashoffset = fillLen;
    fillEl.style.strokeDasharray = fillLen;
    fillEl.style.strokeDashoffset = fillLen;
    for (var s = 0; s <= 240; s++) {
      var p = fillEl.getPointAtLength(s / 240 * fillLen);
      curveXY.push({ x: p.x, y: p.y });
    }
  }
  // Curve y for a given viewBox x (clamped to the spine ends — off-curve nodes
  // are off-screen anyway and just ride flat past the edge).
  function yAtX(x) {
    if (!curveXY.length) return VBH / 2;
    if (x <= curveXY[0].x) return curveXY[0].y;
    var last = curveXY[curveXY.length - 1];
    if (x >= last.x) return last.y;
    for (var i = 1; i < curveXY.length; i++) {
      if (curveXY[i].x >= x) {
        var a = curveXY[i - 1], b = curveXY[i];
        var t = (x - a.x) / (b.x - a.x || 1);
        return a.y + (b.y - a.y) * t;
      }
    }
    return last.y;
  }
  nodeEls.forEach(function (n, i) {
    // Base offsets stay at 0 — the per-frame transform carries the whole position (see
    // the loop). These used to seed a left/top placement that the first frame overwrote
    // anyway; leaving them set would now double-count against the transform.
    n.style.left = "0px";
    n.style.top = "0px";
    n.addEventListener("click", function () { jumpTo(i); });
  });
  function jumpTo(i) {
    var rect = flow.getBoundingClientRect();
    var top = rect.top + (window.scrollY || window.pageYOffset || 0);
    var total = flow.offsetHeight - window.innerHeight;
    var y = top + ((i + 0.5) / N) * total;   // land at zone i's centre (global = progress·N − 0.5)
    if (window.__lenis && window.__lenis.scrollTo) window.__lenis.scrollTo(y, { duration: 1.2 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  }

  /* ---------- Desktop motion flag ----------
     Was `THREEok`, gating a three.js depth scene. That scene rendered NOTHING:
     createImageObject was disabled, so `images`/`focal` stayed empty and renderGL
     early-returned after a single clear — yet the library was still a
     render-blocking ~145KB gz on the critical path. The whole rig (renderer,
     scene, camera, lights, TextureLoader, the .flow__gl canvas) is gone, along
     with the <script> tag in index.html.
     The FLAG is kept, because it never really meant "GL is up" — it means
     "desktop, motion allowed", and it still drives two live behaviours: the
     .flow--gl class (CSS hides .flow-panel__floats above 820px) and skipping the
     floats' per-frame transform loop. With THREE present and initGL not throwing,
     THREEok evaluated to exactly `!isMobile && !reduce` — which is this — so the
     rendered result is unchanged. */
  var deskFx = !isMobile && !reduce;

  /* ---------- Main loop ---------- */
  var lastSel = -1;
  var lastGlobalRaw = 0, scrollDir = 1;   // scroll direction: +1 forward (down), −1 back (up)
  var lastInPlace;                        // previous frame's pin state — detects the parked-globalRaw jump
  var gSpeed = 0, lastGlobalTime = 0;     // smoothed scroll speed in global-units (zones)/ms
  var darkSubs = [];   // zone 3-4 sub paragraphs; colour scroll-driven black→grey
  var lightSubs = [];  // zone 1-2 sub paragraphs; colour scroll-driven grey→white
  var navOn = false;   // top-nav reel state; fired once per threshold crossing
  var vh = window.innerHeight;
  var lastHitT = 0;    // loop-side hover hit-test throttle stamp
  var hoverDue = false;  // set at the end of a frame, serviced at the top of the next
  // Change-gate caches: a style/custom-prop write with an UNCHANGED value still
  // invalidates paint on its subtree, so each scroll-lerped colour remembers its
  // last written string and only touches the DOM when the rounded value moves.
  var lastJRgb = "", lastSubCol = "", lastSubCol2 = "", lastUsr = "", lastPath = "", lastPunct = "";
  // Per-element transform/opacity setter with the same skip-if-unchanged guard
  // (panel titles / card grids settle to constant strings once their easing lands —
  // without the guard they'd re-write identical transforms every idle frame).
  function setSt(el, prop, val) {
    var c = el._ps || (el._ps = {});
    if (c[prop] !== val) { c[prop] = val; el.style[prop] = val; }
  }
  // rAF scheduler — the loop suspends fully when nothing it drives is on screen
  // (deep in socials/footer, or the tab is hidden) and re-arms on scroll/resize/
  // visibility. Every phase the loop drives (hero-zoom terminal park, the pin, the
  // blog handover) is a pure function of scroll, so nothing eases while dormant —
  // waking on the next scroll event reproduces the exact same pose.
  var flowRaf = 0;
  function schedule() { if (!flowRaf && !document.hidden) flowRaf = requestAnimationFrame(loop); }
  function loop() {
    flowRaf = 0;
    // Hover hit-test FIRST, before this frame writes any styles. elementFromPoint
    // flushes style+layout, and it used to run at the END of the loop — after every
    // transform/opacity write — so it always paid for a full reflow (measured at
    // ~13-16ms per call, the single most expensive thing in the frame). Run at the
    // top, the pending layout is whatever the browser already committed for this
    // frame, so the flush is cheap or free. Still throttled: cards drift slowly and
    // deliberate pointer moves are handled immediately by the pointermove listener.
    if (hoverDue && performance.now() - lastHitT > 90) {
      lastHitT = performance.now(); hoverDue = false; refreshHover();
    }
    var rect = flowRect();
    // Off-screen early-outs — skip the whole per-frame body when the section can't
    // be seen. Below the viewport (approaching): the fixed CLI terminal is still on
    // stage during the hero video zoom-out, so keep just it alive (approachP is 0 and
    // globalRaw is parked at -1 in this phase, matching what the full body computes).
    // Above the viewport (scrolled past): everything incl. the terminal is gone.
    if (rect.top >= vh) {
      // Flow below the viewport (hero-zoom region): park/drive the fixed CLI once. All pure
      // scroll functions → go dormant; the next scroll event re-arms and re-poses it.
      var yeH = window.__heroY ? window.__heroY(window.scrollY, vh) : window.scrollY;
      positionTerminal(rect);
      driveTerminal(false, 0, -1, clamp((yeH - vh) / vh, 0, 1));
      return;
    }
    if (rect.bottom <= 0) {
      // Flow is completely past — the blog handover is at its landed state (cd .. + cd blogs
      // done, blogs$ prompt showing; hp clamps to 1). Keep it driven so scrolling back up
      // untypes it, and keep the terminal sticky while the blog is on screen (positionTerminal
      // decides sticky-vs-scroll-away via the writing rect; it leaves once writing scrolls past).
      positionTerminal(rect);
      driveBlogHandover(rect.bottom);
      // Keep looping only while the blog is still on screen (the terminal is sliding away over
      // it); once the blog has scrolled fully past, nothing flow-related is visible → dormant.
      var wr = writingRect();
      if (wr && wr.bottom > 0) schedule();
      return;
    }
    var total = rect.height - vh;
    var scrolled = clamp(-rect.top, 0, total);
    var progress = total > 0 ? scrolled / total : 0;
    // Even zone spacing: each of the N zones gets an EQUAL 1/N slice of the pinned
    // scroll, its panel centred in the MIDDLE of that slice (progress (2i+1)/2N).
    // global = progress·N − 0.5 → centres at 0,1,…,N−1 land at 1/8,3/8,5/8,7/8, so
    // the first/last zones are no longer squashed against the 0/1 ends (they now get
    // the same dwell + the same card entry/exit runway as the middle two).
    var global = progress * N - 0.5;
    // Terminal: "cd highlights" types out as the section scrolls INTO place — over
    // the approach, with rect.top travelling from ~0.85·vh down to 0. It finishes
    // exactly as the section pins (rect.top ≤ 0 = "in place"), the threshold below.
    var TYPE_START = vh * 0.85;
    var approachP = clamp((TYPE_START - rect.top) / TYPE_START, 0, 1);
    var inPlace = rect.top <= 0;
    // Unclamped global for the IMAGE + TITLE edge motion: lets the first zone enter
    // from the right during the lead-in scroll (before the section reaches the top)
    // and the last zone keep exiting left past the section end — so every zone covers
    // the same travel distance and plays the same appear/exit. Clamped to a full zone
    // of overscroll on each side: at -1 the first zone waits off-right (pre-entry),
    // crossing -0.5 fires its appear + image entry; at N the last zone has exited.
    // Hold every zone parked (globalRaw at its pre-entry edge) until the section is
    // in place; release at the pin so zone 1 enters at the exact terminal threshold.
    var globalRaw = !inPlace ? -1 : (total > 0 ? clamp((-rect.top) / total * N - 0.5, -1, N) : 0);
    // Terminal (ONE element/stack): the lead row types `cd certificates` over the video zoom-out
    // (heroPB), the header types `cd ../highlights && cat scraping` over the approach, then the
    // zone lines append in the pin. positionTerminal rides the single element park→rest→away.
    var yeHero = window.__heroY ? window.__heroY(window.scrollY, vh) : window.scrollY;
    var heroPB = clamp((yeHero - vh) / vh, 0, 1);
    positionTerminal(rect);
    // Past the pin (bottom edge rising, zone-4 cards flying out) the blog handover owns the
    // stack — it types `cd ..` → `cd blogs` → blogs$; at/before the pin the zone engine does.
    if (inPlace && rect.bottom < vh) { driveBlogHandover(rect.bottom); }
    else { commitHandover(); driveTerminal(inPlace, approachP, globalRaw, heroPB); }
    var dGlobal = globalRaw - lastGlobalRaw;                         // signed scroll delta this frame (zones)
    // globalRaw is PARKED at −1 while the section isn't in place, so the frame the pin
    // engages (or releases) it jumps discontinuously (−1 ↔ ~−0.5) with no scroll behind
    // it. That fake delta kicked the column splay by ~2rem, so the cards visibly SNAPPED
    // to a new position at the hero/zone-1 threshold when scrolling back up and returning.
    // Swallow the delta on the toggle frame; real scrolling resumes from the next one.
    if (lastInPlace === undefined) lastInPlace = inPlace;
    if (inPlace !== lastInPlace) { dGlobal = 0; lastInPlace = inPlace; }
    var sceneScrolled = Math.abs(globalRaw - lastGlobalRaw) > 1e-4;  // cards slid this frame
    if (globalRaw > lastGlobalRaw + 1e-4) scrollDir = 1;
    else if (globalRaw < lastGlobalRaw - 1e-4) scrollDir = -1;
    // Smoothed scroll speed (zones/ms) — drives how fast titles enter/exit below.
    var tNow = Date.now(), dtMs = tNow - (lastGlobalTime || tNow);
    if (dtMs > 0) { var inst = Math.abs(globalRaw - lastGlobalRaw) / dtMs; gSpeed += (inst - gSpeed) * 0.3; }
    lastGlobalTime = tNow;
    lastGlobalRaw = globalRaw;

    journey.classList.toggle("is-live", rect.top <= 1 && rect.bottom > vh * 0.6);

    var vw = window.innerWidth;
    var trackX = -global * vw;
    setSt(track, "transform", "translate3d(" + trackX + "px,0,0)");
    paintSky(global);
    // Colour-fade bracket. EVERY scroll-driven colour transition (bg lighten + contour
    // lines via __flowLight, journey/scroll wheel, sub-text) used to run over progress
    // [0.3, 1.0] (≈1/5 into zone 2 → end of zone 4). Re-home them into [0.2, 0.8] =
    // 4/5 of zone 1 → 1/5 of zone 4 (zone k = index k−1 spans [k−1.5, k−0.5] in global;
    // progress = (global+0.5)/N, N=4 → 4/5 of zone 1 = progress 0.2, 1/5 of zone 4 =
    // 0.8). Rather than move each fade's constants, we remap progress into an effective
    // `colorP` and feed the UNCHANGED fade formulas below: every fade keeps its RELATIVE
    // position within the transition, so the nav switch, contour flip, wheel darken and
    // sub-text all land at the SAME percentage — just inside the new, narrower bracket.
    var CF_OLD0 = 0.3, CF_OLD1 = 1.0, CF_NEW0 = 0.2, CF_NEW1 = 0.8;
    var colorP = CF_OLD0 + (progress - CF_NEW0) * (CF_OLD1 - CF_OLD0) / (CF_NEW1 - CF_NEW0);
    // Progressive lighten: dark navy world → the hero's light shade over the bracket.
    // lightT (0→1) is shared with main.js (window.__flowLight) which lightens the
    // contour-canvas bg + inverts the lines. Here it also flips the foreground text:
    // title/index bright→deep blue, sub white→grey, readable as the bg turns light.
    var LIGHT_START = (0.7 + 0.5) / N;   // old bracket start (colorP space); == CF_OLD0
    var lightT = clamp((colorP - LIGHT_START) / (1 - LIGHT_START), 0, 1);
    window.__flowLight = lightT;
    // Top nav (Projects/Skills/Services/Blog) rolls to black in a per-letter reel
    // once the bg transition is ~27% underway. Threshold-driven: fired ONCE per
    // crossing so __navLight can set direction-aware delays (forward = left word
    // first; reverse = last word / last letter first). CTAs are excluded.
    var navWantOn = lightT >= 0.27;
    if (navWantOn !== navOn) {
      navOn = navWantOn;
      if (window.__navLight) window.__navLight(navOn);
      else if (hdr) hdr.classList.toggle("header--on-light", navOn);
    }
    // Journey wheel/spine darkens with scroll from the HALF of zone 3 (zone 3 spans
    // global 1.5→2.5, half = global 2 → progress 2/3) to the end, so it reads on the
    // light bg: bright blue 77,139,255 → deep blue 35,29,122.
    var jStart = (2 + 0.5) / N;   // half of zone 3 in colorP space (== old 0.625)
    var jDark = clamp((colorP - jStart) / (1 - jStart), 0, 1);
    var jRgb = Math.round(lerp(77, 35, jDark)) + "," + Math.round(lerp(139, 29, jDark)) + "," + Math.round(lerp(255, 122, jDark));
    if (jRgb !== lastJRgb) { lastJRgb = jRgb; flow.style.setProperty("--journey-rgb", jRgb); }
    // Zone 3-4 sub text fades from a slightly-lighter black → a slightly-darker grey
    // across zone 3 to the end (zone 3 starts at global 1.5 → progress 0.5).
    var subT = clamp((colorP - 0.5) / 0.5, 0, 1);
    var subCol = "rgb(" + Math.round(lerp(40, 105, subT)) + "," + Math.round(lerp(40, 105, subT)) + "," + Math.round(lerp(46, 112, subT)) + ")";
    if (subCol !== lastSubCol) { lastSubCol = subCol; for (var si = 0; si < darkSubs.length; si++) darkSubs[si].style.color = subCol; }
    // Zone 1-2 sub text: the OTHER side of mid grey — slightly-lighter-grey → a
    // slightly-darker-white across zone 1 to the end of zone 2 (progress 0 → 0.5).
    var subT2 = clamp(colorP / 0.5, 0, 1);
    var subCol2 = "rgb(" + Math.round(lerp(150, 236, subT2)) + "," + Math.round(lerp(150, 236, subT2)) + "," + Math.round(lerp(156, 240, subT2)) + ")";
    if (subCol2 !== lastSubCol2) { lastSubCol2 = subCol2; for (var sj = 0; sj < lightSubs.length; sj++) lightSubs[sj].style.color = subCol2; }
    // CLI prompt darkens as the bg lightens. The green user@host and the blue path now
    // fade on SEPARATE brackets (each zone spans 0.25 of progress; zone k = [(k-1)/4, k/4]):
    //   • blue path  → HALF of zone 2 → 1/5 into zone 3: progress [0.375, 0.5+0.25/5 = 0.55].
    //   • green user → 5/6 of zone 2 → 1/3 into zone 3: progress [0.25+0.25·5/6 ≈ 0.4583,
    //     0.5+0.25/3 ≈ 0.5833] (a 0.125-wide bracket).
    // The typed command is left alone (it flips to black via .flow__cd-row--dark); the bare
    // ":"/"$" punctuation keeps the original zone2¾→zone3¼ crossfade so it stays legible.
    if (flowCd) {
      var usrT = clamp((progress - (0.25 + 0.25 * 5 / 6)) / 0.125, 0, 1);
      var usrC = "rgb(" + Math.round(lerp(38, 18, usrT)) + "," + Math.round(lerp(162, 112, usrT)) + "," + Math.round(lerp(105, 66, usrT)) + ")";
      if (usrC !== lastUsr) { lastUsr = usrC; flowCd.style.setProperty("--cli-usr", usrC); }
      var pathT = clamp((progress - 0.375) / 0.175, 0, 1);
      var pathC = "rgb(" + Math.round(lerp(59, 28, pathT)) + "," + Math.round(lerp(142, 96, pathT)) + "," + Math.round(lerp(234, 180, pathT)) + ")";
      if (pathC !== lastPath) { lastPath = pathC; flowCd.style.setProperty("--cli-path", pathC); }
      var punctT = clamp((progress - 0.4375) / (0.5625 - 0.4375), 0, 1);
      var pv = Math.round(lerp(208, 17, punctT));
      var punctC = "rgb(" + pv + "," + pv + "," + pv + ")";
      if (punctC !== lastPunct) { lastPunct = punctC; flowCd.style.setProperty("--cli-punct", punctC); }
    }
    // NOTE: only the LINES + bg (main.js, via __flowLight) transition with scroll.
    // The TEXT colours are NOT scroll-lerped — they're set once per panel by zone
    // index (see setupZoneText below) so each title POPS UP already in its final
    // colour when its zone appears (zones 3-4 = deep blue / grey on the light bg).

    // rawSel drives the title threshold crossings (and steady-state side): it can
    // reach -1 (first zone not yet entered) and N (last zone exited), so the first
    // zone plays its appear on scroll-in and the last zone plays its exit on
    // scroll-out — mirroring the image entry/exit. `active` stays clamped for the
    // journey nodes only.
    // Edge thresholds biased inward (from the default ±0.5 crossings) so the first
    // zone's appear fires a bit LATER (after it's on screen, not at the off-screen
    // overscroll edge) and the last zone's exit fires a bit EARLIER (while still on
    // screen). Interior crossings stay at the half-integers; only the pre-entry
    // (-1→0) and exit (N-1→N) shift.
    // Zeroed so the first/last zones are symmetric with the middle two: zone 0
    // enters at globalRaw -0.5 (= the pin, progress 0) and zone N-1 exits at
    // globalRaw N-0.5 (= progress 1), giving each zone the full ±0.5 dwell.
    var ENTER_LATE = 0;          // appear fires at globalRaw -0.5 (at the pin)
    var EXIT_EARLY = 0;          // exit fires at globalRaw N-0.5 (at the section end)
    var rawSel;
    if (globalRaw < -0.5 + ENTER_LATE) rawSel = -1;             // first zone not yet entered
    else if (globalRaw >= N - 0.5 - EXIT_EARLY) rawSel = N;     // last zone has exited
    else rawSel = clamp(Math.round(globalRaw), 0, N - 1);
    var active = clamp(rawSel, 0, N - 1);
    var now = Date.now();
    var P = buildPoses(vw);
    // Title motion. Each panel's content is screen-pinned (counter-translateX
    // cancels its panel's screen offset pi*vw+trackX, so its baseline is its CSS
    // `left` rest spot regardless of how far the track slid). Both entry and exit
    // are THRESHOLD-driven, fired at the swap threshold (active=round(global)
    // flips at the zone midpoint — the same point the images swap), each a snappy
    // fixed-duration timed animation, DIRECTION-AWARE so scrolling back up plays
    // the reverse: scrolling DOWN the new title enters from APPEAR (no fade) and
    // the old leaves to EXIT (fade out); scrolling UP the mirror — the returning
    // title enters from EXIT and the leaving one goes back to APPEAR. The entering
    // title is held hidden for ENTER_DELAY after the threshold so the outgoing one
    // clears first (kills the subtle overlap). Animations are set up on the active
    // flip below; `from` captures the live pose so a mid-flight reversal doesn't jump.
    var ENTER_DELAY = 90;        // hold the new title hidden briefly after the threshold
    var ENTER_MS = 320;          // entrance (appear / reverse-exit) — at slow scroll
    var EXIT_MS = 200;           // snappy departure (exit / reverse-appear) — at slow scroll
    var SPEED_FULL = 0.006;      // scroll speed (zones/ms) at which durations hit 2x faster
    if (rawSel !== lastSel) {
      // The faster the scroll at the crossing, the faster titles enter/exit — up to
      // 2x (durations halved) for a really quick scroll; 1x (base) for a slow one.
      var speedK = 1 + clamp(gSpeed / SPEED_FULL, 0, 1);
      var hadPrev = !!panels[lastSel];   // an outgoing title exists → hold the entrance briefly
      // Exit target: the EXIT/APPEAR pose plus a screen-space slide off the side it
      // belongs on (behind = left, ahead = right). Leftward (forward scroll) travels a
      // full viewport so the title clears the screen. RIGHTWARD (scrolling BACK up) is
      // deliberately SHORT: the APPEAR pose already carries sx:50 (+~23vw of its own
      // width) off a 6vw rest spot, so a full-vw slide flung the title clear across the
      // page. RIGHT_FRAC lands it around mid-screen instead — it has faded out (linear,
      // EXIT_MS) by the time it gets there, so it never lingers visibly at the edge.
      var RIGHT_FRAC = 0.15;
      function flyOff(pi) {
        var b = pi < rawSel ? P.EXIT : P.APPEAR;
        return { ex: pi < rawSel ? -vw : vw * RIGHT_FRAC, sx: b.sx, tx: b.tx, ty: b.ty, ry: b.ry, rx: b.rx };
      }
      panels.forEach(function (panel, pi) {
        var a = panel._anim;
        if (pi === rawSel) {
          panel._anim = {          // the new active title enters (eased)
            // No hold when there's no outgoing title to clear (first zone) — it'd just
            // add a gap; the delay only matters when an old title needs to exit first.
            t0: now, delay: (hadPrev ? ENTER_DELAY : 0) / speedK, dur: ENTER_MS / speedK, fade: false,
            from: poseOf(panel, P, lastSel, pi), to: P.REST
          };
        } else if ((a && !a.fade) || pi === lastSel) {
          // A zone we just left OR one still mid-ENTER when the threshold moved on:
          // abandon its entrance and slide its exit off the side it belongs on. Fixes a
          // fast scroll leaving a previous zone's appear stuck at the screen edge.
          panel._anim = {
            t0: now, delay: 0, dur: EXIT_MS / speedK, fade: true, linear: true,
            from: poseOf(panel, P, lastSel, pi), to: flyOff(pi)
          };
        }
      });
      // index / sub / pills keep their grouped fade via the active/passed classes.
      panels.forEach(function (panel, pi) {
        panel.classList.toggle("flow-panel--active", pi === rawSel);
        panel.classList.toggle("flow-panel--passed", pi < rawSel);
      });
      lastSel = rawSel;
    }
    panels.forEach(function (panel, pi) {
      var content = panel.querySelector(".flow-panel__content");
      if (!content) return;
      var base = "translateY(-58%) translateX(" + (-(pi * vw + trackX)) + "px)";
      var a = panel._anim;
      if (a) {
        var el = now - a.t0 - a.delay;
        if (el < 0) {                                    // delay window — hold at the `from` pose
          setSt(content, "transform", poseStr(base, a.from));
          setSt(content, "opacity", a.fade ? "1" : "0"); // leaving stays visible; entering hidden
        } else {
          var raw = clamp(el / a.dur, 0, 1);
          var t = a.linear ? raw : easeOut(raw);   // exit = constant speed; entry eases
          setSt(content, "transform", poseStr(base, lerpPose(a.from, a.to, t)));
          setSt(content, "opacity", a.fade ? String(1 - t) : "1"); // entering = no fade-in
          if (el >= a.dur) panel._anim = null;           // settle to steady next frame
        }
      } else {                                           // steady state by side of `rawSel`
        var sp = pi === rawSel ? P.REST : (pi < rawSel ? P.EXIT : P.APPEAR);
        setSt(content, "transform", poseStr(base, sp));
        setSt(content, "opacity", pi === rawSel ? "1" : "0");
      }
    });

    // Per-stage cards: ported 1:1 from the GL image motion (renderGL). Same model,
    // same distances — REST_X / OFF_L / OFF_R world units, same `REST_X*(0.5-local)`
    // formula, same 0.08 smoothed catch-up (_coff == the image's u.off). World units
    // → px via the camera's world→screen factor F (camZ 17, IMG_Z 1, fov 55), and the
    // grid is centred (offset 0 = screen centre) so the cards rest right-of-centre and
    // park fully off-screen exactly like the image. pinX cancels the track slide so the
    // motion is scroll-driven; globalRaw (−1..N) gives the first/last their lead travel.
    var cselRaw = Math.round(globalRaw);
    // EDGE ZONES: once the cards have arrived they STAY on the page — they only ever
    // swap BETWEEN zones. globalRaw runs −1..N, so the raw index leaves the [0,N−1] band
    // at both ends (scrolling back up to the hero, or on past zone 4), which used to read
    // as a threshold crossing and fire an exit with nothing coming in behind it. Clamping
    // the index into the band means those ends cross no threshold: no exit, and the edge
    // zone's grid stays visible/active. The FIRST arrival is exempt — while lastCsel is
    // still undefined/out of band the raw −1 is kept, so zone 1 plays its entry at the pin.
    var csel = (lastCsel !== undefined && lastCsel >= 0 && lastCsel < N)
      ? clamp(cselRaw, 0, N - 1) : cselRaw;
    var F = vh / 16.658;                             // 1 world unit in px (2·(17−1)·tan(55°/2))
    // STEP 1 (flow-columns-stationary): the card grid no longer parallax-scrolls
    // horizontally. Every panel's grid is pinned at a fixed REST_X spot (no R_END→OFF
    // slide); the active panel shows, the rest are opacity-gated out. _coff is held at
    // REST_X so the vertical hover parallax + column stagger below still compose on top,
    // and the diagonal/lag machinery (which keys off off-band _coff) stays inert.
    // REST_X (world units, +right of centre) is the whole-grid rest position — bump it
    // to slide the columns further right. Kept inside (L_END, R_END) so g stays 0.
    var REST_X = 6;
    // Zone-swap threshold: the OUTGOING zone's columns fly off vertically (left col up /
    // right col down on forward scroll, mirrored on backward — continuing the splay
    // direction), while the INCOMING zone's cards start at ZERO offset (like zone 1 at
    // the pin) and react to scroll fresh. Works both directions; the splay momentum is
    // reset at every crossing so each zone begins neutral.
    var CARD_EXIT_MS = 480, CARD_ENTER_MS = 700;   // exit 600→480ms: 25% faster fly-off
    if (lastCsel === undefined) lastCsel = csel;
    if (csel !== lastCsel) {
      var swapDir = csel > lastCsel ? 1 : -1;
      var FLY = vh / 16 + SPLAY_MAX;        // rem: full off-screen fly distance
      var splayWas = mSplay;                // splay the outgoing zone was sitting at
      // Seed the new zone's splay OPPOSITE to the travel direction (forward: left col
      // starts shifted DOWN, right col UP) so the columns have a full runway to drift
      // across the zone without hitting the viewport edge before the next threshold.
      // Zone 1 gets the same seed via its own entry swap (csel −1 → 0 at the pin).
      // Seeded FIRST so the entry offset below can be measured against the new baseline.
      var SPLAY_RUNWAY = 6;                 // rem head-start against the scroll direction
      mSplay = -swapDir * SPLAY_RUNWAY; splayVel = 0;
      if (lastCsel >= 0 && lastCsel < N) {
        var outPanel = panels[lastCsel];
        // The exit fires the INSTANT the threshold is hit, from wherever the columns
        // are right now — including mid-entry: fold the unfinished entry offset into
        // _exitFrom so the fly-off picks up at the current position instead of snapping
        // back to the splay first.
        var outBias = 0;
        if (outPanel._enterT0 !== undefined) {
          var ont = clamp((now - outPanel._enterT0) / CARD_ENTER_MS, 0, 1);
          var oef = (outPanel._enterFrom === undefined) ? -FLY * outPanel._enterDir : outPanel._enterFrom;
          outBias = oef * (1 - ont) * (1 - ont);
        }
        outPanel._exitT0 = now;             // fly-off starts now
        outPanel._exitDir = swapDir;        // forward: left up / right down; back: mirrored
        outPanel._exitFrom = splayWas + outBias;   // live splay + unfinished entry, no jump
        outPanel._exitTo = splayWas + FLY * swapDir;   // fixed off-screen target, so it always clears
        outPanel._enterT0 = undefined;      // exit overrides a still-running enter
      }
      if (csel >= 0 && csel < N) {
        var inPanel = panels[csel];
        // Entry eases into position from the far side (or, if this zone was still
        // flying OUT, from its live exit offset — so a reversal picks it up in place).
        var inFrom = -FLY * swapDir;
        if (inPanel._exitT0 !== undefined) {
          var iet = clamp((now - inPanel._exitT0) / CARD_EXIT_MS, 0, 1);
          inFrom = lerp(inPanel._exitFrom, inPanel._exitTo, iet) - mSplay;
        }
        inPanel._exitT0 = undefined;        // returning zone: cancel any old exit
        inPanel._enterT0 = now;             // fly IN from the opposite side of the exit
        inPanel._enterDir = swapDir;
        inPanel._enterFrom = inFrom;        // rem offset (vs the seeded splay) to ease away
      }
      lastCsel = csel;
    }
    panels.forEach(function (panel, pi) {
      var cardsEl = panel.querySelector(".flow-panel__cards");
      if (!cardsEl) return;
      var isActive = (pi === csel);
      var exiting = panel._exitT0 !== undefined && (now - panel._exitT0) < CARD_EXIT_MS;
      if (panel._exitT0 !== undefined && !exiting) panel._exitT0 = undefined;  // exit finished
      if (panel._enterT0 !== undefined && (now - panel._enterT0) >= CARD_ENTER_MS) panel._enterT0 = undefined;  // enter finished
      // The grid is stationary at REST_X (no horizontal slide), so what used to be a
      // per-frame _coff plus a 250ms history buffer — pushed and shifted every frame, per
      // panel, to feed a delayed column that no longer exists — is just this constant.
      panel._cardsOn = isActive || exiting;                   // grid is visible this frame
      var pinX = -(pi * vw + trackX);
      setSt(cardsEl, "transform", "translate(calc(-50% + " + (REST_X * F + pinX).toFixed(1) + "px),-50%)");
      setSt(cardsEl, "opacity", panel._cardsOn ? "1" : "0");
      // Hit-testable for the WHOLE of the active stage. This used to also require
      // |clocal| < 0.4, which left the outer fifth of every zone — the approach to each
      // threshold — visible but not hoverable, since refreshHover reads elementFromPoint
      // and pointer-events:none makes the cursor pass straight through. Being active is
      // the only condition that matters: the outgoing panel is not active while it plays
      // its exit, so only one panel is ever hit-testable.
      setSt(cardsEl, "pointerEvents", isActive ? "auto" : "none");
    });

    // Opposite-direction column parallax — VERTICAL ONLY (horizontal is the scroll-slide
    // above). From the reference nav-images: p = (clientY/vh − 0.5)·2·GAIN rem, left
    // column y = −p, right column y = +p, eased. mCY is the smoothed (clientY/vh − 0.5);
    // the 0.05 lerp stands in for GSAP's duration-2 ease.
    // GAIN is the reference's 6rem less 23% — the cards moved further with the cursor
    // than the effect wanted. Displacement only: the easing and the direction split are
    // untouched, so it tracks the cursor just as promptly, only 23% less far.
    var HOVER_GAIN = 4.62;          // rem at the top/bottom of the window (was 6)
    mCY += (mTY - mCY) * 0.05;
    var p = mCY * 2 * HOVER_GAIN;   // rem
    // Scroll-momentum column splay — the two columns part vertically (left up / right
    // down via o.dir) as a function of scroll, with a BLEED, not an ease-back. Two
    // terms: scroll moves the held offset (mSplay) DIRECTLY (SPLAY_GAIN — instant
    // reaction, no filter lag), while a small velocity tail (splayVel) charges up and
    // bleeds out through friction when the scroll stops, so it coasts to a slow stop
    // and HOLDS there (never snaps back to neutral); reverse the scroll and it travels
    // back the way it came. dGlobal = signed scroll delta this frame.
    var SPLAY_GAIN = 4;            // rem per zone of scroll, applied immediately
    var SPLAY_IMPULSE = 1.5;       // steady-state coast velocity per unit scroll rate (the bleed)
    var SPLAY_FRICTION = 0.92;     // per-frame bleed of the coast velocity after the scroll stops
    splayVel = splayVel * SPLAY_FRICTION + dGlobal * SPLAY_IMPULSE * (1 - SPLAY_FRICTION);
    mSplay = clamp(mSplay + dGlobal * SPLAY_GAIN + splayVel, -SPLAY_MAX, SPLAY_MAX);
    var pScroll = mSplay;          // rem (held; composes with the hover p above)
    // Per-card pose. The grid owns the horizontal placement; each card adds only the
    // COLUMN STAGGER — left column up, right column down — off a shared yRem, so the two
    // columns are exact mirrors and there are only ever TWO distinct poses per panel.
    //
    // What used to live here: a per-ROW diagonal entry/exit offset and a per-COLUMN
    // entrance delay, from the era when the grid slid horizontally across the stage
    // (R_END -> L_END, parking at OFF_L/OFF_R). That slide is gone — the grid is pinned at
    // REST_X, deliberately inside the old rest band — so every one of those terms
    // evaluated to a constant 0 on every frame: g was always 0, hence Math.pow(g,1.7) = 0,
    // hence diagTarget = 0; and coffDelayed() always returned REST_X, hence dx = 0. The
    // history buffer, its backward scan, the pow, the clamps and the settle lerps all
    // resolved to translate(0px,0px) for all 13 cards, every frame. Removed rather than
    // left computing zero.
    var FLY_REM = vh / 16 + SPLAY_MAX;          // loop-invariant (was recomputed per card)
    for (var pi2 = 0; pi2 < panels.length; pi2++) {
      var pnl = panels[pi2];
      // Skip panels whose grid is not on stage: it is opacity 0 AND a full viewport away,
      // so its cards were being transformed (and re-rasterised) invisibly. Three of the
      // four panels are in that state at any moment. The pose is a pure function of the
      // current scroll//timers, so a skipped panel is correct again on its first visible
      // frame — nothing to catch up.
      if (!pnl._cardsOn) continue;
      // yRem is PANEL-level (the enter/exit ramps live on the panel), so it is computed
      // once per panel instead of once per card.
      var yRem = p + pScroll;
      if (pnl._exitT0 !== undefined) {
        var et = clamp((now - pnl._exitT0) / CARD_EXIT_MS, 0, 1);
        yRem = p + lerp(pnl._exitFrom, pnl._exitTo, et);
      } else if (pnl._enterT0 !== undefined) {
        var nt = clamp((now - pnl._enterT0) / CARD_ENTER_MS, 0, 1);
        var ef = (pnl._enterFrom === undefined) ? -FLY_REM * pnl._enterDir : pnl._enterFrom;
        yRem = p + pScroll + ef * (1 - nt) * (1 - nt);   // ease-out: decelerates into place
      }
      // Two poses, two toFixed calls per panel — not three per card.
      var upPose = "translateY(" + (-yRem).toFixed(3) + "rem)";
      var downPose = "translateY(" + yRem.toFixed(3) + "rem)";
      var list = pnl._pcards;
      for (var k = 0; k < list.length; k++) {
        var o = list[k];
        setSt(o.el, "transform", o.dir < 0 ? upPose : downPose);
      }
    }

    // The spine (curve) is fixed; the nodes flow ALONG it in unison — left as you
    // scroll forward, right as you scroll back. Each node's x is driven directly
    // by scroll so the active node (global == i) sits dead-centre, and its y is
    // read off the fixed curve. The progress fill below still runs independently.
    // Scroll-bound creation: the spine draws on left→right over the first slice of
    // the section's scroll, then holds fully drawn. Bound to clamped progress so it
    // reverses (un-draws) when you scroll back out the top.
    var drawP = 0, drawnX = 0;
    if (lineEl && fillEl && fillLen) {
      // Completes when zone 2 centres (global == 1 → progress (1+0.5)/N).
      var DRAW_SPAN = (1 + 0.5) / N;          // fraction of section scroll to fully draw
      var lin = clamp(progress / DRAW_SPAN, 0, 1);
      // Power ease-out: decelerates continuously from the first frame (fast at the
      // start, crawling at the end), so it visibly "eases into" the slow end rather
      // than holding one speed then dropping. Slope starts at EASE×, ends at ~0.
      // Endpoints fixed (0→1), so total draw time over DRAW_SPAN is unchanged.
      var EASE = 2.5;
      drawP = 1 - Math.pow(1 - lin, EASE);
      var off = (fillLen * (1 - drawP)).toFixed(1);
      setSt(lineEl, "strokeDashoffset", off);
      setSt(fillEl, "strokeDashoffset", off);
      // viewBox x of the drawing frontier — nodes left of it have been "created".
      drawnX = curveXY.length ? curveXY[clamp(Math.round(drawP * (curveXY.length - 1)), 0, curveXY.length - 1)].x : 0;
    }

    if (nodesEl && curveXY.length) {
      var jw = geo.jw || vw;
      var SPACING = VBW * 0.42;               // viewBox gap between adjacent nodes
      nodeEls.forEach(function (n, i) {
        var vbX = VBW / 2 + (i - global) * SPACING;
        // Positioned by TRANSFORM, not left/top. left/top are LAYOUT properties: writing
        // them every frame dirtied layout for the whole document, so the next
        // getBoundingClientRect (this loop's own, at the top of the next frame) had to
        // pay for a full reflow of a 17,000px page. Measured at ~15.5ms/frame. A
        // transform composites and invalidates nothing. The -50%,-50% is the centring
        // that .flow-journey__node used to carry in CSS; percentages resolve against the
        // element's own box and px against the container, so the composed result is
        // identical to the old left/top placement.
        setSt(n, "transform", "translate(-50%,-50%) translate(" +
          (vbX / VBW * jw).toFixed(1) + "px," + yAtX(vbX).toFixed(1) + "px)");
        // Pop in one-by-one as the drawing frontier sweeps past each node (so the
        // first node appears, then the second…); once fully drawn all are present.
        n.classList.toggle("flow-journey__node--in", drawP >= 1 || vbX <= drawnX + 6);
        n.classList.toggle("flow-journey__node--active", i === active);
      });
    } else {
      nodeEls.forEach(function (n, i) { n.classList.toggle("flow-journey__node--active", i === active); });
    }

    if (dbg) updateDebug(progress, global);

    // Re-hit-test the hover while the cards are actually drifting under the cursor —
    // the scroll-slide (sceneScrolled) or the cursor parallax still easing (mTY≠mCY) —
    // so is-active follows the moving card even when the pointer itself is still.
    // (Deliberate cursor moves are already handled by the pointermove listener.) Gated
    // to skip the layout flush when nothing under the cursor is moving, and throttled —
    // elementFromPoint forces a style/layout flush, so at most ~11 hit-tests/s from the
    // loop (pointermove stays immediate); cards drift slowly enough that this tracks.
    // (the hit-test now runs at the TOP of the next frame — see hoverDue)
    hoverDue = hoverX >= 0 && (sceneScrolled || Math.abs(mTY - mCY) > 1e-4);

    schedule();
  }

  /* ---------- Debug overlay (?debug) ---------- */
  function updateDebug(progress, global) {
    var lines = [];
    lines.push("deskFx=" + deskFx + "  flow--gl=" + flow.classList.contains("flow--gl"));
    lines.push("rect.top=" + Math.round(flow.getBoundingClientRect().top));
    lines.push("progress=" + progress.toFixed(3) + " global=" + global.toFixed(2));
    dbg.textContent = lines.join("\n");
  }

  /* ---------- Boot ---------- */
  if (isMobile) {
    // Mobile: CSS stacks the stages and pins cards in normal flow. No GL / no pin.
    // (.flow__cd is display:none on mobile, so the terminal is skipped.)
    paintSky(0);
    return;
  }
  cdLineHeight();
  measureGeo();
  // Late layout shifts (web fonts swapping, images arriving) move sections in the
  // document, so re-measure once everything has settled rather than trusting boot.
  window.addEventListener("load", measureGeo);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureGeo);
  window.addEventListener("resize", function () {
    vh = window.innerHeight;
    measureGeo();
    cdLineHeight();
  });
  // .flow--gl is now purely a CSS hook: above 820px it hides .flow-panel__floats,
  // whose per-frame transform loop is skipped in step with it (see deskFx).
  if (deskFx) flow.classList.add("flow--gl");
  if (DEBUG) {
    dbg = document.createElement("pre");
    dbg.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:8px 10px;background:rgba(5,4,25,.85);color:#9cff9c;font:11px/1.4 monospace;white-space:pre;pointer-events:none;border-radius:6px;max-width:90vw";
    document.body.appendChild(dbg);
  }
  // Text colours are set once per zone (NOT scroll-lerped): zones 1-2 keep the
  // dark-bg colours (bright blue title, white index/sub via CSS defaults); zones
  // 3-4, which sit over the lightened bg, are set to their final deep-blue / grey
  // so each title POPS UP already in that colour when its zone appears.
  (function setupZoneText() {
    panels.forEach(function (panel, pi) {
      var list = panel.querySelector(".flow-panel__list");   // the 4 project/blog links
      if (pi < 2) {                                      // zones 1-2 (dark bg): list colour scroll-driven
        if (list) lightSubs.push(list);                  // ul colour cascades to the items (color:inherit)
        return;
      }
      panel.classList.add("flow-panel--light");          // light-bg zones: darker CLI green on the reel hover
      var ttl = panel.querySelector(".flow-panel__title");
      var idx = panel.querySelector(".flow-panel__index");
      if (ttl) ttl.style.color = "#231d7a";              // deep blue (darker than #3932DC)
      if (idx) idx.style.color = "#231d7a";
      if (list) list.style.color = "#3a3a42";            // dark grey (distinct from the navy heading)
    });
  })();
  paintSky(0);
  // Wake the (dormant-when-off-screen) loop on scroll/resize/tab-visible. Lenis drives a
  // smooth glide that keeps firing scroll events through the animation, so each tick re-arms.
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) schedule(); });
  if (window.__lenis && window.__lenis.on) window.__lenis.on("scroll", schedule);
  schedule();
})();
