import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-line)] bg-white/45 p-4">
      <p className="text-sm font-medium">{title}</p>
      {body ? (
        <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
