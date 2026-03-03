import type { GenerateImagesInput, GeneratedImageBinary } from '../types';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type OpenAIImageGeneratorOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: FetchLike;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function mapAspectRatioToSize(aspectRatio: GenerateImagesInput['aspectRatio']): string {
  if (aspectRatio === '9:16') {
    return '1024x1536';
  }
  return '1536x1024';
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as any;
    return String(body?.error?.message || body?.error || body?.message || `http ${response.status}`);
  } catch {
    return `http ${response.status}`;
  }
}

async function downloadImageAsBase64(fetchImpl: FetchLike, url: string): Promise<GeneratedImageBinary> {
  const response = await fetchImpl(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`download failed: http ${response.status}`);
  }

  const contentType = String(response.headers.get('content-type') || 'image/png');
  const mimeType = contentType.split(';')[0].trim() || 'image/png';
  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    mimeType,
    dataBase64: buffer.toString('base64'),
  };
}

export function createOpenAIImageGenerator(options: OpenAIImageGeneratorOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  return async (input: GenerateImagesInput): Promise<GeneratedImageBinary[]> => {
    const response = await fetchImpl(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        prompt: `${input.prompt}\nAspect ratio: ${input.aspectRatio}.`,
        n: input.count,
        size: mapAspectRatioToSize(input.aspectRatio),
      }),
    });

    if (!response.ok) {
      const reason = await extractErrorMessage(response);
      throw new Error(`openai image-generation failed: ${reason}`);
    }

    const body = (await response.json()) as any;
    const data = Array.isArray(body?.data) ? body.data : [];
    const images: GeneratedImageBinary[] = [];

    for (const item of data) {
      const b64 = typeof item?.b64_json === 'string' ? item.b64_json : '';
      if (b64) {
        images.push({
          mimeType: 'image/png',
          dataBase64: b64,
        });
        continue;
      }

      const url = typeof item?.url === 'string' ? item.url : '';
      if (url) {
        images.push(await downloadImageAsBase64(fetchImpl, url));
      }
    }

    return images;
  };
}
