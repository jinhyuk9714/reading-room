import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "border-transparent bg-[var(--color-ink)] text-[var(--color-paper)] shadow-sm hover:bg-[var(--color-forest)]",
  secondary:
    "border-[var(--color-line)] bg-white/70 text-[var(--color-ink)] hover:border-[var(--color-forest)] hover:bg-white",
  ghost:
    "border-transparent bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-ink)]",
  danger:
    "border-transparent bg-[var(--color-burgundy)] text-white hover:bg-[#743228]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "size-10 p-0",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

function buttonClassName({
  className,
  variant = "primary",
  size = "md",
}: {
  className?: string;
  variant?: Variant;
  size?: Size;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md border font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-forest)] disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({ className, variant, size })}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  href,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName({ className, variant, size })}
      href={href}
      {...props}
    />
  );
}
