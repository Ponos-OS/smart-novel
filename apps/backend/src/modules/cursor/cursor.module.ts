import { Global, Module } from '@nestjs/common';

import { CursorCodec } from './cursor-codec.service';

@Global()
@Module({
  providers: [CursorCodec],
  exports: [CursorCodec],
})
export class CursorModule {}
