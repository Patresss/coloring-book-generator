export const APP_NAME = 'Coloring App';
export const JOB_NAME = 'Kolorowanka';

// Files and formats
export const IMAGE_BASENAME = 'image';
export const EXT_JPG = 'jpg';
export const EXT_PNG = 'png';
export const FILE_IMAGE_JPG = `${IMAGE_BASENAME}.${EXT_JPG}`;
export const FILE_IMAGE_PNG = `${IMAGE_BASENAME}.${EXT_PNG}`;

// OpenAI image defaults
export const OPENAI_IMAGE_SIZE = '1536x1024';

// Prompts
export const PROMPT_COLORING_BOOK = `Narysuj czarno-białą ilustrację do kolorowania (line art, wyraźne kontury, bez tła, brak szarości, brak cieniowania). Styl przyjazny dla dzieci. Nie dodawaj żadnego tekstu na obrazku, chyba ze jest to wprost powiedziane (to, że chce aby np. wygenerować Wiktora to nie znaczy, że chce napis Wiktor). Temat: `;
export const PROMPT_IMPROVE = `Ulepsz ten prompt tak, aby powstała kolorowanka dla dzieci. Zmien tylko zawarotść kolorowanki, a nie to jak kolorowanka ma wygladać, bo tym zajmuje sie cos innego. Zwroc tylko elementy na kolorowance. Oryginalny prompt: `;
export const PROMPT_DETECT_REFERENCES = `Wyszukaj wszystkie pliki referencyjne i zwróć jes w postaci json: { "references": ["plik1.jpg", "plik2.png"] } — tylko istniejące nazwy. Możesz zwrócić pustą listę. Pliki referencyjne podpasuj pod prompt.`;

// Printing defaults (IPP)
export const PRINTER_MEDIA_A4 = 'iso_a4_210x297mm';
export const PRINTER_SCALING_FIT = 'fit';
export const PRINTER_QUALITY_DRAFT = 3; // 3=draft, 4=normal, 5=high
export const PRINTER_DOCUMENT_NAME = FILE_IMAGE_JPG;
export const PRINTER_COLOR_MODE_MONO = 'monochrome';
export const PRINTER_OPTIMIZE_TEXT = 'text';
