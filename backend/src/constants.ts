export const APP_NAME = 'Coloring App';
export const JOB_NAME = 'Kolorowanka';

// Files and formats
export const IMAGE_BASENAME = 'image';
export const EXT_JPG = 'jpg';
export const EXT_PNG = 'png';
export const EXT_SVG = 'svg';
export const FILE_IMAGE_JPG = `${IMAGE_BASENAME}.${EXT_JPG}`;
export const FILE_IMAGE_PNG = `${IMAGE_BASENAME}.${EXT_PNG}`;
export const FILE_IMAGE_SVG = `${IMAGE_BASENAME}.${EXT_SVG}`;
export const IMAGE_A4_WIDTH = 2480; // ~210mm @ 300 DPI
export const IMAGE_A4_HEIGHT = 3508; // ~297mm @ 300 DPI

// Prompts
// Placeholder replaced with the user's subject; if missing, the subject is appended at the end.
export const PROMPT_SUBJECT_PLACEHOLDER = '{temat}';

export const PROMPT_COLORING_BOOK = `Stwórz stronę z kolorowanki dla dzieci: czarno-biały rysunek liniowy (line art), gotowy do wydruku i pokolorowania kredkami.

Zasady obowiązkowe:
- Wyłącznie czarne kontury na czystym, białym tle. Zero kolorów w jakimkolwiek elemencie – także na słodyczach, owocach, ubraniach, niebie czy kwiatach.
- Żadnych wypełnień, szarości, cieniowania, gradientów, kreskowania ani tekstur. Wnętrze każdego konturu zostaje białe.
- Wyraźne, zamknięte kontury o równej grubości. Elementy na tyle duże, żeby dziecko mogło je pokolorować.
- Bez ramki. Bez napisów, liter i cyfr, chyba że temat wprost o nie prosi (imię osoby w temacie to nie prośba o napis).
- Jeśli dołączono zdjęcia referencyjne osób: wiernie odwzoruj ich twarze, fryzury i charakterystyczne cechy, ale narysuj je samymi czarnymi konturami – nie przenoś kolorów ze zdjęć.

Temat: {temat}

Przypomnienie: wynik ma być w 100% czarno-biały – tylko czarne linie na białym tle, bez żadnego koloru i bez szarych wypełnień.`;

export const PROMPT_IMAGE = `Wygeneruj obraz: {temat}`;

// Prompts for correcting an existing picture; {temat} is the requested change
export const PROMPT_EDIT_COLORING = `Popraw załączony rysunek (pierwszy obrazek) zgodnie z prośbą: {temat}

Zmień tylko to, o co chodzi w prośbie. Zachowaj kompozycję, postacie, styl kreski i wszystkie pozostałe elementy bez zmian.
Wynik ma pozostać kolorowanką: wyłącznie czarne kontury na białym tle, bez kolorów, szarości, cieniowania i wypełnień. Bez napisów, chyba że prośba wprost o nie prosi.
Jeśli dołączono kolejne zdjęcia osób, użyj ich, żeby wiernie narysować te osoby – samymi konturami.`;

export const PROMPT_EDIT_IMAGE = `Popraw załączony obraz (pierwszy obrazek) zgodnie z prośbą: {temat}

Zmień tylko to, o co chodzi w prośbie. Zachowaj kompozycję, postacie, styl, kolory i wszystkie pozostałe elementy bez zmian. Bez napisów, chyba że prośba wprost o nie prosi.
Jeśli dołączono kolejne zdjęcia osób, użyj ich, żeby wiernie odwzorować te osoby.`;

export const PROMPT_IMPROVE = `Ulepsz ten prompt tak, aby powstała kolorowanka dla dzieci. Rozbuduj tylko zawartość kolorowanki, a nie to jak kolorowanka ma wyglądać od strony technicznej, bo tym zajmuje się coś innego. Nie opisuj kolorów (np. „czerwony”, „tęczowy”, „kolorowy”) – obrazek będzie czarno-białą kolorowanką. Zwróć tylko elementy na kolorowance i nic więcej. Oryginalny prompt: `;
export const PROMPT_IMPROVE_IMAGE = `Ulepsz ten prompt tak, aby powstał ciekawy, szczegółowy obraz. Rozbuduj zawartość sceny: postacie, otoczenie, szczegóły i nastrój. Zwróć tylko opis sceny i nic więcej. Oryginalny prompt: `;
export const PROMPT_DETECT_REFERENCES = `Wyszukaj wszystkie pliki referencyjne i zwróć je w postaci json: Odpowiedź musi być wyłącznie poprawnym JSON-em, bez dodatkowego tekstu. Możesz zwrócić pustą listę. Pliki referencyjne mają w jakikolwiek sposób pasować do promptu. Czyli jak prompt mówi o jakiejś postaci to zwróć pliki z tą postacią lub grupę pasującą do referencji. `;

// Printing defaults (IPP)
export const PRINTER_MEDIA_A4 = 'iso_a4_210x297mm';
export const PRINTER_DOCUMENT_NAME = FILE_IMAGE_JPG;
export const PRINTER_COLOR_MODE_MONO = 'monochrome';
export const PRINTER_COLOR_MODE_COLOR = 'color';
export const PRINTER_FORMAT_PWG_RASTER = 'image/pwg-raster';
export const PRINTER_MEDIA_TYPE_PLAIN = 'stationery';
export const PRINTER_A4_SIZE = { 'x-dimension': 21000, 'y-dimension': 29700 }; // hundredths of a millimetre
