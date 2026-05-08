"use client";

import {
  BookOpen,
  Check,
  Clock3,
  Compass,
  Copy,
  ListFilter,
  MessageSquare,
  RefreshCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RecommendationAddForm } from "@/components/add-book-forms";
import { BookCover } from "@/components/ui/book-cover";
import { Button, ButtonLink } from "@/components/ui/button";
import type {
  RecommendationCard,
  RecommendationIntent,
} from "@/lib/recommendations/types";
import { cn, formatAuthors } from "@/lib/utils";

type PurposeId = "feed" | "continue" | "focus" | "short" | "explore";

type ConversationAction = {
  label?: string;
  prompt?: string;
};

type ExtendedRecommendationCard = RecommendationCard &
  Partial<{
    anchorTitles: string[];
    basedOn: string[];
    confidence: number | null;
    conversationActions: Array<ConversationAction | string>;
    conversationPrompts: string[];
    difficulty: string | null;
    edition: string | null;
    estimatedHours: number | null;
    fitScore: number | null;
    language: string | null;
    matchReasons: string[];
    matchScore: number | null;
    mood: string | null;
    nextStep: string | null;
    pace: string | null;
    prompts: string[];
    publishedYear: number | null;
    purpose: string | null;
    purposeLabel: string | null;
    purposes: string[];
    questions: string[];
    quickActions: Array<ConversationAction | string>;
    readingTime: string | null;
    signals: string[];
    tags: string[];
    themes: string[];
    tone: string | null;
    whyNow: string | null;
  }>;

type RecommendationDiscoveryProps = {
  context: {
    activeCount: number;
    finishedCount: number;
    libraryCount: number;
    rankingCount: number;
  };
  recommendations: ExtendedRecommendationCard[];
  usingFallback: boolean;
};

const purposes: Array<{
  icon: typeof Sparkles;
  id: PurposeId;
  label: string;
  tone: string;
}> = [
  {
    icon: Sparkles,
    id: "feed",
    label: "자동",
    tone: "서재 흐름",
  },
  {
    icon: RefreshCcw,
    id: "continue",
    label: "이어 읽기",
    tone: "가까운 결",
  },
  {
    icon: Target,
    id: "focus",
    label: "깊이 읽기",
    tone: "긴 호흡",
  },
  {
    icon: Clock3,
    id: "short",
    label: "짧게 완독",
    tone: "낮은 부담",
  },
  {
    icon: Compass,
    id: "explore",
    label: "새로운 결",
    tone: "탐색",
  },
];

const HIDDEN_RECOMMENDATIONS_KEY = "reading-room-hidden-recommendations-v1";

