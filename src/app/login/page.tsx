import { BookOpen, KeyRound } from "lucide-react";
import { signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { hasGoogleOAuthEnabled, hasSupabaseEnv } from "@/lib/env";

const authErrorMessages: Record<string, string> = {
  "google-oauth-disabled":
    "Google OAuth 설정이 아직 켜지지 않았습니다. 설정이 끝나면 로그인 버튼이 활성화됩니다.",
  "missing-env": "Supabase 환경 변수가 아직 설정되지 않았습니다.",
  callback: "로그인 콜백 처리 중 문제가 생겼습니다.",
  oauth: "OAuth 로그인 요청을 시작하지 못했습니다.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const configured = hasSupabaseEnv();
  const googleReady = configured && hasGoogleOAuthEnabled();
  const errorMessage = params.error
    ? (authErrorMessages[params.error] ??
      `로그인 설정을 확인해주세요. 오류 코드: ${params.error}`)
    : null;

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--color-ink)]">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full gap-8 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-sm md:grid-cols-[1.1fr_0.9fr] md:p-10">
          <div className="flex flex-col justify-between gap-12">
            <div>
              <BookOpen className="mb-6 size-8 text-[var(--color-forest)]" />
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight md:text-6xl">
                조용히 쌓이는 나만의 독서장
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-[var(--color-muted)] md:text-lg">
                책을 검색해 서재에 넣고, 오늘 읽은 페이지와 한 줄 메모만
                남기세요. 기록은 작게, 회고는 오래 남도록 만들었습니다.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-[var(--color-muted)] sm:grid-cols-3">
              <span>짧은 진행 기록</span>
              <span>개인 비공개 서재</span>
              <span>모바일/데스크톱 지원</span>
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-line)] bg-white/75 p-5">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-md bg-[var(--color-soft)] text-[var(--color-forest)]">
                <KeyRound className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">로그인</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Google 계정으로 독서장을 엽니다.
                </p>
              </div>
            </div>

            {!configured ? (
              <div className="rounded-md border border-[var(--color-brass)]/30 bg-[#fff8e6] p-4 text-sm leading-6 text-[var(--color-ink)]">
                <p className="font-medium">Supabase 설정이 필요합니다.</p>
                <p className="mt-2 text-[var(--color-muted)]">
                  `.env.example`을 `.env.local`로 복사한 뒤 Supabase URL과
                  publishable key를 채워주세요.
                </p>
              </div>
            ) : !googleReady ? (
              <div className="space-y-4">
                <div className="rounded-md border border-[var(--color-brass)]/30 bg-[#fff8e6] p-4 text-sm leading-6 text-[var(--color-ink)]">
                  <p className="font-medium">Google 로그인을 준비 중입니다.</p>
                  <p className="mt-2 text-[var(--color-muted)]">
                    Supabase의 Google provider 설정이 끝나면 이 버튼이
                    활성화됩니다.
                  </p>
                </div>
                <Button className="w-full" disabled size="lg" type="button">
                  Google 로그인 준비 중
                </Button>
              </div>
            ) : (
              <form action={signInWithGoogle}>
                <Button className="w-full" size="lg" type="submit">
                  Google로 계속하기
                </Button>
              </form>
            )}

            {errorMessage ? (
              <p className="mt-4 text-sm text-[var(--color-burgundy)]">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
