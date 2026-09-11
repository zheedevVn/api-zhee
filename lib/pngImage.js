const sharp = require("sharp");

async function sendSvgAsPng(res, svg, statusCode = 200) {
  const png = await sharp(Buffer.from(String(svg))).png().toBuffer();
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.status(statusCode).send(png);
}

module.exports = { sendSvgAsPng };
