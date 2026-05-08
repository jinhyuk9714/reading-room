import { BookOpen } from "lucide-react";
import Image from "next/image";
import { cn, formatAuthors } from "@/lib/utils";

type BookCoverProps = {
  title: string;
  authors?: string[] | null;
  coverUrl?: string | null;
  className?: string;
};

export function BookCover({
  title,
  authors,
  coverUrl,
  className,
}: BookCoverProps) {
  return (
    <div
      className={cn(
        "relative aspect-[2/3] overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-soft)] shadow-sm",
        className,
      )}
    >
      {coverUrl ? (
        <Image
          alt={`${title} 표지`}
          className="object-cover"
          fill
          sizes="(max-width: 768px) 30vw, 160px"
          src={coverUrl}
          unoptimized
        />
      ) : (
        <div className="flex h-full flex-col justify-between p-3 text-[var(--color-ink)]">
          <BookOpen aria-hidden className="size-5 text-[var(--color-forest)]" />
          <div>
            <p className="line-clamp-4 text-sm font-semibold leading-5">
              {title}
            </p>
            <p className="mt-2 line-clamp-2 text-xs text-[var(--color-muted)]">
              {formatAuthors(authors)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
