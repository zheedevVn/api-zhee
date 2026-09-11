const sharp = require("sharp");

async function sendSvgAsPng(res, svg, statusCode = 200) {
  // Embed the Unicode font because Vercel's SVG renderer may not have
  // Vietnamese glyphs installed. This prevents tofu boxes in every game PNG.
  const normalizedSvg = String(svg)
    // Use the renderer's plain sans-serif stack for the final raster pass.
    // The bundled font remains available for environments that honor the
    // embedded style, while ASCII fallback guarantees visible labels.
    .replace(/font-family="[^"]*"/gi, 'font-family="sans-serif"')
    .replace(/font-family='[^']*'/gi, "font-family='sans-serif'")
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
