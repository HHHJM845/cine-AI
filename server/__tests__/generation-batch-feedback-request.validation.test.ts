import { describe, expect, it } from 'vitest';
import { validateGenerationBatchFeedbackRequest } from '../validation/generation-batch-feedback-request';

describe('validateGenerationBatchFeedbackRequest', () => {
  it('returns null for valid downvote payload', () => {
    const err = validateGenerationBatchFeedbackRequest({
      batchId: 'batch_1',
      vote: 'down',
      downvoteReasons: ['风格不符'],
      comment: '主体不一致',
    });
    expect(err).toBeNull();
  });

  it('rejects empty batch id', () => {
    expect(
      validateGenerationBatchFeedbackRequest({
        batchId: '  ',
        vote: 'up',
        downvoteReasons: [],
        comment: '',
      }),
    ).toBe('batchId is required');
  });

  it('rejects invalid vote value', () => {
    expect(
      validateGenerationBatchFeedbackRequest({
        batchId: 'batch_1',
        vote: 'neutral',
        downvoteReasons: [],
        comment: '',
      }),
    ).toBe("vote must be 'up', 'down', or null");
  });

  it('requires at least one reason when vote is down', () => {
    expect(
      validateGenerationBatchFeedbackRequest({
        batchId: 'batch_1',
        vote: 'down',
        downvoteReasons: [],
        comment: '',
      }),
    ).toBe('downvoteReasons must contain at least one reason when vote is down');
  });

  it('rejects comment longer than 500 characters', () => {
    expect(
      validateGenerationBatchFeedbackRequest({
        batchId: 'batch_1',
        vote: null,
        downvoteReasons: [],
        comment: 'a'.repeat(501),
      }),
    ).toBe('comment must be 500 characters or fewer');
  });
});
