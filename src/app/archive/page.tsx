import { Archive, LogOut, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  deleteLibraryItemAction,
  restoreLibraryItemAction,
} from "@/app/actions/library";
import { signOut } from "@/app/actions/auth";
import { ArchivedItemDeleteForm } from "@/components/archived-item-delete-form";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { BookCover } from "@/components/ui/book-cover";
import { Button, ButtonLink } from "@/components/ui/button";
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
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Reading Room</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              보관함
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/" variant="secondary">
              독서장
            </ButtonLink>
            <form action={signOut}>
              <Button type="submit" variant="ghost">
                <LogOut className="size-4" />
                로그아웃
              </Button>
            </form>
          </div>
        </header>

        <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-md bg-[var(--color-soft)] text-[var(--color-forest)]">
              <Archive className="size-5" />
            </span>
            <h2 className="text-xl font-semibold">보관한 책</h2>
          </div>
          {archivedItems.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--color-line)] bg-white/50 p-5 text-sm leading-6 text-[var(--color-muted)]">
              보관한 책이 없습니다.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {archivedItems.map((item) => (
                <article
                  className="rounded-md border border-[var(--color-line)] bg-white/70 p-3"
                  key={item.id}
                >
                  <Link href={`/library/${item.id}`}>
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
    </main>
  );
}
