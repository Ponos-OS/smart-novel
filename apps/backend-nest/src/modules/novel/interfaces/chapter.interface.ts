import { NarrationStatus } from '@prisma/client';

export interface IChapter {
  id: string;
  novelId: string;
  contentId: string;
  title: string;
  chapterNumber: number;
  createdAt: string;
  updatedAt: string;
  narrationStatus?: NarrationStatus;
  narrationUrl?: string;
}
