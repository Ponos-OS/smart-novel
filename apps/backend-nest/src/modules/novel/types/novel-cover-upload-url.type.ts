import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class NovelCoverUploadUrl {
  @Field(() => String, {
    description:
      'Presigned URL to `PUT` the image to, with the same Content-Type and Content-Length that were asked for',
  })
  uploadUrl: string;

  @Field(() => String, {
    description:
      'Pass this to `setNovelCover` once the upload is done',
  })
  objectKey: string;
}
