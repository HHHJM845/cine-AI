import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

describe('POST /api/image-to-prompt', () => {
  it('returns 400 when file is missing', async () => {
    const app = createApp(async () => 'unused');
    const res = await request(app).post('/api/image-to-prompt');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('file');
  });

  it('returns prompt on success', async () => {
    const app = createApp(async () => 'detailed english prompt');
    const res = await request(app)
      .post('/api/image-to-prompt')
      .attach('file', Buffer.from([1, 2, 3]), {
        filename: 'a.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      prompt: 'detailed english prompt',
      model: 'gemini-3-flash-preview',
    });
  });

  it('returns 415 for unsupported mime type', async () => {
    const app = createApp(async () => 'unused');
    const res = await request(app)
      .post('/api/image-to-prompt')
      .attach('file', Buffer.from('hello'), {
        filename: 'a.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(415);
  });

  it('returns 413 when file too large', async () => {
    const app = createApp(async () => 'unused');
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
    const res = await request(app)
      .post('/api/image-to-prompt')
      .attach('file', big, {
        filename: 'big.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(413);
  });
});
