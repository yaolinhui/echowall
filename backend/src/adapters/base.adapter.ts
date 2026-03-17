export interface MentionData {
  platform: string;
  externalId: string;
  content: string;
  rawContent?: string;
  authorName?: string;
  authorAvatar?: string;
  authorUrl?: string;
  sourceUrl?: string;
  postedAt?: Date;
  metadata?: Record<string, any>;
}

export interface AdapterConfig {
  [key: string]: any;
}

export abstract class BaseAdapter {
  abstract readonly platform: string;

  abstract fetch(config: AdapterConfig): Promise<MentionData[]>;

  abstract validateConfig(config: AdapterConfig): boolean;
}