export function RecommendationDiscovery({
  context,
  recommendations,
  usingFallback,
}: RecommendationDiscoveryProps) {
  const [remoteCards, setRemoteCards] = useState<
    ExtendedRecommendationCard[] | null
  >(null);
  const cards = remoteCards ?? recommendations;
  const [hiddenKeys, setHiddenKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(HIDDEN_RECOMMENDATIONS_KEY) ?? "[]",
      ) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [purposeId, setPurposeId] = useState<PurposeId>("feed");
  const [selectedKey, setSelectedKey] = useState(() =>
    recommendations[0] ? cardKey(recommendations[0]) : "",
  );
  const [draft, setDraft] = useState(() =>
    recommendations[0] ? buildDefaultPrompt(recommendations[0], "feed") : "",
  );
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const visibleCards = useMemo(
    () => cards.filter((card) => !hiddenKeys.includes(cardKey(card))),
    [cards, hiddenKeys],
  );
  const scoredCards = useMemo(
    () => scoreCards(visibleCards, purposeId),
    [visibleCards, purposeId],
  );
  const selectedCard =
    scoredCards.find(({ card }) => cardKey(card) === selectedKey)?.card ??
    scoredCards[0]?.card ??
    null;
  const selectedPurpose =
    purposes.find((purpose) => purpose.id === purposeId) ?? purposes[0];
  const quickActions = selectedCard ? buildQuickActions(selectedCard) : [];

  function selectPurpose(nextPurposeId: PurposeId) {
    const sourceCards = nextPurposeId === "feed" ? recommendations : cards;
    const nextVisibleCards = sourceCards.filter(
      (card) => !hiddenKeys.includes(cardKey(card)),
    );
    const nextCards = scoreCards(nextVisibleCards, nextPurposeId);
    const nextCard = nextCards[0]?.card;

    setPurposeId(nextPurposeId);
    if (nextPurposeId === "feed") {
      setRemoteCards(null);
    }
    if (nextCard) {
      setSelectedKey(cardKey(nextCard));
      setDraft(buildDefaultPrompt(nextCard, nextPurposeId));
    }
    void loadPurposeRecommendations(nextPurposeId);
  }

  function selectCard(card: ExtendedRecommendationCard) {
    setSelectedKey(cardKey(card));
    setDraft(buildDefaultPrompt(card, purposeId));
    setCopied(false);
    void recordRecommendationEvent("opened", card, { purposeId });
  }

  async function copyDraft() {
    if (!draft) {
      return;
    }

    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function hideCard(card: ExtendedRecommendationCard) {
    const key = cardKey(card);
    setHiddenKeys((current) => {
      const next = [...new Set([...current, key])];
      window.localStorage.setItem(
        HIDDEN_RECOMMENDATIONS_KEY,
        JSON.stringify(next),
      );
      return next;
    });
    setSelectedKey((current) => (current === key ? "" : current));
    void recordRecommendationEvent("dismissed", card, { purposeId });
  }

  async function loadPurposeRecommendations(nextPurposeId: PurposeId) {
    if (nextPurposeId === "feed") {
      return;
    }

    await loadRemoteRecommendations({
      mode: "purpose",
      intent: intentForPurpose(nextPurposeId),
    });
  }

  async function loadConversationRecommendations(prompt: string) {
    await loadRemoteRecommendations({
      mode: "conversation",
      prompt,
      previousProviderIds: visibleCards.map(cardKey),
    });
  }

  async function loadRemoteRecommendations(payload: {
    mode: "purpose" | "conversation";
    intent?: RecommendationIntent;
    prompt?: string;
    previousProviderIds?: string[];
  }) {
    setLoading(true);
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          hiddenProviderIds: hiddenKeys,
          limit: 9,
        }),
      });
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as {
        results?: ExtendedRecommendationCard[];
      };
      if (body.results?.length) {
        setRemoteCards(body.results);
        setSelectedKey(cardKey(body.results[0]));
      }
    } finally {
      setLoading(false);
    }
  }

  if (visibleCards.length === 0) {
    return (
      <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--color-forest)]">
              자동 피드
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              추천 대기 중
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
              서재에 책이 쌓이면 다음 후보를 여기에서 정리합니다.
            </p>
          </div>
          <ButtonLink href="/search" variant="primary">
            <BookOpen className="size-4" />
            책 추가
          </ButtonLink>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_21rem]">
      <aside className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-forest)]">
          <ListFilter className="size-4" />
          목적
        </div>
        <div className="mt-4 grid gap-2">
          {purposes.map((purpose) => {
            const Icon = purpose.icon;
            const active = purpose.id === purposeId;

            return (
              <button
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-md border px-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-forest)]",
                  active
                    ? "border-[var(--color-forest)] bg-white text-[var(--color-ink)] shadow-sm"
                    : "border-[var(--color-line)] bg-white/50 text-[var(--color-muted)] hover:border-[var(--color-forest)] hover:bg-white",
                )}
                key={purpose.id}
                onClick={() => selectPurpose(purpose.id)}
                type="button"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md",
                    active
                      ? "bg-[var(--color-forest)] text-white"
                      : "bg-[var(--color-soft)] text-[var(--color-forest)]",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{purpose.label}</span>
                  <span className="block text-xs text-[var(--color-muted)]">
                    {purpose.tone}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
          <Metric label="서재" value={`${context.libraryCount}권`} />
          <Metric label="읽는 중" value={`${context.activeCount}권`} />
          <Metric label="완독" value={`${context.finishedCount}권`} />
          <Metric label="랭킹" value={`${context.rankingCount}개`} />
        </dl>

        <p className="mt-4 rounded-md border border-[var(--color-line)] bg-white/60 px-3 py-2 text-xs leading-5 text-[var(--color-muted)]">
          {usingFallback ? "검색 기반 피드" : "AI 조정 피드"} ·{" "}
          {visibleCards.length}권 정리됨{loading ? " · 갱신 중" : ""}
        </p>
      </aside>

      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-forest)]">
              <Sparkles className="size-4" />
              자동 피드
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {selectedPurpose.label} 후보
            </h2>
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            {scoredCards.length}권 · {selectedPurpose.tone}
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <div className="grid content-start gap-2">
            {scoredCards.map(({ card, score }) => (
              <FeedRow
                card={card}
                onHide={hideCard}
                key={cardKey(card)}
                onSelect={selectCard}
                score={score}
                selected={
                  selectedCard ? cardKey(selectedCard) === cardKey(card) : false
                }
              />
            ))}
          </div>

          {selectedCard ? (
            <SelectedRecommendation
              card={selectedCard}
              onHide={hideCard}
              purposeId={purposeId}
            />
          ) : null}
        </div>
      </div>

      <aside className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-forest)]">
          <MessageSquare className="size-4" />
          빠른 대화
        </div>

        {selectedCard ? (
          <>
            <h2 className="mt-3 line-clamp-2 text-xl font-semibold">
              {selectedCard.title}
            </h2>
            <div className="mt-4 grid gap-2">
              {quickActions.map((action) => (
                <button
                  className="rounded-md border border-[var(--color-line)] bg-white/60 px-3 py-2 text-left text-sm font-medium transition hover:border-[var(--color-forest)] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-forest)]"
                  key={action.label}
                  onClick={() => {
                    setDraft(action.prompt);
                    setCopied(false);
                    void loadConversationRecommendations(action.prompt);
                  }}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-xs font-medium text-[var(--color-muted)]">
              대화 초안
              <textarea
                className="mt-2 min-h-40 w-full resize-none rounded-md border border-[var(--color-line)] bg-white/80 p-3 text-sm leading-6 text-[var(--color-ink)] outline-none focus:border-[var(--color-forest)]"
                onChange={(event) => {
                  setDraft(event.target.value);
                  setCopied(false);
                }}
                value={draft}
              />
            </label>
            <Button
              className="mt-3 w-full"
              onClick={copyDraft}
              type="button"
              variant="secondary"
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "복사됨" : "복사"}
            </Button>
          </>
        ) : (
          <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
            후보를 선택하면 대화 초안이 열립니다.
          </p>
        )}
      </aside>
    </section>
  );
}

