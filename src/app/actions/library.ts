"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { searchBooks } from "@/lib/books/search";
import type { BookProvider, BookSearchResult } from "@/lib/books/types";
import {
  actionError,
  actionSuccess,
  type ActionState,
  isReadingStatus,
  progressUpdateFields,
  sanitizeDatabaseError,
  statusUpdateFields,
  validateLibraryMetadata,
  validateRating,
} from "@/lib/library/validation";
import { validateReadingLog } from "@/lib/reading/progress";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, user };
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseAuthors(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .filter((author): author is string => typeof author === "string")
          .map((author) => author.trim())
          .filter(Boolean)
      : [];
  } catch {
    return value
      .split(",")
      .map((author) => author.trim())
      .filter(Boolean);
  }
}

function parseProvider(value: FormDataEntryValue | null): BookProvider {
  return value === "google" ||
    value === "open-library" ||
    value === "manual" ||
    value === "kakao" ||
    value === "naver"
    ? value
    : "manual";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

class UserFacingActionError extends Error {}

function userFacingError(message: string): never {
  throw new UserFacingActionError(message);
}

function actionErrorMessage(error: unknown) {
  if (error instanceof UserFacingActionError) {
    return error.message;
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function revalidateReadingRoom(itemId?: string | null) {
  revalidatePath("/", "layout");
  revalidatePath("/archive");
  revalidatePath("/rankings");
  revalidatePath("/recommendations");
  if (itemId) {
    revalidatePath(`/library/${itemId}`);
  }
}

function formatDatabaseError(error: { message?: string } | null | undefined) {
  return sanitizeDatabaseError(error);
}

function sameSearchResult(left: BookSearchResult, right: BookSearchResult) {
  const leftIsbn = left.isbn13 ?? left.isbn10;
  const rightIsbn = right.isbn13 ?? right.isbn10;

  return (
    (left.provider === right.provider && left.providerId === right.providerId) ||
    Boolean(leftIsbn && rightIsbn && leftIsbn === rightIsbn)
  );
}

async function verifySearchResultMetadata(book: BookSearchResult) {
  if (book.provider === "manual") {
    return book;
  }

  const queries = [
    book.isbn13,
    book.isbn10,
    [book.title, book.authors[0]].filter(Boolean).join(" "),
    book.title,
  ].filter((query): query is string => Boolean(query?.trim()));

  for (const query of queries) {
    const results = await searchBooks(query, { limit: 20, market: "kr" });
    const verified = results.find((result) => sameSearchResult(book, result));

    if (verified) {
      return verified;
    }
  }

  userFacingError("검색 결과를 다시 확인하지 못했습니다. 다시 검색한 뒤 추가해주세요.");
}

async function findOrInsertBook(
  supabase: Awaited<ReturnType<typeof createClient>>,
  book: BookSearchResult,
) {
  const { data: existingBook, error: existingError } = await supabase
    .from("books")
    .select("id")
    .eq("provider", book.provider)
    .eq("provider_id", book.providerId)
    .maybeSingle();

  if (existingError) {
    throw new Error(formatDatabaseError(existingError));
  }

  if (existingBook) {
    return existingBook;
  }

  const { data: insertedBook, error: insertError } = await supabase
    .from("books")
    .insert({
      provider: book.provider,
      provider_id: book.providerId,
      title: book.title,
      subtitle: book.subtitle,
      authors: book.authors,
      isbn_10: book.isbn10,
      isbn_13: book.isbn13,
      cover_url: book.coverUrl,
      page_count: book.pageCount,
      published_year: book.publishedYear,
      language: book.language,
      description: book.description,
      raw: book.raw,
    })
    .select("id")
    .single();

  if (insertError || !insertedBook) {
    if ("code" in (insertError ?? {}) && insertError?.code === "23505") {
      const { data: raceWinner, error: raceError } = await supabase
        .from("books")
        .select("id")
        .eq("provider", book.provider)
        .eq("provider_id", book.providerId)
        .single();

      if (!raceError && raceWinner) {
        return raceWinner;
      }
    }

    throw new Error(formatDatabaseError(insertError));
  }

  return insertedBook;
}

async function updateLibraryProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemId: string,
  currentPage: number | null,
  currentPercent: number | null,
) {
  const { data: currentItem, error: currentError } = await supabase
    .from("library_items")
    .select("status")
    .eq("id", itemId)
    .eq("user_id", userId)
    .single();

  if (currentError || !currentItem) {
    return formatDatabaseError(currentError);
  }

  const { data, error } = await supabase
    .from("library_items")
    .update(
      progressUpdateFields(
        currentItem.status,
        currentPage,
        currentPercent,
      ),
    )
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("id")
    .single();

  if (error || !data) {
    return formatDatabaseError(error);
  }

  return null;
}

async function addSearchResultToLibraryCore(formData: FormData) {
  const { supabase, user } = await requireUser();
  const book: BookSearchResult = {
    provider: parseProvider(formData.get("provider")),
    providerId: stringOrNull(formData.get("providerId")) ?? crypto.randomUUID(),
    title: stringOrNull(formData.get("title")) ?? "제목 없는 책",
    subtitle: stringOrNull(formData.get("subtitle")),
    authors: parseAuthors(formData.get("authors")),
    isbn10: stringOrNull(formData.get("isbn10")),
    isbn13: stringOrNull(formData.get("isbn13")),
    coverUrl: stringOrNull(formData.get("coverUrl")),
    pageCount: numberOrNull(formData.get("pageCount")),
    publishedYear: numberOrNull(formData.get("publishedYear")),
    language: stringOrNull(formData.get("language")),
    description: stringOrNull(formData.get("description")),
    raw: {},
  };
  const requestedStatus = stringOrNull(formData.get("status"));
  const initialStatus = isReadingStatus(requestedStatus)
    ? requestedStatus
    : "reading";

  const metadataErrors = validateLibraryMetadata({
    title: book.title,
    authors: book.authors,
    pageCount: book.pageCount,
  });

  if (metadataErrors.length > 0) {
    userFacingError(metadataErrors.join(" "));
  }

  const verifiedBook = await verifySearchResultMetadata(book);
  const savedBook = await findOrInsertBook(supabase, verifiedBook);

  const { data: libraryItem, error: libraryError } = await supabase
    .from("library_items")
    .upsert(
      {
        user_id: user.id,
        book_id: savedBook.id,
        ...statusUpdateFields(initialStatus, today()),
        started_on: initialStatus === "want_to_read" ? null : today(),
      },
      { onConflict: "user_id,book_id" },
    )
    .select("id")
    .single();

  if (libraryError || !libraryItem) {
    throw new Error(formatDatabaseError(libraryError));
  }

  revalidateReadingRoom(libraryItem.id);
  return libraryItem.id as string;
}

export async function addSearchResultToLibrary(formData: FormData) {
  const itemId = await addSearchResultToLibraryCore(formData);
  redirect(`/library/${itemId}`);
}

export async function addSearchResultToLibraryState(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let itemId: string;
  try {
    itemId = await addSearchResultToLibraryCore(formData);
  } catch (error) {
    return actionError(actionErrorMessage(error));
  }

  redirect(`/library/${itemId}`);
}

function prepareManualBookFormData(formData: FormData) {
  const nextFormData = new FormData();
  for (const [key, value] of formData.entries()) {
    nextFormData.set(key, value);
  }

  nextFormData.set("provider", "manual");
  nextFormData.set("providerId", `manual-${crypto.randomUUID()}`);
  nextFormData.set(
    "authors",
    JSON.stringify(parseAuthors(formData.get("authorsText"))),
  );
  return nextFormData;
}

export async function addManualBook(formData: FormData) {
  const itemId = await addSearchResultToLibraryCore(
    prepareManualBookFormData(formData),
  );
  redirect(`/library/${itemId}`);
}

export async function addManualBookState(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let itemId: string;
  try {
    itemId = await addSearchResultToLibraryCore(
      prepareManualBookFormData(formData),
    );
  } catch (error) {
    return actionError(actionErrorMessage(error));
  }

  redirect(`/library/${itemId}`);
}

export async function updateLibraryItemMetadataAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const itemId = stringOrNull(formData.get("libraryItemId"));
  const title = stringOrNull(formData.get("title"));
  const authors = parseAuthors(formData.get("authorsText"));
  const pageCount = numberOrNull(formData.get("pageCount"));

  if (!itemId) {
    return actionError("수정할 책을 찾지 못했습니다.");
  }

  const errors = validateLibraryMetadata({ title, authors, pageCount });
  if (errors.length > 0) {
    return actionError(errors.join(" "));
  }

  const { data, error } = await supabase
    .from("library_items")
    .update({
      custom_title: title,
      custom_authors: authors.length > 0 ? authors : null,
      custom_page_count: pageCount,
    })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return actionError(formatDatabaseError(error));
  }

  revalidateReadingRoom(itemId);
  return actionSuccess("책 정보를 저장했습니다.");
}

