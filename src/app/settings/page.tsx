import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";
import { AppShell } from "@/components/ui/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/inline-notice";
import { PageHeader } from "@/components/ui/page-header";
import { hasSupabaseEnv } from "@/lib/env";
import { getReaderPreferences } from "@/lib/library/queries";
import { defaultReaderPreferences } from "@/lib/reader-preferences";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  if (!hasSupabaseEnv()) {
    return (
      <AppShell activeHref="/settings">
        <div className="flex flex-col gap-4">
          <PageHeader
            actions={
              <ButtonLink href="/demo" size="sm" variant="secondary">
                데모로 돌아가기
              </ButtonLink>
            }
            meta="체험 모드"
            title="설정"
          />
          <InlineNotice>
            로컬 데모에서는 기본 설정으로 화면을 확인하고, Supabase 연결 후
            개인 목표와 선호를 저장합니다.
          </InlineNotice>
          <SettingsForm preferences={defaultReaderPreferences} readOnly />
        </div>
      </AppShell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const preferences = await getReaderPreferences(user.id);

  return (
    <AppShell activeHref="/settings">
      <div className="flex flex-col gap-4">
        <PageHeader
          meta="목표와 추천 선호를 조정합니다."
          title="설정"
        />
        <SettingsForm preferences={preferences} />
      </div>
    </AppShell>
  );
}
