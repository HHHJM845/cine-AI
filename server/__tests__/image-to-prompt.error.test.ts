import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

describe('POST /api/image-to-prompt error handling', () => {
  it('returns 500 when analyzer throws', async () => {
    const app = createApp(async () => {
      throw new Error('boom');
    });

    const res = await request(app)
      .post('/api/image-to-prompt')
      .attach('file', Buffer.from([1, 2, 3]), {
        filename: 'a.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(500);
    expect(String(res.body.error || '')).toContain('failed');
  });
});
