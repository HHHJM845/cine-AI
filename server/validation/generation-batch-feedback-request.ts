type BatchFeedbackRequestLike = {
  batchId?: unknown;
  vote?: unknown;
  downvoteReasons?: unknown;
  comment?: unknown;
};

const MAX_COMMENT_LENGTH = 500;

export function validateGenerationBatchFeedbackRequest(input: BatchFeedbackRequestLike): string | null {
  const batchId = typeof input.batchId === 'string' ? input.batchId.trim() : '';
  if (!batchId) {
    return 'batchId is required';
  }

  const vote = input.vote;
  if (vote !== 'up' && vote !== 'down' && vote !== null) {
    return "vote must be 'up', 'down', or null";
  }

  if (!Array.isArray(input.downvoteReasons) || !input.downvoteReasons.every((item) => typeof item === 'string')) {
    return 'downvoteReasons must be a string array';
  }

  const normalizedReasons = input.downvoteReasons.map((reason) => reason.trim()).filter((reason) => reason.length > 0);
  if (vote === 'down' && normalizedReasons.length === 0) {
    return 'downvoteReasons must contain at least one reason when vote is down';
  }

  if (typeof input.comment !== 'string') {
    return 'comment must be a string';
  }
  if (input.comment.length > MAX_COMMENT_LENGTH) {
    return 'comment must be 500 characters or fewer';
  }

  return null;
}
