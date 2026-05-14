export type RecommendationMode = "feed" | "purpose" | "conversation";

export type RecommendationSection =
  | "now"
  | "similar"
  | "short"
  | "expand"
  | "purpose"
  | "conversation";

export type RecommendationIntent = {
  mood?: string;
  length?: "short" | "medium" | "long" | string;
  difficulty?: "easy" | "medium" | "deep" | string;
  genres?: string[];
  blockedSubjects?: string[];
  purpose?: string;
  daily_page_goal?: number;
  default_log_mode?: string;
};

export type ExistingRecommendationBook = {
  title: string;
  authors?: string[];
  provider?: string;
  providerId?: string;
};

export type RecommendationOptions = {
  limit?: number;
  mode?: RecommendationMode;
  intent?: RecommendationIntent;
  previousProviderIds?: string[];
  hiddenProviderIds?: string[];
  excludedProviderIds?: string[];
  existingLibrary?: ExistingRecommendationBook[];
  recommendationEvents?: RecommendationEventSignal[];
};

export type RecommendationEventSignal = {
  eventType: string;
  provider?: string | null;
  providerId?: string | null;
  recommendation?: Partial<RecommendationCard> | null;
};

export type RecommendationCard = {
  title: string;
  authors: string[];
  reason: string;
  reasonTags?: string[];
  matchScore?: number;
  section?: RecommendationSection;
  isFallback?: boolean;
  domesticVerified?: boolean;
  source: string;
  provider: string;
  providerId: string;
  coverUrl: string | null;
  pageCount: number | null;
};
