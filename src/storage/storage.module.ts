import { Global, Module } from '@nestjs/common';
import { FileStorage } from './file-storage.js';
import { KoofrStorage } from './koofr-storage.js';

@Global()
@Module({
  providers: [{ provide: FileStorage, useClass: KoofrStorage }],
  exports: [FileStorage],
})
export class StorageModule {}
