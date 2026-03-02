import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { createApp } from './app';
import { createGeminiImageToPrompt } from './services/gemini-image-to-prompt';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY is required');
}

const ai = new GoogleGenAI({ apiKey });
const analyzeImage = createGeminiImageToPrompt(ai as any);
const app = createApp(analyzeImage);
const port = Number(process.env.API_PORT || 8787);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
});
