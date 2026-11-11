import sharp from 'sharp';

// A4 at 300 dpi – the only resolution cheap AirPrint inkjets tend to accept.
const DPI = 300;
const PAGE_WIDTH_PX = 2480;
const PAGE_HEIGHT_PX = 3508;
const PAGE_WIDTH_PT = 595;
const PAGE_HEIGHT_PT = 842;
const MARGIN_PX = 60; // ~5 mm, keeps the drawing inside the printable area
const BLACK_THRESHOLD = 150;

const HEADER_SIZE = 1796;
const COLOR_SPACE_SGRAY = 18;
const WHITE = 0xff;

const buildHeader = (pageSizeName: string): Buffer => {
  const header = Buffer.alloc(HEADER_SIZE);
  header.write('PwgRaster', 0, 'ascii');
  header.writeUInt32BE(DPI, 276); // HWResolution x
  header.writeUInt32BE(DPI, 280); // HWResolution y
  header.writeUInt32BE(1, 340); // NumCopies
  header.writeUInt32BE(PAGE_WIDTH_PT, 352);
  header.writeUInt32BE(PAGE_HEIGHT_PT, 356);
  header.writeUInt32BE(PAGE_WIDTH_PX, 372); // cupsWidth
  header.writeUInt32BE(PAGE_HEIGHT_PX, 376); // cupsHeight
  header.writeUInt32BE(8, 384); // BitsPerColor
  header.writeUInt32BE(8, 388); // BitsPerPixel
  header.writeUInt32BE(PAGE_WIDTH_PX, 392); // BytesPerLine
  header.writeUInt32BE(0, 396); // ColorOrder: chunky
  header.writeUInt32BE(COLOR_SPACE_SGRAY, 400);
  header.writeUInt32BE(1, 420); // NumColors
  header.writeUInt32BE(1, 452); // TotalPageCount
  header.writeUInt32BE(1, 456); // CrossFeedTransform
  header.writeUInt32BE(1, 460); // FeedTransform
  header.writeUInt32BE(0x00ffffff, 480); // AlternatePrimary: white
  header.write(pageSizeName, 1732, 'ascii');
  return header;
};

// PackBits-style encoding of a single 8-bit line, as defined by PWG 5102.4.
const encodeLine = (pixels: Buffer, start: number, width: number, out: number[]): void => {
  const end = start + width;
  let i = start;
  while (i < end) {
    let run = 1;
    while (i + run < end && run < 128 && pixels[i + run] === pixels[i]) run++;
    if (run > 1) {
      out.push(run - 1, pixels[i]);
      i += run;
      continue;
    }
    let literal = 1;
    while (i + literal < end && literal < 128 && pixels[i + literal] !== pixels[i + literal - 1]) literal++;
    // Leave the last pixel for the following repeat run when one starts there
    if (i + literal < end && literal > 1 && pixels[i + literal] === pixels[i + literal - 1]) literal--;
    if (literal === 1) {
      out.push(0, pixels[i]);
    } else {
      out.push(257 - literal);
      for (let k = 0; k < literal; k++) out.push(pixels[i + k]);
    }
    i += literal;
  }
};

const encodePage = (pixels: Buffer, width: number, height: number): Buffer => {
  const out: number[] = [];
  let y = 0;
  while (y < height) {
    const start = y * width;
    let repeat = 1;
    while (
      y + repeat < height &&
      repeat < 256 &&
      pixels.compare(pixels, (y + repeat) * width, (y + repeat + 1) * width, start, start + width) === 0
    ) {
      repeat++;
    }
    out.push(repeat - 1);
    encodeLine(pixels, start, width, out);
    y += repeat;
  }
  return Buffer.from(out);
};

/**
 * Renders an image as a single A4 page of pure black/white pixels in PWG Raster format.
 * Landscape images are rotated so they fill the portrait sheet.
 */
export const imageToPwgRaster = async (input: Buffer, pageSizeName: string): Promise<Buffer> => {
  const meta = await sharp(input).metadata();
  const isLandscape = (meta.width ?? 0) > (meta.height ?? 0);

  let pipeline = sharp(input).flatten({ background: '#ffffff' }).grayscale();
  if (isLandscape) pipeline = pipeline.rotate(90);

  const drawing = await pipeline
    .resize(PAGE_WIDTH_PX - 2 * MARGIN_PX, PAGE_HEIGHT_PX - 2 * MARGIN_PX, { fit: 'inside', kernel: 'lanczos3' })
    .threshold(BLACK_THRESHOLD)
    .png()
    .toBuffer();

  const { data, info } = await sharp({
    create: { width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX, channels: 3, background: '#ffffff' }
  })
    .composite([{ input: drawing, gravity: 'centre' }])
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 1 || info.width !== PAGE_WIDTH_PX || info.height !== PAGE_HEIGHT_PX) {
    throw new Error(`Unexpected raster layout: ${info.width}x${info.height}x${info.channels}`);
  }

  // Snap to exact black/white so the printer never dithers grey edges.
  for (let i = 0; i < data.length; i++) data[i] = data[i] < 128 ? 0 : WHITE;

  return Buffer.concat([Buffer.from('RaS2', 'ascii'), buildHeader(pageSizeName), encodePage(data, PAGE_WIDTH_PX, PAGE_HEIGHT_PX)]);
};
