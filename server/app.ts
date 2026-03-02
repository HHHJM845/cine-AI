import express from 'express';
import multer from 'multer';
import type { AnalyzeImageFn } from './types';

const upload = multer({ storage: multer.memoryStorage() });

export function createApp(analyzeImage: AnalyzeImageFn) {
  const app = express();

  app.post('/api/image-to-prompt', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const prompt = await analyzeImage({
      mimeType: req.file.mimetype,
      dataBase64: req.file.buffer.toString('base64'),
    });

    return res.status(200).json({
      prompt,
      model: 'gemini-3-flash-preview',
    });
  });

  return app;
}
