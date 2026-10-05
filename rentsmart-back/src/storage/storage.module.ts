import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local-storage.service';
import { StorageService } from './storage.service';
import { SupabaseStorageService } from './supabase-storage.service';

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageService =>
        config.get('STORAGE_DRIVER') === 'supabase'
          ? new SupabaseStorageService({
              url: config.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, ''),
              serviceRoleKey: config.getOrThrow<string>(
                'SUPABASE_SERVICE_ROLE_KEY',
              ),
              bucket: config.getOrThrow<string>('SUPABASE_BUCKET'),
            })
          : new LocalStorageService(),
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
