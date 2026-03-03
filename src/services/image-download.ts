export type DownloadImageInput = {
  url: string;
  fileName: string;
};

export type DownloadImagesResult = {
  successCount: number;
  failedCount: number;
  failures: string[];
};

export async function downloadImage(input: DownloadImageInput): Promise<void> {
  const response = await fetch(input.url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = input.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function buildDownloadFileName(input: {
  prefix: string;
  timestamp: Date;
  index: number;
  sourceUrl: string;
}): string {
  const yyyy = String(input.timestamp.getUTCFullYear());
  const mm = String(input.timestamp.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(input.timestamp.getUTCDate()).padStart(2, '0');
  const hh = String(input.timestamp.getUTCHours()).padStart(2, '0');
  const mi = String(input.timestamp.getUTCMinutes()).padStart(2, '0');
  const ss = String(input.timestamp.getUTCSeconds()).padStart(2, '0');
  const extensionMatch = input.sourceUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const extension = extensionMatch?.[1]?.toLowerCase() || 'png';

  return `${input.prefix}-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${input.index}.${extension}`;
}

export async function downloadImages(items: DownloadImageInput[]): Promise<DownloadImagesResult> {
  let successCount = 0;
  let failedCount = 0;
  const failures: string[] = [];

  for (const item of items) {
    try {
      await downloadImage(item);
      successCount += 1;
    } catch (error) {
      failedCount += 1;
      failures.push(error instanceof Error ? error.message : 'unknown error');
    }
  }

  return {
    successCount,
    failedCount,
    failures,
  };
}