async function recordRecommendationEvent(
  eventType: "opened" | "dismissed",
  card: ExtendedRecommendationCard,
  metadata: Record<string, string>,
) {
  try {
    await fetch("/api/recommendations/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, card, metadata }),
      keepalive: true,
    });
  } catch {
    // Recommendation feedback is a personalization hint, not a blocking action.
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-white/60 p-3">
      <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function FeedRow({
  card,
  onHide,
  onSelect,
  score,
  selected,
}: {
  card: ExtendedRecommendationCard;
  onHide: (card: ExtendedRecommendationCard) => void;
  onSelect: (card: ExtendedRecommendationCard) => void;
  score: number;
  selected: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-md border bg-white/60 p-3 transition",
        selected
          ? "border-[var(--color-forest)] bg-white shadow-sm"
          : "border-[var(--color-line)] hover:border-[var(--color-forest)] hover:bg-white",
      )}
    >
      <button
        className="grid w-full grid-cols-[3.75rem_minmax(0,1fr)] gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-forest)]"
        onClick={() => onSelect(card)}
        type="button"
      >
        <BookCover
          authors={card.authors}
          className="w-[3.75rem] shrink-0"
          coverUrl={card.coverUrl}
          title={card.title}
        />
        <span className="min-w-0">
          <span className="line-clamp-2 font-semibold">{card.title}</span>
          <span className="mt-1 block line-clamp-1 text-sm text-[var(--color-muted)]">
            {formatAuthors(card.authors)}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
            <span>{sourceLabel(card)}</span>
            <span aria-hidden="true">·</span>
            <span>{scoreLabel(card, score)}</span>
          </span>
        </span>
      </button>
      <button
        className="mt-3 text-xs font-medium text-[var(--color-muted)] underline-offset-4 hover:text-[var(--color-forest)] hover:underline"
        onClick={() => onHide(card)}
        type="button"
      >
        이 책 제외
      </button>
    </article>
  );
}

