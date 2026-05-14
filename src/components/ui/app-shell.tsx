import {
  Archive,
  BarChart3,
  BookOpen,
  Compass,
  Library,
  LogOut,
  Plus,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "독서장", icon: BookOpen },
  { href: "/library", label: "서재", icon: Library },
  { href: "/search", label: "책 추가", icon: Plus },
  { href: "/recommendations", label: "발견", icon: Compass },
  { href: "/insights", label: "인사이트", icon: BarChart3 },
  { href: "/archive", label: "보관함", icon: Archive },
];

type AppShellProps = {
  activeHref: string;
  children: ReactNode;
};

export function AppShell({ activeHref, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--color-ink)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
        <aside className="border-b border-[var(--color-line)] bg-[var(--color-paper)] md:flex md:w-56 md:flex-col md:border-b-0 md:border-r">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:px-4 md:py-5">
            <Link className="block" href="/">
              <p className="text-sm font-semibold leading-none">Reading Room</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                개인 독서장
              </p>
            </Link>
            <form action={signOut} className="md:hidden">
              <Button aria-label="로그아웃" size="icon" type="submit" variant="ghost">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>

          <nav
            aria-label="주요 메뉴"
            className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:px-3 md:pb-0"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeHref === item.href;

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition",
                    active
                      ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-ink)]",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <form action={signOut} className="mt-auto hidden p-3 md:block">
            <Button className="w-full justify-start" type="submit" variant="ghost">
              <LogOut className="size-4" />
              로그아웃
            </Button>
          </form>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
