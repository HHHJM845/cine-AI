import express from 'express';
import multer from 'multer';
import path from 'node:path';
import type { AnalyzeImageFn, DeleteGenerationItemsFn, GenerateImagesFn, ListGenerationBatchesFn } from './types';
import { validateImageFile } from './validation/image-file';
import { validateGenerateRequest } from './validation/generate-request';

const upload = multer({ storage: multer.memoryStorage() });

type AppDeps = {
  analyzeImage: AnalyzeImageFn;
  generateImages?: GenerateImagesFn;
  listGenerationBatches?: ListGenerationBatchesFn;
  deleteGenerationItems?: DeleteGenerationItemsFn;
  generatedStaticDir?: string;
};

function normalizeDeps(depsOrAnalyzeImage: AnalyzeImageFn | AppDeps): AppDeps {
  if (typeof depsOrAnalyzeImage === 'function') {
    return {
      analyzeImage: depsOrAnalyzeImage,
    };
  }
  return depsOrAnalyzeImage;
}

export function createApp(depsOrAnalyzeImage: AnalyzeImageFn | AppDeps) {
  const app = express();
  const deps = normalizeDeps(depsOrAnalyzeImage);

  if (deps.generatedStaticDir) {
    app.use('/generated', express.static(path.resolve(deps.generatedStaticDir)));
  }

  app.use(express.json({ limit: '1mb' }));

  app.post('/api/image-to-prompt', upload.single('file'), async (req, res) => {
    try {
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

      const prompt = await deps.analyzeImage({
        mimeType: req.file!.mimetype,
        dataBase64: req.file!.buffer.toString('base64'),
      });

      return res.status(200).json({
        prompt,
        model: 'gemini-3-flash-preview',
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      // Keep details concise so frontend can show actionable diagnostics.
      return res.status(500).json({ error: `analysis failed: ${reason}` });
    }
  });

  app.post('/api/generate-images', async (req, res) => {
    if (!deps.generateImages) {
      return res.status(501).json({ error: 'generate service not configured' });
    }

    const validationError = validateGenerateRequest(req.body || {});
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const batch = await deps.generateImages(req.body);
      return res.status(200).json({ batch });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      return res.status(500).json({ error: `image generation failed: ${reason}` });
    }
  });

  app.get('/api/generation-batches', async (req, res) => {
    if (!deps.listGenerationBatches) {
      return res.status(200).json({ batches: [] });
    }

    const rawLimit = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 20;

    try {
      const batches = await deps.listGenerationBatches({ limit });
      return res.status(200).json({ batches });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      return res.status(500).json({ error: `failed to load generation batches: ${reason}` });
    }
  });

  app.post('/api/generation-assets/delete', async (req, res) => {
    if (!deps.deleteGenerationItems) {
      return res.status(501).json({ error: 'delete service not configured' });
    }

    const rawItemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : null;
    if (!rawItemIds) {
      return res.status(400).json({ error: 'itemIds must be a non-empty string array' });
    }
    const itemIds = rawItemIds
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds must be a non-empty string array' });
    }

    try {
      const result = await deps.deleteGenerationItems({ itemIds });
      return res.status(200).json(result);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      return res.status(500).json({ error: `failed to delete generation assets: ${reason}` });
    }
  });

  return app;
}