export async function addReadingLogAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const itemId = stringOrNull(formData.get("libraryItemId"));
  const pageCount = numberOrNull(formData.get("pageCount"));
  const currentPage = numberOrNull(formData.get("currentPage"));
  const currentPercent = numberOrNull(formData.get("currentPercent"));
  const pagesRead = numberOrNull(formData.get("pagesRead"));
  const note = stringOrNull(formData.get("note"));

  if (!itemId) {
    return actionError("기록할 책을 찾지 못했습니다.");
  }

  const validation = validateReadingLog({
    pageCount,
    currentPage,
    currentPercent,
    pagesRead,
    note,
  });

  if (!validation.ok) {
    return actionError(validation.errors.join(" "));
  }

  const { error: logError } = await supabase.from("reading_logs").insert({
    user_id: user.id,
    library_item_id: itemId,
    current_page: currentPage,
    current_percent: currentPercent,
    pages_read: pagesRead,
    note,
  });

  if (logError) {
    return actionError(formatDatabaseError(logError));
  }

  const progressError = await updateLibraryProgress(
    supabase,
    user.id,
    itemId,
    currentPage,
    currentPercent,
  );

  if (progressError) {
    return actionError(progressError);
  }

  revalidateReadingRoom(itemId);
  return actionSuccess("기록을 저장했습니다.");
}

