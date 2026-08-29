/**
 * Build every blog post page, and the blog index, from one manifest.
 *
 * Sources of truth:
 *   partials/posts.json          — one entry per post (title, dek, tags, date, images)
 *   partials/posts/<slug>.html   — the article body, from the first <p> to the last
 *
 * Written:
 *   blog/<slug>/index.html       — the whole page
 *   blog/index.html              — the card list, between BEGIN/END markers
 *
 * Run after editing either source:
 *
 *   node scripts/gen-post.mjs && node scripts/gen-partials.mjs
 *
 * gen-partials.mjs fills the header and footer into the markers this leaves behind,
 * so it has to run second on a brand-new page.
 *
 * Why a generator. A post's title is not written once — it appears in <title>, the
 * meta description block, four OG/Twitter tags, two JSON-LD blocks, the breadcrumb,
 * the <h1>, six share URLs (percent-encoded), the card on /blog/, and the "Keep
 * reading" card on every other post. That is roughly thirty places across five files
 * for one post, which is not editable by hand without drift. Retitling a post for
 * search is now a one-line change in the manifest.
 *
 * Everything ships as static HTML for the reason SEO.md gives for the project cards
 * and the footer: content built by JS is invisible to crawlers that do not render.
 *
 * Idempotent: re-running with no source change produces no diff.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://vishnujan.dev";
const AUTHOR = "Vishnujan Narayanan";

const posts = JSON.parse(readFileSync(resolve(root, "partials/posts.json"), "utf8"));

// Newest first, everywhere a list of posts is shown.
const ordered = [...posts].sort((a, b) => (a.published < b.published ? 1 : -1));

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

function monthYear(iso) {
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

// HTML text escaping: the five characters that change meaning inside markup or an
// attribute value. Titles carry apostrophes and quotes, so this is not optional.
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const url = (p) => `${SITE}/blog/${p.slug}/`;
const enc = (s) => encodeURIComponent(s);

// The six share targets. Each wants the URL and the title in its own parameter shape;
// they are generated rather than pasted because the title is percent-encoded into them
// and a retitled post would otherwise share under its old headline forever.
function shareRow(p) {
  const u = enc(url(p));
  const t = enc(p.title);
  const btn = (href, label, svg, extra = "") =>
    `      <a class="share-btn" href="${href}"${extra} aria-label="Share on ${label}" title="Share on ${label}">${svg}</a>`;
  const blank = ' target="_blank" rel="noopener"';
  return `<div class="share-row">
      <a class="share-btn" href="mailto:?subject=${t}&body=${t}%20${u}" aria-label="Share by email" title="Share by email">${SVG.mail}</a>
${btn(`https://twitter.com/intent/tweet?url=${u}&text=${t}`, "X", SVG.x, blank)}
${btn(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`, "LinkedIn", SVG.linkedin, blank)}
${btn(`https://www.facebook.com/sharer/sharer.php?u=${u}`, "Facebook", SVG.facebook, blank)}
${btn(`https://www.reddit.com/submit?url=${u}&title=${t}`, "Reddit", SVG.reddit, blank)}
${btn(`https://api.whatsapp.com/send?text=${t}%20${u}`, "WhatsApp", SVG.whatsapp, blank)}
    </div>`;
}

const SVG = {
  mail: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M17.2 3h3.3l-7.2 8.2L21.8 21h-6.6l-4.3-5.6L5.9 21H2.6l7.7-8.8L2.5 3h6.8l3.9 5.2L17.2 3Zm-1.2 16h1.8L8.1 4.8H6.2L16 19Z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M6.9 8.6H4.2V20h2.7V8.6ZM5.5 4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM20 13.4c0-2.9-1.6-4.3-3.6-4.3-1.7 0-2.4.9-2.8 1.5V8.6H10.9c0 .8 0 11.4 0 11.4h2.7v-6.4c0-.3 0-.6.1-.8.3-.6.8-1.2 1.7-1.2 1.2 0 1.7.9 1.7 2.2V20H20v-6.6Z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M14.5 8.5V6.9c0-.7.2-1.1 1.2-1.1h1.5V3.1C16.8 3 16 3 15.1 3c-2 0-3.4 1.2-3.4 3.5v2H9.3V11h2.4v8h2.8v-8h2.3l.4-2.5h-2.7Z"/></svg>',
  reddit: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M22 12.1a2.1 2.1 0 0 0-3.6-1.5 10.3 10.3 0 0 0-5.2-1.6l.9-4.2 2.9.6a1.5 1.5 0 1 0 .2-1.2l-3.4-.7a.6.6 0 0 0-.7.5l-1 4.7a10.4 10.4 0 0 0-5.3 1.6 2.1 2.1 0 1 0-2.3 3.4 3.8 3.8 0 0 0 0 .6c0 3 3.6 5.5 8 5.5s8-2.5 8-5.5a3.8 3.8 0 0 0 0-.6 2.1 2.1 0 0 0 1.5-2Zm-13.6 1.4a1.5 1.5 0 1 1 1.5 1.5 1.5 1.5 0 0 1-1.5-1.5Zm8.3 4a5.6 5.6 0 0 1-3.7 1.1 5.6 5.6 0 0 1-3.7-1.1.5.5 0 1 1 .7-.7 4.7 4.7 0 0 0 3 .8 4.7 4.7 0 0 0 3-.8.5.5 0 1 1 .7.7Zm-.2-2.5a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5Z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Zm0 1.7a7.3 7.3 0 1 1-3.7 13.6l-.3-.2-2.7.7.7-2.6-.2-.3A7.3 7.3 0 0 1 12 4.7Zm4.2 9.1c-.2-.1-1.3-.7-1.5-.7s-.4-.1-.5.1-.6.7-.7.9-.3.2-.5.1a6 6 0 0 1-1.8-1.1 6.6 6.6 0 0 1-1.2-1.6c-.1-.2 0-.4.1-.5l.4-.4a1.4 1.4 0 0 0 .2-.4.4.4 0 0 0 0-.4c0-.1-.5-1.3-.7-1.7s-.4-.4-.5-.4h-.4a.9.9 0 0 0-.6.3 2.6 2.6 0 0 0-.8 2 4.5 4.5 0 0 0 1 2.4 10.2 10.2 0 0 0 3.9 3.4c1.8.7 1.8.5 2.2.4a2.3 2.3 0 0 0 1.5-1.1 1.9 1.9 0 0 0 .1-1.1c0-.1-.2-.2-.4-.3Z"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
  like: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 6.6a5 5 0 0 0-7.1 0l-1.7 1.7-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>',
};

// Every page carries the author suffix, so a search for the name returns the whole site
// with one consistent shape rather than a mix of branded and unbranded results. Titles in
// posts.json are kept short enough (<= 48 chars) that title + suffix stays inside 70 and
// the name is not what gets truncated. The check below fails the build instead of silently
// dropping the brand, which is how four posts lost it before.
function pageTitle(p) {
  const withAuthor = `${p.title} — ${AUTHOR}`;
  if (withAuthor.length > 70) {
    throw new Error(`title too long for the author suffix (${withAuthor.length} > 70): ${p.title}`);
  }
  return withAuthor;
}

const tagRow = (p) => `<div class="tag-row">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>`;

function head(p) {
  const u = url(p);
  const share = SITE + p.share;
  const article = {
    "@context": "https://schema.org", "@type": "Article", headline: p.title,
    description: p.description, image: share,
    datePublished: p.published, dateModified: p.published,
    author: { "@type": "Person", name: AUTHOR, url: `${SITE}/` },
    publisher: { "@type": "Person", name: AUTHOR },
    mainEntityOfPage: u,
  };
  const crumbs = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog/` },
      { "@type": "ListItem", position: 3, name: p.title, item: u },
    ],
  };
  return `<!DOCTYPE html>
<html lang="en-US" class="lenis no-js">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(pageTitle(p))}</title>
<meta name="description" content="${esc(p.description)}">
<meta name="author" content="${AUTHOR}">
<meta property="article:author" content="https://www.linkedin.com/in/vishnujan-narayanan">
<meta property="article:published_time" content="${p.published}">
<meta property="article:modified_time" content="${p.published}">
<link rel="icon" href="../../favicon.ico?v=3" sizes="any">
<link rel="icon" type="image/png" href="../../favicon-512.png?v=3" sizes="512x512">
<link rel="apple-touch-icon" href="../../apple-touch-icon.png?v=3">
<link rel="canonical" href="${u}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.shareDescription || p.description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${AUTHOR}">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${share}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="${esc(p.title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.shareDescription || p.description)}">
<meta name="twitter:image" content="${share}">
<!-- Roboto Flex is the nav reel's font (styles.css @font-face). Preloaded so it is in
     flight before the stylesheet finishes parsing and is ready for the FIRST paint —
     no fallback render to swap out, which is what made the header snap. crossorigin is
     required even same-origin: fonts are always fetched in CORS mode. -->
<link rel="preload" href="/fonts/roboto-flex-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;900&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../../styles.css">
<script>document.documentElement.classList.remove("no-js");</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
<script type="application/ld+json">${JSON.stringify(article)}</script>
</head>`;
}

// The three most recent other posts. Generated per page so a new post appears at the
// foot of the existing ones without touching them by hand.
function keepReading(current) {
  const others = ordered.filter((p) => p.slug !== current.slug).slice(0, 3);
  const cards = others.map((p) => `      <a class="post-card post-card--sm" href="/blog/${p.slug}/">
        <div class="post-card__media">
          <img src="${p.image}" alt="" width="1000" height="1000" loading="lazy" decoding="async">
        </div>
        <div class="post-card__body">
          ${tagRow({ tags: p.tags.filter((t) => t !== "Featured") })}
          <h3 class="post-card__title">${esc(p.title)}</h3>
          <div class="byline"><span class="byline__date">${monthYear(p.published)}</span></div>
          <p class="post-card__excerpt">${esc(p.dek)}</p>
        </div>
      </a>`).join("\n");
  return `<section class="keep-reading" aria-labelledby="keep-reading-h">
  <div class="keep-reading__inner">
    <h2 class="keep-reading__title" id="keep-reading-h">Keep reading</h2>
    <div class="post-grid post-grid--sm">
${cards}
    </div>

  </div>
</section>`;
}

function page(p) {
  const body = readFileSync(resolve(root, `partials/posts/${p.slug}.html`), "utf8").trimEnd();
  return `${head(p)}
<body class="subpage-body post-body blog-body">
<div class="mobile-nav__overlay"></div>
<!-- BEGIN generated: header (source: partials/header.html — run scripts/gen-partials.mjs) -->
<!-- END generated: header -->
<main>
<aside class="post-rail" aria-label="Post actions">
  <a class="post-rail__btn" href="/blog/" aria-label="Back to all writing" title="Back to all writing">
    ${SVG.back}
  </a>
  <button class="post-rail__btn" type="button" data-like aria-pressed="false" aria-label="Like this post" title="Like this post">
    ${SVG.like}
  </button>
  <button class="post-rail__btn" type="button" data-share="${url(p)}" aria-label="Share this post" title="Share this post">
    ${SVG.share}
  </button>
  <span class="post-rail__toast" data-share-toast hidden>Link copied</span>
</aside>
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/blog/">Blog</a><span>›</span>${esc(p.title)}</nav>
<article class="article">
  <div class="post-head">
    ${tagRow({ tags: p.tags.filter((t) => t !== "Featured") })}
    <h1>${esc(p.h1)}</h1>
    <div class="post-head__foot">
    <div class="byline byline--lg">
        <img class="byline__avatar" src="/images/blog/avatar-vj.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">
        <span class="byline__name">${AUTHOR}</span>
        <span class="byline__sep" aria-hidden="true">·</span>
        <span class="byline__date">${monthYear(p.published)}</span>
      </div>
${shareRow(p)}
    </div>
    <p class="post-head__dek">${esc(p.dek)}</p>
  </div>
  <figure class="post-hero">
    <img src="${p.image}" alt="" width="1000" height="1000" fetchpriority="high" decoding="async">
  </figure>

${body}
</article>

${keepReading(p)}
</main>
<!-- BEGIN generated: footer (source: partials/footer.html — run scripts/gen-partials.mjs) -->
<!-- END generated: footer -->
<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js" defer></script>
<script src="../../main.js" defer></script>
</body>
</html>
`;
}

// The blog index: one feature card, then the rest in a grid, newest first.
function indexList() {
  const feature = ordered.find((p) => p.featured) || ordered[0];
  const rest = ordered.filter((p) => p !== feature);
  const cards = rest.map((p) => `    <a class="post-card" href="/blog/${p.slug}/">
      <div class="post-card__media">
        <img src="${p.image}" alt="" width="1000" height="1000" loading="lazy" decoding="async">
      </div>
      <div class="post-card__body">
        ${tagRow(p)}
        <h2 class="post-card__title">${esc(p.title)}</h2>
        <div class="byline">
          <img class="byline__avatar" src="/images/blog/avatar-vj.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">
          <span class="byline__name">${AUTHOR}</span>
          <span class="byline__sep" aria-hidden="true">·</span>
          <span class="byline__date">${monthYear(p.published)}</span>
        </div>
        <p class="post-card__excerpt">${esc(p.dek)}</p>
      </div>
    </a>`).join("\n");

  return `  <a class="feature-card" href="/blog/${feature.slug}/">
    <div class="feature-card__media">
      <img src="${feature.image}" alt="" width="1000" height="1000" loading="lazy" decoding="async">
    </div>
    <div class="feature-card__body">
      ${tagRow(feature)}
      <h2 class="feature-card__title">${esc(feature.title)}</h2>
      <div class="byline">
        <img class="byline__avatar" src="/images/blog/avatar-vj.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">
        <span class="byline__name">${AUTHOR}</span>
        <span class="byline__sep" aria-hidden="true">·</span>
        <span class="byline__date">${monthYear(feature.published)}</span>
      </div>
      <p class="feature-card__excerpt">${esc(feature.dek)}</p>
    </div>
  </a>

  <div class="post-grid">
${cards}
  </div>`;
}

// The homepage "Blogs" accordion: every post, newest first. The geometry is
// count-agnostic (main.js divides the stack width by N; a closed strip is
// clamp(64px,7vw,108px)), so nine panels still fit the narrowest desktop the
// accordion runs at — checked at 850px, where 9 strips + one open content column
// come to ~806px. If the blog grows past what fits, cap this list rather than
// letting the strips overflow.
const PANEL_WEIGHTS = ["thin", "light", "regular", "regular", "thin", "light", "regular", "thin", "light"];
// The rail label is set sideways in a ~90px strip, so it needs the short form.
const RAIL_SHORT = {
  "Data engineering": "Data eng",
  "Machine learning": "ML",
  "Web scraping": "Scraping",
  Infrastructure: "Infra",
  Reliability: "Reliability",
};
function homePanels() {
  return ordered.map((p, i) => {
    const cat = p.tags.filter((t) => t !== "Featured")[0] || "Writing";
    const vert = esc(RAIL_SHORT[cat] || cat).replace(/ /g, "&nbsp;");
    return `        <article class="wpanel">
          <div class="wpanel__rail" aria-hidden="true"><span class="wpanel__vert">${vert}</span><span class="wpanel__num">${String(i + 1).padStart(2, "0")}</span></div>
          <div class="wpanel__content">
            <div class="wpanel__meta"><span>${esc(cat)}</span></div>
            <h2 class="wpanel__title wpanel__title--${PANEL_WEIGHTS[i % PANEL_WEIGHTS.length]}">${esc(p.title)}</h2>
            <p class="wpanel__text">${esc(p.dek)}</p>
          </div>
          <a class="wpanel__link" href="/blog/${p.slug}/" aria-label="Read: ${esc(p.title)}">Read &rarr;</a>
        </article>`;
  }).join("\n\n");
}

let written = 0;
for (const p of ordered) {
  const dir = resolve(root, "blog", p.slug);
  if (!existsSync(resolve(root, `partials/posts/${p.slug}.html`))) {
    console.warn(`skip ${p.slug} (no body at partials/posts/${p.slug}.html)`);
    continue;
  }
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, "index.html");
  const next = page(p);
  const before = existsSync(file) ? readFileSync(file, "utf8") : null;
  // The header/footer markers are filled by gen-partials.mjs after this runs, so a
  // rebuild must not wipe them back to empty on every invocation.
  const merged = before ? carryPartials(next, before) : next;
  if (merged !== before) { writeFileSync(file, merged); written++; console.log(`wrote blog/${p.slug}/index.html`); }
  else console.log(`unchanged blog/${p.slug}/index.html`);
}

// Keep whatever gen-partials.mjs already injected between the header/footer markers.
function carryPartials(next, before) {
  for (const name of ["header", "footer"]) {
    const begin = `<!-- BEGIN generated: ${name} (source: partials/${name}.html — run scripts/gen-partials.mjs) -->`;
    const end = `<!-- END generated: ${name} -->`;
    const re = new RegExp(escapeRe(begin) + "([\\s\\S]*?)" + escapeRe(end));
    const had = before.match(re);
    if (had && had[1].trim()) next = next.replace(re, () => begin + had[1] + end);
  }
  return next;
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Splice the card list into blog/index.html.
{
  const file = resolve(root, "blog/index.html");
  const begin = "<!-- BEGIN generated: post list (source: partials/posts.json — run scripts/gen-post.mjs) -->";
  const end = "<!-- END generated: post list -->";
  const before = readFileSync(file, "utf8");
  const rendered = `${begin}\n${indexList()}\n${end}`;
  let html;
  if (before.includes(begin)) {
    html = before.replace(new RegExp(escapeRe(begin) + "[\\s\\S]*?" + escapeRe(end)), () => rendered);
  } else {
    // First run: adopt the hand-written list inside .post-list.
    html = before.replace(/(<div class="post-list">\n)[\s\S]*?(\n<\/div>)/, (_m, a, b) => a + rendered + b);
  }
  if (html !== before) { writeFileSync(file, html); written++; console.log("wrote blog/index.html"); }
  else console.log("unchanged blog/index.html");
}

// Publish slug -> cover image for the flow section.
//
// The flow cards used to render blog entries as a flat gradient because flow.js had
// no way to find a post's image: CARD_DATA carries only a name, a dek and an href.
// Emitting the map here means the picture is resolved from the href at render time,
// so swapping which post appears in a zone — a one-line edit in CARD_DATA — brings
// its cover with it. Same reasoning as window.__PROJECT_MEDIA in main.js: the media
// belongs to the manifest, not to the surface displaying it.
function blogMedia() {
  const map = {};
  for (const p of ordered) map[`/blog/${p.slug}/`] = p.image;
  return `<script>window.__BLOG_MEDIA=${JSON.stringify(map)};</script>`;
}

// Splice that map into index.html, ahead of the deferred scripts that read it.
{
  const file = resolve(root, "index.html");
  const begin = "<!-- BEGIN generated: blog media (source: partials/posts.json — run scripts/gen-post.mjs) -->";
  const end = "<!-- END generated: blog media -->";
  const before = readFileSync(file, "utf8");
  const rendered = `${begin}\n${blogMedia()}\n${end}`;
  let html;
  if (before.includes(begin)) {
    html = before.replace(new RegExp(escapeRe(begin) + "[\\s\\S]*?" + escapeRe(end)), () => rendered);
  } else {
    html = before.replace(/(\n<script src="main\.js" defer><\/script>)/, (_m, a) => `\n${rendered}${a}`);
  }
  if (html !== before) { writeFileSync(file, html); written++; console.log("wrote index.html (blog media)"); }
  else console.log("unchanged index.html (blog media)");
}

// Splice the homepage panels into index.html.
{
  const file = resolve(root, "index.html");
  const begin = "<!-- BEGIN generated: writing panels (source: partials/posts.json — run scripts/gen-post.mjs) -->";
  const end = "<!-- END generated: writing panels -->";
  const before = readFileSync(file, "utf8");
  const rendered = `${begin}\n${homePanels()}\n${end}`;
  let html;
  if (before.includes(begin)) {
    html = before.replace(new RegExp(escapeRe(begin) + "[\\s\\S]*?" + escapeRe(end)), () => rendered);
  } else {
    // First run: adopt the hand-written panels inside .wstack.
    html = before.replace(/(<div class="wstack">\n)[\s\S]*?(\n\s*<\/div>\s*\n\s*<\/div><!-- \/\.writing__pin -->)/,
      (_m, a, b) => a + rendered + b);
  }
  // More than six panels no longer fit at the default strip width, so the section
  // carries a modifier class the stylesheet uses to narrow the strips.
  const dense = ordered.length > 6;
  html = html.replace(/<section class="writing( writing--dense)?"/,
    () => `<section class="writing${dense ? " writing--dense" : ""}"`);

  if (html !== before) { writeFileSync(file, html); written++; console.log("wrote index.html"); }
  else console.log("unchanged index.html");
}

console.log(`\n${ordered.length} posts, ${written} files written`);
