const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const FONT_PATH = path.join(process.cwd(), "lib", "NotoSans-Regular.ttf");
const FONT_DATA = fs.readFileSync(FONT_PATH).toString("base64");
const FONT_STYLE = `<style>
  @font-face {
    font-family: 'NotoSans';
    src: url('data:font/truetype;charset=utf-8;base64,${FONT_DATA}') format('truetype');
    font-weight: 100 900;
  }
  .text-label { font-family: 'NotoSans'; font-weight: 700; }
</style>`;

async function sendSvgAsPng(res, svg, statusCode = 200) {
  // Keep Vietnamese diacritics intact and embed the bundled Unicode font in
  // the SVG before Sharp rasterizes it inside a Vercel Serverless function.
  const normalizedSvg = String(svg)
    .replace(/font-family="[^"]*"/gi, 'font-family="NotoSans"')
    .replace(/font-family='[^']*'/gi, "font-family='NotoSans'")
    .replace(/<text\b(?![^>]*\bclass=)/gi, '<text class="text-label"')
    .replace(/<svg([^>]*)>/i, `<svg$1>${FONT_STYLE}`);
  const png = await sharp(Buffer.from(normalizedSvg)).png().toBuffer();
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.status(statusCode).send(png);
}

module.exports = { sendSvgAsPng };
