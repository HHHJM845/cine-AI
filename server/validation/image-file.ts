import type { Request } from 'express';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file: Request['file']): string | null {
  if (!file) {
    return 'file is required';
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return 'unsupported file type';
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return 'file too large';
  }

  return null;
}
