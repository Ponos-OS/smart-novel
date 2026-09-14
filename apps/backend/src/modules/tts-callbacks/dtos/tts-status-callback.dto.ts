import { Type } from 'class-transformer';
import {
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

  /**
   * @description
   * Beatrice's own status vocabulary, deliberately left as an opaque string rather than a literal union.
   *
   * Beatrice hasn't promised to maintain the value of this , so we cannot have a validator in front of it.
   *
   * The only two spellings smart-novel acts on are "completed" and "failed".
   *
   * And for those two we have an ACL (Anti-corruption layer).
   */
  @IsString()
  status!: string;

  /**
   * @description
   * Present on `queued`/`generating`/`uploading`, absent on `completed`/`failed`. A
   * bigger number means later for this job, nothing else — values carry no meaning
   * beyond ordering and aren't guaranteed stable across a Beatrice release.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  progress?: number;

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
