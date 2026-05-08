import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const width = Math.min(Math.max(value, 0), 100);

  return (
    <div
      aria-label={`독서 진행률 ${width}%`}
      className={cn(
        "h-2 overflow-hidden rounded-full bg-[var(--color-soft)]",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-[var(--color-forest)]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
