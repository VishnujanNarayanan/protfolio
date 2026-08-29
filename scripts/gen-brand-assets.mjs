#!/usr/bin/env node
/**
 * Builds every brand image from ONE source: the logo in "logo design/".
 *
 * Outputs (all committed, all referenced by the pages):
 *   images/logo-mark.png   the logo trimmed, outer white flood-filled to alpha
 *   og-logo.jpg            1200x630 share card — the mark on a white rounded
 *                          plate over the footer's blue contour field
 *   favicon-512.png        512x512, mark on white (search results, PWA)
 *   apple-touch-icon.png   180x180, same (iOS has no transparency)
 *   favicon.ico            16/32/48 bundle
 *
 * The contour field is lifted from the previous og-card.jpg rather than
 * redrawn, so the card keeps the exact background of the one it replaces; only
 * the plate and the mark on it change.
 *
 * The outer white is cleared with -floodfill from the four corners, NOT
 * -transparent white: the mark's internal channels are white too, and they have
 * to stay white — they are what separates the three cube faces. That is also
 * why the plate is white and not the site's navy: on a dark plate those
 * channels read as gaps and the navy face of the cube melts into the plate.
 *
 * Re-run after changing the source logo:  node scripts/gen-brand-assets.mjs
 * A NEW share-card filename is required whenever the picture changes —
 * LinkedIn, Facebook and WhatsApp cache previews by image URL, so reusing a
 * name keeps serving the old picture until their caches age out (same reason
 * og-cover.jpg became og-card.jpg). Bump the ?v= on the icon links too.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const SRC = "logo design/logo version 1.png";
const BG = "og-card.jpg";            // background donor: the blue contour field
const MARK = "images/logo-mark.png";
const magick = (...a) => execFileSync("convert", a, { stdio: ["ignore", "inherit", "inherit"] });

mkdirSync("images", { recursive: true });

// 1. The mark, trimmed and cut out of its white page.
const size = execFileSync("identify", ["-format", "%w %h", SRC], { encoding: "utf8" }).split(" ");
const [w, h] = size.map(Number);
magick(SRC, "-alpha", "set", "-fuzz", "12%", "-fill", "none",
  "-floodfill", "+0+0", "white",
  "-floodfill", `+${w - 1}+0`, "white",
  "-floodfill", `+0+${h - 1}`, "white",
  "-floodfill", `+${w - 1}+${h - 1}`, "white",
  "-trim", "+repage",
  // flat art: a 64-colour palette is lossless to the eye and 5x smaller
  "-strip", "-colors", "64", "+dither", MARK);

// 2. Share card: white rounded plate (360px) centred on the donor background.
magick(BG, "-fill", "white", "-draw", "roundrectangle 420,135 780,495 76,76",
  "(", MARK, "-resize", "x272", ")", "-gravity", "center", "-composite",
  "-strip", "-interlace", "Plane", "-quality", "88", "og-logo.jpg");

// 3. Icons: the mark on white, with margin — search engines and launchers crop
//    to a circle, so the cube must not touch the edges.
const icon = (px, out) =>
  magick("(", MARK, "-resize", `${Math.round(px * 0.78)}x${Math.round(px * 0.78)}`, ")",
    "-background", "white", "-gravity", "center", "-extent", `${px}x${px}`,
    "-strip", out);
icon(512, "favicon-512.png");
icon(180, "apple-touch-icon.png");
magick("favicon-512.png", "-define", "icon:auto-resize=48,32,16", "favicon.ico");

console.log("wrote images/logo-mark.png og-logo.jpg favicon-512.png apple-touch-icon.png favicon.ico");