export async function updateReadingLogAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const itemId = stringOrNull(formData.get("libraryItemId"));
  const logId = stringOrNull(formData.get("logId"));
  const pageCount = numberOrNull(formData.get("pageCount"));
  const currentPage = numberOrNull(formData.get("currentPage"));
  const currentPercent = numberOrNull(formData.get("currentPercent"));
  const pagesRead = numberOrNull(formData.get("pagesRead"));
  const note = stringOrNull(formData.get("note"));

  if (!itemId || !logId) {
    return actionError("수정할 기록을 찾지 못했습니다.");
  }

  const validation = validateReadingLog({
    pageCount,
    currentPage,
    currentPercent,
    pagesRead,
    note,
  });

  if (!validation.ok) {
    return actionError(validation.errors.join(" "));
  }

  const { data, error } = await supabase
    .from("reading_logs")
    .update({
      current_page: currentPage,
      current_percent: currentPercent,
      pages_read: pagesRead,
      note,
    })
    .eq("id", logId)
    .eq("library_item_id", itemId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return actionError(formatDatabaseError(error));
  }

  const progressError = await updateLibraryProgress(
    supabase,
    user.id,
    itemId,
    currentPage,
    currentPercent,
  );

  if (progressError) {
    return actionError(progressError);
  }

  revalidateReadingRoom(itemId);
  return actionSuccess("기록을 수정했습니다.");
}

