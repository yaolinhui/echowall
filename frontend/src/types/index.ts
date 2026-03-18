export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  plan: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  website?: string;
  widgetConfig: {
    theme: string;
    layout: 'carousel' | 'grid' | 'list';
    maxItems: number;
    autoPlay: boolean;
  };
  isActive: boolean;
  sourcesCount?: number;
  mentionsCount?: number;
  createdAt: string;
}

export interface Source {
  id: string;
  platform: 'github' | 'producthunt' | 'twitter' | 'zhihu' | 'xiaohongshu' | 'chromewebstore';
  name: string;
  config: Record<string, any>;
  isActive: boolean;
  lastFetchedAt?: string;
  projectId: string;
}

export interface Mention {
  id: string;
  platform: string;
  content: string;
  authorName?: string;
  authorAvatar?: string;
  sourceUrl?: string;
  postedAt?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  status: 'pending' | 'approved' | 'rejected' | 'featured';
  createdAt: string;
}
