const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const FONT_DATA = fs.readFileSync(path.join(__dirname, "NotoSans-Regular.ttf")).toString("base64");
const FONT_STYLE = `<style>@font-face{font-family:NotoEmbedded;src:url(data:font/ttf;base64,${FONT_DATA}) format('truetype');font-weight:100 900}text{font-family:NotoEmbedded, sans-serif}</style>`;

async function sendSvgAsPng(res, svg, statusCode = 200) {
  // Embed the Unicode font because Vercel's SVG renderer may not have
  // Vietnamese glyphs installed. This prevents tofu boxes in every game PNG.
  const normalizedSvg = String(svg)
    // Use the renderer's plain sans-serif stack for the final raster pass.
    // The bundled font remains available for environments that honor the
    // embedded style, while ASCII fallback guarantees visible labels.
    .replace(/font-family="[^"]*"/gi, 'font-family="sans-serif"')
    .replace(/font-family='[^']*'/gi, "font-family='sans-serif'")
    .replace(/<svg([^>]*)>/i, `<svg$1>${FONT_STYLE}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d");
  const png = await sharp(Buffer.from(normalizedSvg)).png().toBuffer();
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.status(statusCode).send(png);
}

module.exports = { sendSvgAsPng };
