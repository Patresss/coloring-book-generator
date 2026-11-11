import fs from 'fs';
import ipp from 'ipp';
import sharp from 'sharp';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { APP_NAME, JOB_NAME, PRINTER_A4_SIZE, PRINTER_COLOR_MODE_COLOR, PRINTER_COLOR_MODE_MONO, PRINTER_DOCUMENT_NAME, PRINTER_FORMAT_PWG_RASTER, PRINTER_MEDIA_A4, PRINTER_MEDIA_TYPE_PLAIN } from '../constants.js';
import { imageToPwgRaster } from './pwgRaster.js';

export interface PrintOptions {
  /** Print in colour (regular images) instead of black line art (coloring pages). */
  color?: boolean;
}

export const printFile = async (filePath: string, options: PrintOptions = {}): Promise<string> => {
  const printer = ipp.Printer(config.printerUri);
  const source: Buffer = fs.readFileSync(filePath) as Buffer;

  const execPrint = (msg: any) => Promise.race([
    new Promise((resolve, reject) => {
      printer.execute('Print-Job', msg, (err: any, result: any) => {
        if (err) return reject(err);
        const status = String(result?.statusCode || '');
        if (status.startsWith('client-error') || status.startsWith('server-error')) {
          return reject(new Error(`IPP ${status}`));
        }
        resolve(result);
      });
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Printer timeout')), 30_000))
  ]);

  let pjRes: any;
  if (options.color) {
    // Photo-like content compresses poorly as raster, so a colour JPEG is the faster job here.
    pjRes = await printAsJpeg(source, filePath, execPrint, true);
  } else {
    try {
      pjRes = await printAsRaster(source, filePath, execPrint);
    } catch (e) {
      logger.warn('IPP: raster job rejected, falling back to JPEG', { error: String((e as any)?.message || e) });
      pjRes = await printAsJpeg(source, filePath, execPrint, false);
    }
  }

  logger.info('IPP: raw Print-Job response', { pjRes });
  const jobAttrs = pjRes?.['job-attributes-tag'] || {};
  const returnedJobId = jobAttrs['job-id'];
  const returnedJobUri = jobAttrs['job-uri'];
  const status = pjRes?.statusCode || pjRes?.status || 'unknown';

  if (returnedJobId) {
    const jobId = String(returnedJobId);
    logger.info('IPP: Print-Job result', { jobId, status });
    return jobId;
  }

  // Some printers don't return job-id but still accept the job; prefer job-uri or synthesize an id
  const fallbackId = returnedJobUri ? String(returnedJobUri) : `job-${Date.now()}`;
  logger.warn('IPP: Missing job-id in response; proceeding with fallback id', { status, fallbackId, jobAttrs });
  return fallbackId;
};

type ExecPrint = (msg: any) => Promise<unknown>;

// Pre-rendered black/white page on plain paper: the same kind of job AirPrint clients send.
// Inkjets print it noticeably faster than a JPEG, which they tend to treat like a photo.
const printAsRaster = async (source: Buffer, filePath: string, execPrint: ExecPrint): Promise<unknown> => {
  const data = await imageToPwgRaster(source, PRINTER_MEDIA_A4);
  logger.info('IPP: Print-Job', { uri: config.printerUri, file: filePath, format: PRINTER_FORMAT_PWG_RASTER, bytes: data.byteLength });
  return execPrint({
    'operation-attributes-tag': {
      'requesting-user-name': APP_NAME,
      'job-name': JOB_NAME,
      'document-format': PRINTER_FORMAT_PWG_RASTER
    },
    'job-attributes-tag': {
      'media-col': {
        'media-size': PRINTER_A4_SIZE,
        'media-type': PRINTER_MEDIA_TYPE_PLAIN
      },
      'print-color-mode': PRINTER_COLOR_MODE_MONO
    },
    data
  });
};

const printAsJpeg = async (source: Buffer, filePath: string, execPrint: ExecPrint, color: boolean): Promise<unknown> => {
  const format = 'image/jpeg';
  const flattened = sharp(source as any).flatten({ background: { r: 255, g: 255, b: 255 } });
  const out = await (color
    ? flattened.jpeg({ quality: 90 })
    : flattened.grayscale().jpeg({ quality: 60, chromaSubsampling: '4:2:0' })
  ).toBuffer();
  const buffer = Buffer.from(out);

  logger.info('IPP: Print-Job', { uri: config.printerUri, file: filePath, format, bytes: buffer.byteLength });

  const operationAttrs = {
    'requesting-user-name': APP_NAME,
    'job-name': JOB_NAME,
    'document-format': format,
    'document-name': PRINTER_DOCUMENT_NAME
  };

  try {
    return await execPrint({
      'operation-attributes-tag': operationAttrs,
      'job-attributes-tag': {
        'media-col': {
          'media-size': PRINTER_A4_SIZE,
          'media-type': PRINTER_MEDIA_TYPE_PLAIN
        },
        'print-color-mode': color ? PRINTER_COLOR_MODE_COLOR : PRINTER_COLOR_MODE_MONO
      },
      data: buffer
    });
  } catch (e) {
    // Fallback: jeśli drukarka odrzuci atrybuty IPP (np. print-color-mode), spróbuj ponownie z minimalnym zestawem
    logger.warn('IPP: job attributes rejected, retrying with minimal set', { error: String((e as any)?.message || e) });
    return execPrint({
      'operation-attributes-tag': operationAttrs,
      'job-attributes-tag': { 'media': PRINTER_MEDIA_A4 },
      data: buffer
    });
  }
};
