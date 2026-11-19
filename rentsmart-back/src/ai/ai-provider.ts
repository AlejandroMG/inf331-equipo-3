export interface AiSpacePhoto {
  mimeType: string;
  data: Uint8Array;
}

export interface SpaceDescriptionInput {
  name: string;
  type?: string;
  region?: string;
  commune?: string;
  address?: string;
  capacity?: number;
  amenities?: string[];
  rules?: string;
  pricePerHour?: number;
  pricePerDay?: number;
  schedule?: Array<{ weekday: number; startTime: string; endTime: string }>;
  photos: AiSpacePhoto[];
}

export type SpaceDescriptionSource = 'gemini' | 'mock' | 'fallback';

export interface SpaceDescriptionResult {
  description: string;
  source: SpaceDescriptionSource;
  attemptsUsed: number;
}

export class AiProviderError extends Error {}

export abstract class AiProvider {
  abstract readonly source: Exclude<SpaceDescriptionSource, 'fallback'>;

  abstract generateSpaceDescription(
    input: SpaceDescriptionInput,
    signal: AbortSignal,
  ): Promise<string>;
}
