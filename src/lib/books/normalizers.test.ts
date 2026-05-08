import { describe, expect, it } from "vitest";
import {
  normalizeGoogleVolume,
  normalizeKakaoBook,
  normalizeNaverBook,
  normalizeOpenLibraryDoc,
} from "@/lib/books/normalizers";

describe("book search normalizers", () => {
  it("normalizes a Google Books volume into the shared search result shape", () => {
    const result = normalizeGoogleVolume({
      id: "abc123",
      volumeInfo: {
        title: "The Left Hand of Darkness",
        subtitle: "A Novel",
        authors: ["Ursula K. Le Guin"],
        industryIdentifiers: [
          { type: "ISBN_10", identifier: "0441478123" },
          { type: "ISBN_13", identifier: "9780441478125" },
        ],
        imageLinks: { thumbnail: "http://books.google.com/cover.jpg" },
        pageCount: 304,
        publishedDate: "1969-03-01",
        language: "en",
        description: "A classic work of speculative fiction.",
      },
    });

    expect(result).toMatchObject({
      provider: "google",
      providerId: "abc123",
      title: "The Left Hand of Darkness",
      subtitle: "A Novel",
      authors: ["Ursula K. Le Guin"],
      isbn10: "0441478123",
      isbn13: "9780441478125",
      pageCount: 304,
      publishedYear: 1969,
      language: "en",
    });
    expect(result.coverUrl).toBe("https://books.google.com/cover.jpg");
  });

  it("normalizes an Open Library doc with a generated cover URL", () => {
    const result = normalizeOpenLibraryDoc({
      key: "/works/OL262758W",
      title: "Pachinko",
      author_name: ["Min Jin Lee"],
      isbn: ["1455563935", "9781455563937"],
      cover_i: 8231990,
      first_publish_year: 2017,
      language: ["eng"],
    });

    expect(result).toEqual({
      provider: "open-library",
      providerId: "OL262758W",
      title: "Pachinko",
      subtitle: null,
      authors: ["Min Jin Lee"],
      isbn10: "1455563935",
      isbn13: "9781455563937",
      coverUrl: "https://covers.openlibrary.org/b/id/8231990-L.jpg",
      pageCount: null,
      publishedYear: 2017,
      language: "eng",
      description: null,
      raw: {
        key: "/works/OL262758W",
        title: "Pachinko",
        author_name: ["Min Jin Lee"],
        isbn: ["1455563935", "9781455563937"],
        cover_i: 8231990,
        first_publish_year: 2017,
        language: ["eng"],
      },
    });
  });

  it("normalizes a Kakao book document into the shared search result shape", () => {
    const result = normalizeKakaoBook({
      title: "모순",
      contents: "양귀자의 대표 장편소설.",
      url: "https://search.daum.net/book/123",
      isbn: "8998441015 9788998441012",
      datetime: "2013-04-01T00:00:00.000+09:00",
      authors: ["양귀자"],
      publisher: "쓰다",
      translators: [],
      price: 13000,
      sale_price: 11700,
      thumbnail: "http://t1.daumcdn.net/book/cover.jpg",
      status: "정상판매",
    });

    expect(result).toMatchObject({
      provider: "kakao",
      providerId: "9788998441012",
      title: "모순",
      authors: ["양귀자"],
      isbn10: "8998441015",
      isbn13: "9788998441012",
      publishedYear: 2013,
      language: "kor",
      description: "양귀자의 대표 장편소설.",
    });
    expect(result.coverUrl).toBe("https://t1.daumcdn.net/book/cover.jpg");
  });

  it("normalizes a Naver book item into the shared search result shape", () => {
    const result = normalizeNaverBook({
      title: "<b>1984</b>",
      link: "https://search.shopping.naver.com/book/catalog/123",
      image: "http://shopping-phinf.pstatic.net/book/cover.jpg",
      author: "조지 오웰",
      discount: "15120",
      publisher: "민음사",
      pubdate: "20030415",
      isbn: "8937460777 9788937460777",
      description: "디스토피아 문학의 대표작.",
    });

    expect(result).toMatchObject({
      provider: "naver",
      providerId: "9788937460777",
      title: "1984",
      authors: ["조지 오웰"],
      isbn10: "8937460777",
      isbn13: "9788937460777",
      publishedYear: 2003,
      language: "kor",
      description: "디스토피아 문학의 대표작.",
    });
    expect(result.coverUrl).toBe(
      "https://shopping-phinf.pstatic.net/book/cover.jpg",
    );
  });
});
