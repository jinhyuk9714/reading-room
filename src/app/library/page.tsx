import { Filter, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { AppShell } from "@/components/ui/app-shell";
import { BookCard } from "@/components/ui/book-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { hasSupabaseEnv } from "@/lib/env";
import { getReadingRoom } from "@/lib/library/queries";
import type { LibraryItemWithBook, ReadingStatus } from "@/lib/reading/types";
import { createClient } from "@/lib/supabase/server";

const sections: Array<{
  id: ReadingStatus;
  title: string;
  label: string;
  empty: string;
}> = [
  {
    id: "reading",
    title: "읽는 중",
    label: "읽는 중",
    empty: "진행 중인 책이 없습니다.",
  },
  {
    id: "want_to_read",
    title: "읽고 싶은 책",
    label: "읽고 싶음",
    empty: "대기열이 비어 있습니다.",
  },
  {
    id: "paused",
    title: "멈춘 책",
    label: "멈춤",
    empty: "멈춘 책이 없습니다.",
  },
  {
    id: "finished",
    title: "완독",
    label: "완독",
    empty: "완독한 책이 없습니다.",
  },
];

export default async function LibraryPage() {
  if (!hasSupabaseEnv()) {
    return <DemoReadingRoom initialView="library" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { items } = await getReadingRoom(user.id);
  const grouped = groupByStatus(items);
  const visibleCount = sections.reduce(
    (count, section) => count + grouped[section.id].length,
    0,
  );

  return (
    <AppShell activeHref="/library">
      <div className="flex flex-col gap-4">
        <PageHeader
          actions={
            <ButtonLink href="/search" size="sm" variant="primary">
              <Plus className="size-4" />책 추가
            </ButtonLink>
          }
          meta={`${visibleCount}권 · 최근 업데이트순`}
          title="서재"
        />

        <div className="flex flex-col gap-2 rounded-md border border-[var(--color-line)] bg-white/35 p-3 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="상태 필터" className="flex gap-1 overflow-x-auto">
            {sections.map((section) => (
              <a
                className="flex h-9 shrink-0 items-center rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 text-sm font-medium hover:border-[var(--color-forest)]"
                href={`#${section.id}`}
                key={section.id}
              >
                {section.label}
                <span className="ml-2 text-xs text-[var(--color-muted)]">
                  {grouped[section.id].length}
                </span>
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <Filter className="size-4" />
            <span>상태별 · 최근 업데이트순</span>
          </div>
        </div>

        <div className="grid gap-4">
          {sections.map((section) => (
            <section
              className="scroll-mt-4 rounded-md border border-[var(--color-line)] bg-white/35 p-3"
              id={section.id}
              key={section.id}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">{section.title}</h2>
                <span className="text-sm text-[var(--color-muted)]">
                  {grouped[section.id].length}권
                </span>
              </div>
              {grouped[section.id].length === 0 ? (
                <EmptyState title={section.empty} />
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {grouped[section.id].map((item) => (
                    <BookCard item={item} key={item.id} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function groupByStatus(items: LibraryItemWithBook[]) {
  return {
    reading: items.filter((item) => item.status === "reading"),
    want_to_read: items.filter((item) => item.status === "want_to_read"),
    paused: items.filter((item) => item.status === "paused"),
    finished: items.filter((item) => item.status === "finished"),
    abandoned: items.filter((item) => item.status === "abandoned"),
  };
}
