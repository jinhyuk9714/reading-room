import { BookOpenCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function SetupPanel() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--color-ink)]">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center">
        <div className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-sm md:p-10">
          <BookOpenCheck className="mb-6 size-9 text-[var(--color-forest)]" />
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">
            Reading Room 설정이 필요합니다.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-muted)] md:text-lg">
            `.env.example`을 `.env.local`로 복사한 뒤 Supabase 프로젝트 URL과
            publishable key를 채우면 Google 로그인과 클라우드 저장이
            활성화됩니다. 설정 전에도 앱은 안전하게 이 화면을 보여줍니다.
          </p>
          <div className="mt-8 max-w-full overflow-hidden rounded-md border border-[var(--color-line)] bg-white/70 p-4 font-mono text-sm leading-7 text-[var(--color-ink)]">
            <p className="break-all">
              NEXT_PUBLIC_SITE_URL=http://localhost:3000
            </p>
            <p className="break-all">NEXT_PUBLIC_SUPABASE_URL=...</p>
            <p className="break-all">
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
            </p>
          </div>
          <ButtonLink className="mt-8" href="/login" variant="secondary">
            로그인 화면 보기
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
