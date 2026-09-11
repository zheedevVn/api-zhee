const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const FONT_DATA = fs.readFileSync(path.join(__dirname, "NotoSans-Regular.ttf")).toString("base64");
const FONT_STYLE = `<style>@font-face{font-family:NotoEmbedded;src:url(data:font/ttf;base64,${FONT_DATA}) format('truetype');font-weight:400}text{font-family:NotoEmbedded,sans-serif}</style>`;

async function sendSvgAsPng(res, svg, statusCode = 200) {
  // Keep Vietnamese diacritics intact and embed the bundled Unicode font in
  // the SVG before Sharp rasterizes it inside a Vercel Serverless function.
  const normalizedSvg = String(svg)
    .replace(/font-family="[^"]*"/gi, 'font-family="NotoEmbedded,sans-serif"')
    .replace(/font-family='[^']*'/gi, "font-family='NotoEmbedded,sans-serif'")
    .replace(/<svg([^>]*)>/i, `<svg$1>${FONT_STYLE}`);
  const png = await sharp(Buffer.from(normalizedSvg)).png().toBuffer();
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.status(statusCode).send(png);
}

module.exports = { sendSvgAsPng };