export async function deleteReadingLogAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const itemId = stringOrNull(formData.get("libraryItemId"));
  const logId = stringOrNull(formData.get("logId"));

  if (!itemId || !logId) {
    return actionError("삭제할 기록을 찾지 못했습니다.");
  }

  const { data, error } = await supabase
    .from("reading_logs")
    .delete()
    .eq("id", logId)
    .eq("library_item_id", itemId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return actionError(formatDatabaseError(error));
  }

  const { data: latestLog, error: latestError } = await supabase
    .from("reading_logs")
    .select("current_page,current_percent")
    .eq("library_item_id", itemId)
    .eq("user_id", user.id)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    return actionError(formatDatabaseError(latestError));
  }

  const progressError = await updateLibraryProgress(
    supabase,
    user.id,
    itemId,
    latestLog?.current_page ?? null,
    latestLog?.current_percent ?? null,
  );

  if (progressError) {
    return actionError(progressError);
  }

  revalidateReadingRoom(itemId);
  return actionSuccess("기록을 삭제했습니다.");
}

export async function updateReadingStatusAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const itemId = stringOrNull(formData.get("libraryItemId"));
  const status = stringOrNull(formData.get("status"));

  if (!itemId || !isReadingStatus(status)) {
    return actionError("상태를 바꿀 책을 찾지 못했습니다.");
  }

  const { data, error } = await supabase
    .from("library_items")
    .update(statusUpdateFields(status, today()))
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return actionError(formatDatabaseError(error));
  }

  revalidateReadingRoom(itemId);
  return actionSuccess("상태를 저장했습니다.");
}

export async function finishBookAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const itemId = stringOrNull(formData.get("libraryItemId"));
  const rating = numberOrNull(formData.get("rating"));
  const reflection = stringOrNull(formData.get("reflection"));

  if (!itemId) {
    return actionError("완독할 책을 찾지 못했습니다.");
  }

  const ratingError = validateRating(rating);
  if (ratingError) {
    return actionError(ratingError);
  }

  if ((reflection?.length ?? 0) > 2000) {
    return actionError("회고는 2000자 이내로 남겨주세요.");
  }

  const { data, error } = await supabase
    .from("library_items")
    .update({
      status: "finished",
      finished_on: today(),
      rating,
      reflection,
    })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return actionError(formatDatabaseError(error));
  }

  revalidateReadingRoom(itemId);
  return actionSuccess("완독 회고를 저장했습니다.");
}

export async function archiveLibraryItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const itemId = stringOrNull(formData.get("libraryItemId"));

  if (!itemId) {
    return actionError("보관할 책을 찾지 못했습니다.");
  }

  const { data, error } = await supabase
    .from("library_items")
    .update(statusUpdateFields("abandoned", today()))
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return actionError(formatDatabaseError(error));
  }

  revalidateReadingRoom(itemId);
  return actionSuccess("책을 보관했습니다.");
}

export async function restoreLibraryItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const itemId = stringOrNull(formData.get("libraryItemId"));

  if (!itemId) {
    return actionError("복원할 책을 찾지 못했습니다.");
  }

  const { data, error } = await supabase
    .from("library_items")
    .update(statusUpdateFields("reading", today()))
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return actionError(formatDatabaseError(error));
  }

  revalidateReadingRoom(itemId);
  return actionSuccess("보관함에서 복원했습니다.");
}

export async function deleteLibraryItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const itemId = stringOrNull(formData.get("libraryItemId"));

  if (!itemId) {
    return actionError("삭제할 책을 찾지 못했습니다.");
  }

  const { data, error } = await supabase
    .from("library_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return actionError(formatDatabaseError(error));
  }

  revalidateReadingRoom(itemId);
  return actionSuccess("책을 삭제했습니다.");
}
