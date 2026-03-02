export type AnalyzeImageInput = {
  mimeType: string;
  dataBase64: string;
};

export type AnalyzeImageFn = (input: AnalyzeImageInput) => Promise<string>;
