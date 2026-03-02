import express from 'express';
import multer from 'multer';
import type { AnalyzeImageFn } from './types';
import { validateImageFile } from './validation/image-file';

const upload = multer({ storage: multer.memoryStorage() });

export function createApp(analyzeImage: AnalyzeImageFn) {
  const app = express();

  app.post('/api/image-to-prompt', upload.single('file'), async (req, res) => {
    const validationError = validateImageFile(req.file);
    if (validationError === 'file is required') {
      return res.status(400).json({ error: validationError });
    }
    if (validationError === 'unsupported file type') {
      return res.status(415).json({ error: validationError });
    }
    if (validationError === 'file too large') {
      return res.status(413).json({ error: validationError });
    }

    const prompt = await analyzeImage({
      mimeType: req.file!.mimetype,
      dataBase64: req.file!.buffer.toString('base64'),
    });

    return res.status(200).json({
      prompt,
      model: 'gemini-3-flash-preview',
    });
  });

  return app;
}
