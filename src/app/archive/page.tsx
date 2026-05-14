import { Archive, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  deleteLibraryItemAction,
  restoreLibraryItemAction,
} from "@/app/actions/library";
import { ArchivedItemDeleteForm } from "@/components/archived-item-delete-form";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { AppShell } from "@/components/ui/app-shell";
import { BookCover } from "@/components/ui/book-cover";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { hasSupabaseEnv } from "@/lib/env";
import { getReadingRoom } from "@/lib/library/queries";
import { createClient } from "@/lib/supabase/server";
import { formatAuthors } from "@/lib/utils";

export default async function ArchivePage() {
  if (!hasSupabaseEnv()) {
    return <DemoReadingRoom initialView="archive" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { items } = await getReadingRoom(user.id);
  const archivedItems = items.filter((item) => item.status === "abandoned");

  return (
    <AppShell activeHref="/archive">
      <div className="flex flex-col gap-4">
        <PageHeader
          actions={
            <ButtonLink href="/library" size="sm" variant="secondary">
              서재로 이동
            </ButtonLink>
          }
          meta={`${archivedItems.length}권 보관 중`}
          title="보관함"
        />

        <section className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-md bg-[var(--color-soft)] text-[var(--color-forest)]">
              <Archive className="size-5" />
            </span>
            <h2 className="text-xl font-semibold">보관한 책</h2>
          </div>
          {archivedItems.length === 0 ? (
            <EmptyState title="보관한 책이 없습니다." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {archivedItems.map((item) => (
                <article
                  className="rounded-md border border-[var(--color-line)] bg-white/70 p-3"
                  key={item.id}
                >
                  <Link href={`/library/${item.id}`} prefetch={false}>
                    <BookCover
                      authors={item.book.authors}
                      className="mb-3 w-full"
                      coverUrl={item.book.coverUrl}
                      title={item.book.title}
                    />
                    <h3 className="line-clamp-2 font-semibold">
                      {item.book.title}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
                      {formatAuthors(item.book.authors)}
                    </p>
                  </Link>
                  <ArchivedItemDeleteForm
                    action={restoreLibraryItemAction}
                    confirmMessage=""
                    itemId={item.id}
                    variant="secondary"
                  >
                    <RotateCcw className="size-4" />
                    복원
                  </ArchivedItemDeleteForm>
                  <ArchivedItemDeleteForm
                    action={deleteLibraryItemAction}
                    itemId={item.id}
                  >
                    <Trash2 className="size-4" />
                    영구 삭제
                  </ArchivedItemDeleteForm>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
