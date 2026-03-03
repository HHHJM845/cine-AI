import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDownloadFileName, downloadImage, downloadImages } from './image-download';

describe('downloadImage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('downloads a blob and revokes object url', async () => {
    const click = vi.fn();
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const anchor = {
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement;

    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: {
        appendChild,
        removeChild,
      },
    });

    const createObjectURL = vi.fn(() => 'blob:download');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['ok'], { type: 'image/png' }),
    }) as unknown as typeof fetch;

    await downloadImage({
      url: '/generated/2026/03/03/example.png',
      fileName: 'cine-20260303-120000-1.png',
    });

    expect(global.fetch).toHaveBeenCalledWith('/generated/2026/03/03/example.png');
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledTimes(1);
    expect(removeChild).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');
  });

  it('builds file name with png fallback extension', () => {
    const fileName = buildDownloadFileName({
      prefix: 'cine',
      timestamp: new Date('2026-03-03T12:00:00.000Z'),
      index: 2,
      sourceUrl: 'https://example.com/image-without-ext',
    });

    expect(fileName).toBe('cine-20260303-120000-2.png');
  });

  it('continues downloading when one item fails', async () => {
    const click = vi.fn();
    const anchor = {
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement;

    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:download'),
      revokeObjectURL: vi.fn(),
    });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['ok'], { type: 'image/png' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        blob: async () => new Blob(['bad'], { type: 'text/plain' }),
      }) as unknown as typeof fetch;

    const result = await downloadImages([
      { url: '/generated/ok.png', fileName: 'cine-1.png' },
      { url: '/generated/no.png', fileName: 'cine-2.png' },
    ]);

    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failures[0]).toContain('HTTP 403');
    expect(click).toHaveBeenCalledTimes(1);
  });
});
