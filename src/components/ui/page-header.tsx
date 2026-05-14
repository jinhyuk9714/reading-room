import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, eyebrow, meta, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-[var(--color-line)] pb-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-medium text-[var(--color-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {meta ? (
          <div className="mt-2 text-sm text-[var(--color-muted)]">{meta}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
