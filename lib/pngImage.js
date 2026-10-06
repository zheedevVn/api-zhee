/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
const fs = require("fs");
const path = require("path");

// Vercel bundles the font beside this module, but does not register it with
// fontconfig. Point librsvg/fontconfig at the bundled directory before Sharp
// is loaded so SVG text resolves to real glyphs instead of tofu boxes.
process.env.FONTCONFIG_FILE = process.env.FONTCONFIG_FILE || path.join(__dirname, "fonts.conf");
const sharp = require("sharp");
const opentype = require("opentype.js");

const FONT_PATH = path.join(__dirname, "NotoSans-Regular.ttf");
const FONT = opentype.loadSync(FONT_PATH);
const FONT_DATA = fs.readFileSync(FONT_PATH).toString("base64");
const FONT_STYLE = `<style>
  @font-face {
    font-family: 'Noto Sans';
    src: url('data:font/ttf;base64,${FONT_DATA}') format('truetype');
    font-style: normal;
    font-weight: 400;
  }
  .text-label {
    font-family: 'Noto Sans', sans-serif;
    font-style: normal;
    font-weight: 400;
  }
</style>`;

function decodeXmlText(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function svgTextToPaths(svg) {
  return String(svg).replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi, (full, attrs, rawText) => {
    const text = decodeXmlText(rawText).replace(/<[^>]+>/g, "");
    if (!text || [...text].some((char) => char.codePointAt(0) > 0xffff || FONT.charToGlyphIndex(char) === 0)) return full;
    const x = Number.parseFloat((attrs.match(/\bx=["']([^"']+)["']/i) || [])[1] || "0");
    const y = Number.parseFloat((attrs.match(/\by=["']([^"']+)["']/i) || [])[1] || "0");
    const size = Number.parseFloat((attrs.match(/\bfont-size=["']([^"']+)["']/i) || [])[1] || "16");
    const anchor = ((attrs.match(/\btext-anchor=["']([^"']+)["']/i) || [])[1] || "start").toLowerCase();
    const width = FONT.getAdvanceWidth(text, size);
    const offset = anchor === "middle" ? width / 2 : anchor === "end" ? width : 0;
    const pathData = FONT.getPath(text, x - offset, y, size).toPathData(2);
    const fill = (attrs.match(/\bfill=["']([^"']+)["']/i) || [])[1] || "currentColor";
    const opacity = (attrs.match(/\b(?:fill-opacity|opacity)=["']([^"']+)["']/i) || [])[1];
    return `<path d="${pathData}" fill="${fill}"${opacity ? ` opacity="${opacity}"` : ""}/>`;
  });
}

async function sendSvgAsPng(res, svg, statusCode = 200) {
  // Convert supported text to vector paths. This avoids relying on the
  // production runtime's fontconfig cache and makes every bundled game use
  // the same readable glyphs, including Vietnamese diacritics.
  const normalizedSvg = svgTextToPaths(String(svg))
    .replace(/font-family="[^"]*"/gi, 'font-family="Noto Sans"')
    .replace(/font-family='[^']*'/gi, "font-family='Noto Sans'")
    .replace(/font-weight="(?:100|200|300|500|600|700|800|900)"/gi, 'font-weight="400"')
    .replace(/<text\b(?![^>]*\bclass=)/gi, '<text class="text-label"')
    .replace(/<svg([^>]*)>/i, `<svg$1>${FONT_STYLE}`);
  const png = await sharp(Buffer.from(normalizedSvg)).png().toBuffer();
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.status(statusCode).send(png);
}

module.exports = { sendSvgAsPng };
