export type AnalyzeImageInput = {
  mimeType: string;
  dataBase64: string;
};

export type AnalyzeImageFn = (input: AnalyzeImageInput) => Promise<string>;

export type AspectRatio = '16:9' | '9:16';

export type GenerateImagesInput = {
  prompt: string;
  aspectRatio: AspectRatio;
  count: 1 | 2 | 3 | 4;
  enableSceneAssist?: boolean;
  primarySceneId?: string;
  subSceneId?: string;
};

export type GeneratedImageBinary = {
  mimeType: string;
  dataBase64: string;
};

export type GenerationBatchStatus = 'completed' | 'partial_failed' | 'failed';
export type GenerationItemStatus = 'success' | 'failed';
export type BatchFeedbackVote = 'up' | 'down' | null;

export type GenerationItem = {
  id: string;
  position: number;
  status: GenerationItemStatus;
  imageUrl?: string;
  errorMessage?: string;
};

export type GenerationBatch = {
  id: string;
  prompt: string;
  aspectRatio: AspectRatio;
  requestedCount: number;
  sceneAssistUsed: boolean;
  model: string;
  status: GenerationBatchStatus;
  createdAt: number;
  items: GenerationItem[];
};

export type GenerationBatchFeedback = {
  batchId: string;
  vote: BatchFeedbackVote;
  downvoteReasons: string[];
  comment: string;
  createdAt: number;
  updatedAt: number;
};

export type UpsertGenerationBatchFeedbackInput = {
  batchId: string;
  vote: BatchFeedbackVote;
  downvoteReasons: string[];
  comment: string;
};

export type UpsertGenerationBatchFeedbackFn = (
  input: UpsertGenerationBatchFeedbackInput,
) => Promise<GenerationBatchFeedback | null>;

export type ListGenerationBatchFeedbacksFn = (input: { batchIds: string[] }) => Promise<GenerationBatchFeedback[]>;

export type GenerateImagesFn = (input: GenerateImagesInput) => Promise<GenerationBatch>;
export type ListGenerationBatchesFn = (input: { limit: number; cursor?: number }) => Promise<GenerationBatch[]>;

export type DeleteGenerationItemsInput = {
  itemIds: string[];
};

export type DeleteGenerationItemsResult = {
  deletedItemIds: string[];
  failedItemIds: string[];
};

export type DeleteGenerationItemsFn = (input: DeleteGenerationItemsInput) => Promise<DeleteGenerationItemsResult>;
