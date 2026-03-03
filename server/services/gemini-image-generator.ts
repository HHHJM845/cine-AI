import type { GenerateImagesInput, GeneratedImageBinary } from '../types';

const MODEL_ID = 'gemini-3-pro-image-preview';

type GeminiLikeClient = {
  models: {
    generateContent: (input: unknown) => Promise<unknown>;
  };
};

function extractInlineImages(response: any): GeneratedImageBinary[] {
  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  const images: GeneratedImageBinary[] = [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const mimeType = String(part?.inlineData?.mimeType ?? '');
      const data = String(part?.inlineData?.data ?? '');
      if (mimeType.startsWith('image/') && data) {
        images.push({ mimeType, dataBase64: data });
      }
    }
  }

  return images;
}

export function createGeminiImageGenerator(client: GeminiLikeClient) {
  return async (input: GenerateImagesInput): Promise<GeneratedImageBinary[]> => {
    const response = await client.models.generateContent({
      model: MODEL_ID,
      contents: [{ text: `Generate ${input.count} images with aspect ratio ${input.aspectRatio}. ${input.prompt}` }],
      config: {
        responseModalities: ['IMAGE'],
      },
    });

    return extractInlineImages(response);
  };
}
