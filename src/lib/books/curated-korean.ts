import type { BookSearchResult } from "@/lib/books/types";

const CURATED_KOREAN_BOOKS: BookSearchResult[] = [
  {
    provider: "manual",
    providerId: "ko-isbn-9788998441012",
    title: "모순",
    subtitle: "양귀자 장편소설",
    authors: ["양귀자"],
    isbn10: null,
    isbn13: "9788998441012",
    coverUrl: null,
    pageCount: 308,
    publishedYear: 2013,
    language: "kor",
    description:
      "안진진의 가족과 선택을 통해 삶의 모순을 들여다보는 양귀자의 장편소설.",
    raw: {
      source: "curated-korean",
      references: [
        "https://www.yes24.com/Product/Goods/8759796",
        "https://kobic.net/book/bookInfo/view.do?isbn=9788998441012",
      ],
    },
  },
];

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function relevance(query: string, book: BookSearchResult): number {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedTitle = normalizeSearchText(book.title);
  const normalizedAuthors = book.authors.map(normalizeSearchText);
  const authorMatched = normalizedAuthors.some((author) =>
    normalizedQuery.includes(author),
  );

  if (normalizedQuery === normalizedTitle) {
    return 100;
  }

  if (normalizedQuery.includes(normalizedTitle) && authorMatched) {
    return 90;
  }

  if (normalizedTitle.includes(normalizedQuery)) {
    return 70;
  }

  if (authorMatched) {
    return 40;
  }

  return 0;
}

export function searchCuratedKoreanBooks(
  query: string,
  limit: number,
): BookSearchResult[] {
  const scored = CURATED_KOREAN_BOOKS.map((book) => ({
    book,
    score: relevance(query, book),
  }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);

  return scored.slice(0, limit).map(({ book }) => book);
}
