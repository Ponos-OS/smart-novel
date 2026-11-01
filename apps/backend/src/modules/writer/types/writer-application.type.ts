import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description:
    'One application to become a writer, and what an admin decided about it',
})
export class WriterApplication {
  @Field({ description: 'What the user wrote when they applied' })
  note: string;

  @Field({ description: 'When they applied' })
  appliedAt: Date;

  @Field(() => String, {
    nullable: true,
    description: 'Why an admin rejected it, when they said',
  })
  rejectionReason?: string | null;

  @Field(() => Date, {
    nullable: true,
    description: 'When an admin decided; null while it waits',
  })
  reviewedAt?: Date | null;
}
