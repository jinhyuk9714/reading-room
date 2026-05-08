import { redirect } from "next/navigation";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { LibraryItemManager } from "@/components/library-item-manager";
import { hasSupabaseEnv } from "@/lib/env";
import { getLibraryItemDetail } from "@/lib/library/queries";
import { createClient } from "@/lib/supabase/server";

export default async function LibraryItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!hasSupabaseEnv()) {
    return <DemoReadingRoom detailId={id} initialView="detail" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { item, logs } = await getLibraryItemDetail(user.id, id);
  return <LibraryItemManager item={item} logs={logs} />;
}
