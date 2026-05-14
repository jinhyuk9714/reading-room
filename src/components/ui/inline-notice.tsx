import { cn } from "@/lib/utils";

type InlineNoticeProps = {
  children: string;
  tone?: "neutral" | "success" | "error";
  className?: string;
};

export function InlineNotice({
  children,
  tone = "neutral",
  className,
}: InlineNoticeProps) {
  const tones = {
    neutral: "border-[var(--color-line)] bg-white/70 text-[var(--color-muted)]",
    success:
      "border-[var(--color-forest)]/25 bg-[var(--color-soft)] text-[var(--color-ink)]",
    error:
      "border-[var(--color-burgundy)]/25 bg-white text-[var(--color-burgundy)]",
  };

  return (
    <p
      aria-live="polite"
      className={cn("mt-3 rounded-md border p-3 text-sm leading-6", tones[tone], className)}
    >
      {children}
    </p>
  );
}
