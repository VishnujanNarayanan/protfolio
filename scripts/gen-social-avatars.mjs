#!/usr/bin/env node
/**
 * Pulls each socials card's avatar from that platform and bakes it into
 * index.html as a locally-served image.
 *
 * The GitHub card already updates itself: https://github.com/<user>.png is a
 * stable redirect to the current avatar, so the card follows the profile. The
 * DEV, Substack and LinkedIn cards were pointed at that same GitHub URL, so all
 * four showed the GitHub picture no matter what those profiles actually show.
 *
 * DEV and Substack both expose the avatar on a public JSON endpoint, so they are
 * fetched here at BUILD time and written to images/socials/ rather than
 * hot-linked: dev.to's media2.dev.to URL embeds an upload id that changes on
 * every avatar change (a stale one 404s), Substack's S3 URL likewise, and
 * neither host promises to stay hot-linkable. Downloading also keeps the page
 * free of third-party image requests. Re-run to refresh:
 *
 *     node scripts/gen-social-avatars.mjs
 *
 * LinkedIn has no equivalent: an unauthenticated request to a public profile
 * returns HTTP 999 (bot block), and media.licdn.com photo URLs are signed and
 * expire. So the LinkedIn card reuses the Substack avatar (the same headshot) —
 * it points straight at substack-avatar.jpg, so it still follows the Substack
 * profile on every run. To give it its own picture instead, run with a URL
 * copied from the live profile:
 *
 *     LINKEDIN_PHOTO_URL="https://media.licdn.com/..." node scripts/gen-social-avatars.mjs
 *
 * which writes images/socials/linkedin-avatar.jpg and points the card there.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const OUT_DIR = "images/socials";
const SIZE = 200;                       // 2x the largest display box (88px LinkedIn)

// node's fetch can't reach some hosts from this WSL sandbox where curl can, so
// curl is the fallback — same pattern as gen-gh-contrib.mjs.
function getJSON(url) {
  return JSON.parse(execFileSync("curl", ["-sfL", "-m", "30", url], { encoding: "utf8", maxBuffer: 1 << 24 }));
}
function download(url, dest) {
  execFileSync("curl", ["-sfL", "-m", "60", "-A", "Mozilla/5.0", "-o", dest, url]);
}
// Square, centre-cropped, stripped of EXIF, and progressive so it paints early.
function square(src, dest) {
  execFileSync("convert", [src, "-auto-orient", "-resize", `${SIZE}x${SIZE}^`,
    "-gravity", "center", "-extent", `${SIZE}x${SIZE}`,
    "-strip", "-interlace", "Plane", "-quality", "86", dest]);
}

mkdirSync(OUT_DIR, { recursive: true });
const tmp = `${OUT_DIR}/.tmp-avatar`;
const written = [];

// ---- DEV Community -------------------------------------------------------
{
  const u = getJSON("https://dev.to/api/users/by_username?url=vishnujannarayanan");
  if (!u.profile_image) throw new Error("dev.to: no profile_image in the API response");
  download(u.profile_image, tmp);
  square(tmp, `${OUT_DIR}/devto-avatar.jpg`);
  written.push(["dev.to", u.name]);
}

// ---- Substack ------------------------------------------------------------
{
  const u = getJSON("https://substack.com/api/v1/user/vishnujannarayanan/public_profile");
  if (!u.photo_url) throw new Error("substack: no photo_url in the API response");
  download(u.photo_url, tmp);
  square(tmp, `${OUT_DIR}/substack-avatar.jpg`);
  written.push(["substack", u.name]);
}

// ---- LinkedIn (no public endpoint — see the header) ----------------------
let linkedinSrc = `${OUT_DIR}/substack-avatar.jpg`;
{
  const url = process.env.LINKEDIN_PHOTO_URL;
  if (url) {
    linkedinSrc = `${OUT_DIR}/linkedin-avatar.jpg`;
    download(url, tmp);
    square(tmp, linkedinSrc);
    written.push(["linkedin", "from LINKEDIN_PHOTO_URL"]);
  } else written.push(["linkedin", "reusing the Substack avatar"]);
}

try { execFileSync("rm", ["-f", tmp]); } catch {}

// ---- Splice the srcs into index.html -------------------------------------
const SRCS = {
  "soc-card__dv-avatar": `${OUT_DIR}/devto-avatar.jpg`,
  "soc-card__ss-avatar": `${OUT_DIR}/substack-avatar.jpg`,
  "soc-card__li-avatar": linkedinSrc,
};
const FILE = "index.html";
let html = readFileSync(FILE, "utf8");
const before = html;
for (const [cls, src] of Object.entries(SRCS)) {
  const re = new RegExp(`(<img class="${cls}"[^>]*?\\ssrc=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`${FILE}: no <img class="${cls}"> to update`);
  html = html.replace(re, `$1${src.replace(/ /g, "%20")}$2`);
}
if (html !== before) writeFileSync(FILE, html);

for (const [k, v] of written) console.log(`${k}: ${v}`);
console.log(html === before ? `${FILE}: unchanged` : `${FILE}: avatar srcs updated`);
