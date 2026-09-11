import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/** @description Present on a `failed` status update. */
export class TtsStatusCallbackErrorDto {
  @IsString()
  code!: string;

  @IsString()
  message!: string;
}

/** @description Beatrice's `statusCallbackUrl` progress/status update. */
export class TtsStatusCallbackDto {
  /** @description Correlates this update to the job that `generateAudio` returned. */
  @IsUUID()
  jobId!: string;

  @IsIn(['queued', 'generating', 'uploading', 'completed', 'failed'])
  status!:
    | 'queued'
    | 'generating'
    | 'uploading'
    | 'completed'
    | 'failed';

  /**
   * @description
   * Opaque value we passed as `clientContextId` on `generateAudio` — we always pass
   * the chapterId, so this is how {@link ChapterNarrationService.handleStatusUpdate}
   * routes an update back to its chapter, with no lookup and no race against when the
   * `generateAudio` mutation response arrives. Optional because a job queued by a
   * pre-upgrade backend (still in-flight during a deploy) won't have one.
   */
  @IsOptional()
  @IsString()
  clientContextId?: string;

  /** @description Present for `completed`. */
  @IsOptional()
  @IsInt()
  @Min(0)
  fileSizeBytes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  attempt?: number;

  /** @description Present for `failed`. */
  @IsOptional()
  @IsISO8601()
  failedAt?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TtsStatusCallbackErrorDto)
  error?: TtsStatusCallbackErrorDto;
}
