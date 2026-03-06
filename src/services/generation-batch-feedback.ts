export type GenerationBatchFeedbackVote = 'up' | 'down' | null;

export type GenerationBatchFeedback = {
  batchId: string;
  vote: GenerationBatchFeedbackVote;
  downvoteReasons: string[];
  comment: string;
  createdAt: number;
  updatedAt: number;
};

export type UpsertGenerationBatchFeedbackInput = {
  batchId: string;
  vote: GenerationBatchFeedbackVote;
  downvoteReasons: string[];
  comment: string;
};

export async function fetchGenerationBatchFeedbacks(batchIds: string[]): Promise<GenerationBatchFeedback[]> {
  const normalizedBatchIds = Array.from(new Set(batchIds.map((batchId) => batchId.trim()).filter((batchId) => batchId.length > 0)));
  if (normalizedBatchIds.length === 0) {
    return [];
  }

  const response = await fetch(`/api/generation-batch-feedback?batchIds=${encodeURIComponent(normalizedBatchIds.join(','))}`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'failed to load generation batch feedback');
  }

  return Array.isArray(body.feedbacks) ? (body.feedbacks as GenerationBatchFeedback[]) : [];
}

export async function upsertGenerationBatchFeedback(
  input: UpsertGenerationBatchFeedbackInput,
): Promise<GenerationBatchFeedback> {
  const response = await fetch('/api/generation-batch-feedback', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'failed to save batch feedback');
  }

  return body.feedback as GenerationBatchFeedback;
}
