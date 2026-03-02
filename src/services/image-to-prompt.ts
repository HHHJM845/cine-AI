export async function imageToPrompt(file: File, signal?: AbortSignal): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/image-to-prompt', {
    method: 'POST',
    body: formData,
    signal,
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'analysis failed');
  }

  return String(body.prompt || '').trim();
}
