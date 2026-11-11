import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { ConnectionType, EdgeType } from 'nestjs-backend-common';

@ObjectType()
export class StatsSnapshot {
  @Field(() => ID)
  id: string;

  @Field(() => Date, {
    description: 'The UTC day of the snapshot, at midnight',
  })
  day: Date;

  @Field(() => Int, {
    description: 'The exact number of novels when it was taken',
  })
  novelCount: number;

  @Field(() => Int, {
    description: 'The exact number of chapters when it was taken',
  })
  chapterCount: number;
}

@ObjectType()
export class StatsSnapshotEdge extends EdgeType(StatsSnapshot) {}

@ObjectType()
export class StatsSnapshotConnection extends ConnectionType(
  StatsSnapshot,
  StatsSnapshotEdge,
) {}
