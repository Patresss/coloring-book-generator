import sharp from 'sharp';

// A4 in PDF points (1/72 inch)
const A4_SHORT = 595.28;
const A4_LONG = 841.89;
const MARGIN = 28; // ~10 mm

/**
 * Builds a one-page A4 PDF with the picture centred and scaled to fit.
 * Hand-written PDF (one JPEG image XObject), so no PDF library is needed.
 * Landscape pictures get a landscape page.
 */
export const imageToA4Pdf = async (image: Buffer, title = 'Kolorowanka'): Promise<Buffer> => {
  const jpeg = await sharp(image)
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer({ resolveWithObject: true });
  const { width: imgW, height: imgH } = jpeg.info;
  const landscape = imgW > imgH;
  const pageW = landscape ? A4_LONG : A4_SHORT;
  const pageH = landscape ? A4_SHORT : A4_LONG;
  const scale = Math.min((pageW - 2 * MARGIN) / imgW, (pageH - 2 * MARGIN) / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;
  const n = (v: number) => v.toFixed(2);

  const content = `q ${n(drawW)} 0 0 ${n(drawH)} ${n(x)} ${n(y)} cm /Im0 Do Q`;
  const safeTitle = title.replace(/[()\\\r\n]/g, ' ').slice(0, 120);

  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Buffer) => {
    const buf = typeof part === 'string' ? Buffer.from(part, 'latin1') : part;
    chunks.push(buf);
    length += buf.length;
  };
  const object = (id: number, body: string | Buffer[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body.forEach(push);
    push('\nendobj\n');
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(pageW)} ${n(pageH)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  object(4, [
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.data.length} >>\nstream\n`, 'latin1'),
    jpeg.data,
    Buffer.from('\nendstream', 'latin1'),
  ]);
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  object(6, `<< /Title (${safeTitle}) /Producer (Kolorowanki) >>`);

  const xrefAt = length;
  push(`xref\n0 7\n0000000000 65535 f \n`);
  for (let i = 1; i <= 6; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return Buffer.concat(chunks);
};
