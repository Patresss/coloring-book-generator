import { HistoryItem } from '../api/client';

const stamp = (item: HistoryItem) => {
  const d = new Date(item.createdAt || Date.now());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
};

export const shareFileName = (item: HistoryItem, ext: string) => `kolorowanka-${stamp(item)}.${ext}`;

export const pdfUrl = (item: HistoryItem) => `/api/history/${encodeURIComponent(item.id)}/pdf`;

// A4 PDF made by the server (auth cookie goes along with a normal link)
export const downloadPdf = (item: HistoryItem) => {
  const link = document.createElement('a');
  link.href = pdfUrl(item);
  link.download = shareFileName(item, 'pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// Fetched ahead of time: Safari only opens the share sheet if share() is called right in the tap
export const loadShareFile = async (item: HistoryItem): Promise<File | null> => {
  if (!item.imageUrl) return null;
  try {
    const res = await fetch(item.imageUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type.includes('jpeg') ? 'jpg' : 'png';
    return new File([blob], shareFileName(item, ext), { type: blob.type || 'image/png' });
  } catch {
    return null;
  }
};

export const canShareFile = (file: File | null): file is File =>
  !!file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

// System share sheet (e.g. WhatsApp to grandma); falls back to downloading the A4 PDF
export const shareOrDownload = async (item: HistoryItem, file: File | null) => {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: 'Kolorowanka' });
      return;
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // the user closed the share sheet
      console.warn('Share failed, downloading PDF instead', e);
    }
  }
  downloadPdf(item);
};
