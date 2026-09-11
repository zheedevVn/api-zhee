const sharp = require("sharp");

async function sendSvgAsPng(res, svg, statusCode = 200) {
  // Vercel's SVG renderer may not have Segoe UI/Roboto available. Normalize
  // every game label to an installed Unicode font before rasterizing so
  // Vietnamese text does not become tofu boxes in the PNG.
  const normalizedSvg = String(svg)
    .replace(/font-family="[^"]*"/gi, 'font-family="DejaVu Sans, sans-serif"')
    .replace(/font-family='[^']*'/gi, "font-family='DejaVu Sans, sans-serif'");
  const png = await sharp(Buffer.from(normalizedSvg)).png().toBuffer();
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.status(statusCode).send(png);
}

module.exports = { sendSvgAsPng };
