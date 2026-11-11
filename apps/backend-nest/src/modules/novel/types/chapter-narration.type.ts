import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { NarrationStatus } from '@prisma/client';

registerEnumType(NarrationStatus, {
  name: 'NarrationStatus',
  description: 'The status of chapter narration generation',
});

@ObjectType({
  description: 'Response when triggering chapter audio generation',
})
export class ChapterNarrationResponse {
  @Field(() => NarrationStatus, {
    description: 'Current status of the narration',
  })
  status: NarrationStatus;

  @Field(() => String, {
    nullable: true,
    description:
      'Public URL to the narration audio file (only when READY)',
  })
  narrationUrl?: string | null;
}

@ObjectType({
  description: 'Real-time event for chapter narration updates',
})
export class ChapterNarrationEvent {
  @Field(() => NarrationStatus, {
    description: 'Updated status of the narration',
  })
  status: NarrationStatus;

  @Field(() => String, {
    nullable: true,
    description:
      'Public URL to the narration audio file (when READY)',
  })
  narrationUrl?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Error message if narration failed',
  })
  error?: string;

  @Field(() => String, {
    nullable: true,
    description:
      "Beatrice's raw stage ('queued' | 'generating' | 'uploading'), present only while status is PROCESSING",
  })
  stage?: string;
}
