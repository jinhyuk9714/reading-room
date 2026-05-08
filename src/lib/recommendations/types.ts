export type RecommendationCard = {
  title: string;
  authors: string[];
  reason: string;
  source: string;
  provider: string;
  providerId: string;
  coverUrl: string | null;
  pageCount: number | null;
};
