export type BookProvider =
  | "google"
  | "open-library"
  | "manual"
  | "kakao"
  | "naver";

export type BookSearchResult = {
  provider: BookProvider;
  providerId: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  isbn10: string | null;
  isbn13: string | null;
  coverUrl: string | null;
  pageCount: number | null;
  publishedYear: number | null;
  language: string | null;
  description: string | null;
  raw: unknown;
};
