const fs = require("fs");
const path = require("path");

// Vercel bundles the font beside this module, but does not register it with
// fontconfig. Point librsvg/fontconfig at the bundled directory before Sharp
// is loaded so SVG text resolves to real glyphs instead of tofu boxes.
process.env.FONTCONFIG_FILE = process.env.FONTCONFIG_FILE || path.join(__dirname, "fonts.conf");
const sharp = require("sharp");

const FONT_PATH = path.join(__dirname, "NotoSans-Regular.ttf");
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

async function sendSvgAsPng(res, svg, statusCode = 200) {
  // Keep Vietnamese diacritics intact and embed the bundled Unicode font in
  // the SVG before Sharp rasterizes it inside a Vercel Serverless function.
  const normalizedSvg = String(svg)
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
