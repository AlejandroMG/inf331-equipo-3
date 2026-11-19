import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateSpaceDescriptionService } from './generate-space-description.service';
import { AiProvider } from './ai-provider';
import { AiUsageQuotaService } from './ai-usage-quota.service';
import { DEFAULT_AI_MODEL, GeminiAiProvider } from './gemini-ai.provider';
import { MockAiProvider } from './mock-ai.provider';
import { SpaceDescriptionAiService } from './space-description-ai.service';

@Module({
  providers: [
    {
      provide: AiProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiProvider => {
        if (config.get<string>('AI_PROVIDER') === 'gemini') {
          return new GeminiAiProvider(
            config.getOrThrow<string>('AI_API_KEY'),
            config.get<string>('AI_MODEL') ?? DEFAULT_AI_MODEL,
          );
        }
        return new MockAiProvider();
      },
    },
    AiUsageQuotaService,
    SpaceDescriptionAiService,
    GenerateSpaceDescriptionService,
  ],
  exports: [SpaceDescriptionAiService, GenerateSpaceDescriptionService],
})
export class AiModule {}
