import type { ReadingRankings } from "@/lib/rankings";
import type { LibraryItemWithBook } from "@/lib/reading/types";
import type {
  RecommendationIntent,
  RecommendationMode,
} from "@/lib/recommendations/types";
import { formatAuthors } from "@/lib/utils";

type RecommendationContextOptions = {
  mode?: RecommendationMode;
  intent?: RecommendationIntent;
  conversation?: string[];
  hiddenProviderIds?: string[];
  excludedProviderIds?: string[];
  previousProviderIds?: string[];
};

export function buildRecommendationQuery(
  items: LibraryItemWithBook[],
  rankings?: ReadingRankings,
  options: RecommendationContextOptions = {},
) {
  const visibleItems = items.filter((item) => item.status !== "abandoned");
  const finished = visibleItems
    .filter((item) => item.status === "finished")
    .slice(0, 5);
  const current = visibleItems
    .filter((item) => item.status === "reading")
    .slice(0, 5);
  const ranked = rankings?.popular.slice(0, 4) ?? [];

  if (visibleItems.length === 0 && ranked.length === 0) {
    return "quiet reflective books for someone starting a personal reading habit";
  }

  const lines = [
    "Recommend books for a Korean personal reading room app.",
    "Avoid books already in the user's library when possible.",
  ];

  if (options.mode) {
    lines.push(`Recommendation mode: ${options.mode}.`);
  }

  const intentParts = [
    options.intent?.mood ? `mood=${options.intent.mood}` : null,
    options.intent?.length ? `length=${options.intent.length}` : null,
    options.intent?.difficulty
      ? `difficulty=${options.intent.difficulty}`
      : null,
    options.intent?.genres?.length
      ? `genres=${options.intent.genres.join(", ")}`
      : null,
    options.intent?.purpose ? `purpose=${options.intent.purpose}` : null,
  ].filter(Boolean);

  if (intentParts.length > 0) {
    lines.push(`Recommendation intent: ${intentParts.join("; ")}`);
  }

  if (options.conversation?.length) {
    lines.push("Conversation context:");
    lines.push(
      options.conversation
        .map((message) => message.trim())
        .filter(Boolean)
        .map((message) => `- ${message}`)
        .join("\n"),
    );
  }

  if (options.previousProviderIds?.length) {
    lines.push(`Previous provider IDs: ${options.previousProviderIds.join(", ")}`);
  }

  if (options.hiddenProviderIds?.length) {
    lines.push(`Hidden provider IDs: ${options.hiddenProviderIds.join(", ")}`);
  }

  if (options.excludedProviderIds?.length) {
    lines.push(`Excluded provider IDs: ${options.excludedProviderIds.join(", ")}`);
  }

  if (finished.length > 0) {
    lines.push("Finished books:");
    lines.push(
      finished
        .map(
          (item) =>
            `- ${item.book.title} by ${formatAuthors(item.book.authors)}${
              item.reflection ? `; reflection: ${item.reflection}` : ""
            }`,
        )
        .join("\n"),
    );
  }

  if (current.length > 0) {
    lines.push("Currently reading:");
    lines.push(
      current
        .map((item) => `- ${item.book.title} by ${formatAuthors(item.book.authors)}`)
        .join("\n"),
    );
  }

  if (ranked.length > 0) {
    lines.push("Anonymous ranking candidates:");
    lines.push(ranked.map((book) => `- ${book.title}`).join("\n"));
  }

  return lines.join("\n");
}
