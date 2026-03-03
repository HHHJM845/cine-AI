import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { createApp } from './app';
import { createDb } from './db/client';
import { createGenerationRepository } from './repositories/generation-repository';
import { createAiServicesFromEnv } from './services/ai-provider';
import { createGeneratedImageStorage } from './services/generated-image-storage';
import { createGenerateImagesUseCase } from './services/generate-images-usecase';

loadEnv({ path: '.env.local' });
loadEnv();

const aiServices = createAiServicesFromEnv(process.env as Record<string, string | undefined>);
const dbPath = path.resolve(process.env.SQLITE_PATH || 'storage/cine.db');
const generatedStorageDir = path.resolve(process.env.GENERATED_STORAGE_DIR || 'storage/generated');
const db = createDb(dbPath);
const repository = createGenerationRepository(db);
const storage = createGeneratedImageStorage(generatedStorageDir);
const generateImages = createGenerateImagesUseCase({
  repository,
  storage,
  generateFromGemini: aiServices.generateFromModel,
});
const app = createApp({
  analyzeImage: aiServices.analyzeImage,
  generateImages,
  listGenerationBatches: async ({ limit }) => repository.listBatches({ limit }),
  deleteGenerationItems: async ({ itemIds }) => {
    const result = repository.removeItems(itemIds);
    for (const imagePath of result.imagePaths) {
      storage.remove(imagePath);
    }
    return {
      deletedItemIds: result.deletedItemIds,
      failedItemIds: result.failedItemIds,
    };
  },
  generatedStaticDir: generatedStorageDir,
});
const port = Number(process.env.API_PORT || 8787);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port} (image-to-prompt=${aiServices.analyzeProvider}, image-generation=${aiServices.generateProvider})`);
});