function SelectedRecommendation({
  card,
  onHide,
  purposeId,
}: {
  card: ExtendedRecommendationCard;
  onHide: (card: ExtendedRecommendationCard) => void;
  purposeId: PurposeId;
}) {
  const chips = uniqueStrings([
    inferredPurposeLabel(card, purposeId),
    ...readStringArray(card, ["tags", "themes", "purposes"]).slice(0, 3),
  ]).slice(0, 4);
  const signals = recommendationSignals(card).slice(0, 4);
  const meta = recommendationMeta(card);

  return (
    <article className="rounded-md border border-[var(--color-line)] bg-white/70 p-4">
      <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <BookCover
          authors={card.authors}
          className="w-full"
          coverUrl={card.coverUrl}
          title={card.title}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                className="rounded-md border border-[var(--color-line)] bg-[var(--color-soft)] px-2 py-1 text-xs font-medium text-[var(--color-forest)]"
                key={chip}
              >
                {chip}
              </span>
            ))}
          </div>
          <h3 className="mt-3 text-2xl font-semibold leading-tight tracking-tight">
            {card.title}
          </h3>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {formatAuthors(card.authors)}
          </p>
          {meta.length > 0 ? (
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              {meta.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
        {card.reason}
      </p>

      {signals.length > 0 ? (
        <ul className="mt-4 grid gap-2 text-sm text-[var(--color-muted)]">
          {signals.map((signal) => (
            <li className="flex gap-2" key={signal}>
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-forest)]" />
              <span>{signal}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
        <RecommendationAddForm card={card} />
        <Button
          className="mt-2"
          onClick={() => onHide(card)}
          size="sm"
          type="button"
          variant="ghost"
        >
          이 책 제외
        </Button>
      </div>
    </article>
  );
}

function intentForPurpose(purposeId: PurposeId): RecommendationIntent {
  switch (purposeId) {
    case "continue":
      return {
        mood: "calm",
        length: "medium",
        difficulty: "medium",
        purpose: "최근 읽은 책과 비슷한 결",
      };
    case "focus":
      return {
        mood: "sharp",
        length: "long",
        difficulty: "deep",
        purpose: "깊이 읽기",
      };
    case "short":
      return {
        mood: "calm",
        length: "short",
        difficulty: "easy",
        purpose: "짧게 완독",
      };
    case "explore":
      return {
        mood: "warm",
        length: "medium",
        difficulty: "medium",
        purpose: "새로운 장르 탐색",
      };
    case "feed":
      return {};
  }
}

function scoreCards(cards: ExtendedRecommendationCard[], purposeId: PurposeId) {
  return cards
    .map((card, index) => ({
      card,
      score: scoreCard(card, purposeId, index),
    }))
    .sort((left, right) => right.score - left.score);
}

function scoreCard(
  card: ExtendedRecommendationCard,
  purposeId: PurposeId,
  index: number,
) {
  const text = recommendationText(card);
  const pageCount = card.pageCount ?? 0;
  const explicitScore = normalizedNumber(
    card.fitScore ?? card.confidence ?? card.matchScore,
  );
  const base = explicitScore ?? Math.max(12, 80 - index * 7);

  if (purposeId === "feed") {
    return base;
  }

  if (purposeId === "continue") {
    return (
      base +
      keywordScore(text, ["이어", "계속", "비슷", "결", "현재", "continue", "similar"]) +
      readStringArray(card, ["anchorTitles", "basedOn"]).length * 8
    );
  }

  if (purposeId === "focus") {
    return (
      base +
      keywordScore(text, ["깊", "사유", "철학", "연구", "복합", "focus", "deep"]) +
      (pageCount >= 320 ? 16 : 0)
    );
  }

  if (purposeId === "short") {
    return (
      base +
      keywordScore(text, ["짧", "가볍", "빠르", "입문", "short", "brief"]) +
      (pageCount > 0 && pageCount <= 260 ? 22 : 0)
    );
  }

  return (
    base +
    keywordScore(text, ["낯선", "새로운", "확장", "탐색", "다른", "explore", "new"]) +
    readStringArray(card, ["tags", "themes"]).length * 4
  );
}

function keywordScore(text: string, keywords: string[]) {
  return keywords.reduce(
    (score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 10 : 0),
    0,
  );
}

function recommendationText(card: ExtendedRecommendationCard) {
  return [
    card.title,
    card.reason,
    card.purpose,
    card.purposeLabel,
    card.mood,
    card.tone,
    card.pace,
    card.difficulty,
    ...card.authors,
    ...readStringArray(card, [
      "anchorTitles",
      "basedOn",
      "matchReasons",
      "purposes",
      "signals",
      "tags",
      "themes",
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function recommendationMeta(card: ExtendedRecommendationCard) {
  return [
    card.pageCount ? `${card.pageCount}쪽` : null,
    card.publishedYear ? `${card.publishedYear}` : null,
    card.edition,
    card.readingTime,
    card.estimatedHours ? `${card.estimatedHours}시간` : null,
    card.pace,
    sourceLabel(card),
  ].filter((item): item is string => Boolean(item));
}

function recommendationSignals(card: ExtendedRecommendationCard) {
  const explicitSignals = readStringArray(card, [
    "matchReasons",
    "signals",
    "basedOn",
    "anchorTitles",
  ]);

  return uniqueStrings([
    ...explicitSignals,
    card.whyNow,
    card.nextStep,
    explicitSignals.length === 0 ? card.reason : null,
  ]);
}

function buildQuickActions(card: ExtendedRecommendationCard) {
  const provided = [
    ...normalizeActions(card.conversationActions),
    ...normalizeActions(card.quickActions),
    ...readStringArray(card, ["conversationPrompts", "prompts", "questions"]).map(
      (prompt, index) => ({
        label: quickLabel(prompt, index),
        prompt,
      }),
    ),
  ];

  if (provided.length > 0) {
    return provided.slice(0, 4);
  }

  return [
    {
      label: "추천 이유",
      prompt: `"${card.title}"가 내 서재 흐름과 맞는 이유를 구체적으로 정리해줘.`,
    },
    {
      label: "비교",
      prompt: `"${card.title}"와 내가 최근 읽은 책의 공통점과 차이를 알려줘.`,
    },
    {
      label: "읽기 계획",
      prompt: `"${card.title}"를 부담 없이 읽기 위한 7일 계획을 만들어줘.`,
    },
    {
      label: "대화 질문",
      prompt: `"${card.title}"를 읽으며 남길 만한 질문 5개를 제안해줘.`,
    },
  ];
}

function buildDefaultPrompt(
  card: ExtendedRecommendationCard,
  purposeId: PurposeId,
) {
  const purposeLabel =
    purposes.find((purpose) => purpose.id === purposeId)?.label ?? "자동";
  return `"${card.title}"를 ${purposeLabel} 후보로 검토하고 싶어. 내 서재 흐름과 맞는 이유, 읽기 전에 볼 포인트, 다 읽은 뒤 남길 질문을 정리해줘.`;
}

function normalizeActions(
  value: Array<ConversationAction | string> | undefined,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((action, index) => {
      if (typeof action === "string") {
        return {
          label: quickLabel(action, index),
          prompt: action,
        };
      }

      if (!action.prompt) {
        return null;
      }

      return {
        label: action.label ?? quickLabel(action.prompt, index),
        prompt: action.prompt,
      };
    })
    .filter((action): action is { label: string; prompt: string } =>
      Boolean(action),
    );
}

function quickLabel(prompt: string, index: number) {
  const trimmed = prompt.trim();

  if (!trimmed) {
    return `초안 ${index + 1}`;
  }

  return trimmed.length > 12 ? `${trimmed.slice(0, 12)}...` : trimmed;
}

function inferredPurposeLabel(
  card: ExtendedRecommendationCard,
  purposeId: PurposeId,
) {
  return (
    card.purposeLabel ??
    card.purpose ??
    purposes.find((purpose) => purpose.id === purposeId)?.tone ??
    "추천"
  );
}

function sourceLabel(card: RecommendationCard) {
  if (card.source === "openai") {
    return "AI 추천";
  }

  if (card.source === "search-fallback") {
    return "검색 기반";
  }

  return "추천";
}

function scoreLabel(card: ExtendedRecommendationCard, score: number) {
  const explicitScore = normalizedNumber(
    card.fitScore ?? card.confidence ?? card.matchScore,
  );

  return `${Math.round(explicitScore ?? Math.min(score, 100))}% 적합`;
}

function normalizedNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 1) {
    return value * 100;
  }

  return Math.min(value, 100);
}

function readStringArray(
  card: ExtendedRecommendationCard,
  keys: Array<keyof ExtendedRecommendationCard>,
) {
  return keys.flatMap((key) => toStringArray(card[key]));
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string" && value.trim()) {
    return [value];
  }

  return [];
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    results.push(trimmed);
  }

  return results;
}

function cardKey(card: RecommendationCard) {
  return `${card.provider}:${card.providerId}`;
}
