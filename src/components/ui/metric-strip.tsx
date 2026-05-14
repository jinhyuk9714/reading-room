import type { ReactNode } from "react";

export type MetricStripItem = {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
};

export function MetricStrip({ items }: { items: MetricStripItem[] }) {
  return (
    <section
      aria-label="요약 지표"
      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map((item) => (
        <div
          className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-3"
          key={item.label}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-[var(--color-muted)]">
              {item.label}
            </p>
            {item.icon ? (
              <span className="text-[var(--color-forest)]">{item.icon}</span>
            ) : null}
          </div>
          <p className="mt-2 text-2xl font-semibold leading-none">{item.value}</p>
          {item.detail ? (
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              {item.detail}
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
