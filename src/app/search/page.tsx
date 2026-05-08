import { Search } from "lucide-react";
import { redirect } from "next/navigation";
import {
  ManualBookForm,
  SearchResultAddCard,
} from "@/components/add-book-forms";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { Button, ButtonLink } from "@/components/ui/button";
import { searchBooks } from "@/lib/books/search";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return <DemoReadingRoom initialView="search" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const results = query ? await searchBooks(query, { limit: 12 }) : [];

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted)]">책 추가</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              검색해서 서재에 넣기
            </h1>
          </div>
          <ButtonLink href="/" variant="secondary">
            독서장으로
          </ButtonLink>
        </header>

        <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
          <form className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="q">
              책 제목 또는 저자 검색
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                className="h-12 w-full rounded-md border border-[var(--color-line)] bg-white pl-10 pr-3 text-base outline-none transition focus:border-[var(--color-forest)]"
                defaultValue={query}
                id="q"
                name="q"
                placeholder="책 제목, 저자, ISBN"
              />
            </div>
            <Button size="lg" type="submit">
              검색
            </Button>
          </form>
        </section>

        {query ? (
          <section className="mt-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
            <h2 className="text-xl font-semibold">검색 결과</h2>
            {results.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
                검색 결과가 없습니다. 아래에서 직접 입력할 수 있습니다.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {results.map((book) => (
                  <SearchResultAddCard
                    book={book}
                    key={`${book.provider}:${book.providerId}`}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="mt-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
          <h2 className="text-xl font-semibold">직접 입력</h2>
          <ManualBookForm />
        </section>
      </div>
    </main>
  );
}
