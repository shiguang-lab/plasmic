export interface PublishedCover {
  projectId: string;
  publishedRevision: number;
}

export const coverRevisionBatchSize = 32;
export const coverRevisionHeader = "X-Cover-Revision";
