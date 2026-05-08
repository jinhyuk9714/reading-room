import { describe, expect, it } from "vitest";

import { buildRecommendationQuery } from "@/lib/recommendation-context";
import type { ReadingRankings } from "@/lib/rankings";
import type { LibraryItemWithBook } from "@/lib/reading/types";

function libraryItem(
  overrides: Partial<LibraryItemWithBook> = {},
): LibraryItemWithBook {
  return {
    id: "item-1",
    userId: "user-1",
    status: "finished",
    currentPage: null,
    currentPercent: null,
    startedOn: null,
    finishedOn: null,
    rating: 5,
    reflection: "quiet but sharp",
    book: {
      id: "book-1",
      title: "Visible Book",
      subtitle: null,
      authors: ["Visible Author"],
      coverUrl: null,
      pageCount: 220,
    },
    ...overrides,
  };
}

const emptyRankings: ReadingRankings = {
  popular: [],
  rated: [],
  active: [],
};

describe("buildRecommendationQuery", () => {
  it("includes mode, conversation context, and provider-id exclusions while omitting abandoned books", () => {
    const query = buildRecommendationQuery(
      [
        libraryItem(),
        libraryItem({
          id: "item-2",
          status: "abandoned",
          book: {
            id: "book-2",
            title: "Abandoned Book",
            subtitle: null,
            authors: ["Hidden Author"],
            coverUrl: null,
            pageCount: 300,
          },
        }),
      ],
      emptyRankings,
      {
        mode: "conversation",
        conversation: ["I want something that continues the reflection."],
        hiddenProviderIds: ["kakao:hidden"],
        excludedProviderIds: ["naver:seen"],
      },
    );

    expect(query).toContain("Recommendation mode: conversation.");
    expect(query).toContain(
      "Conversation context:\n- I want something that continues the reflection.",
    );
    expect(query).toContain("Hidden provider IDs: kakao:hidden");
    expect(query).toContain("Excluded provider IDs: naver:seen");
    expect(query).toContain("- Visible Book by Visible Author");
    expect(query).not.toContain("Abandoned Book");
  });
});
