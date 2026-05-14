"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { idleActionState, type ActionState } from "@/lib/library/validation";

type ArchivedItemDeleteFormProps = {
  action: (_prevState: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  confirmMessage?: string;
  itemId: string;
  variant?: "secondary" | "danger";
};

export function ArchivedItemDeleteForm({
  action,
  children,
  confirmMessage = "이 책과 기록을 모두 삭제할까요?",
  itemId,
  variant = "danger",
}: ArchivedItemDeleteFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, idleActionState);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form
      action={formAction}
      className="mt-3"
      onSubmit={(event) => {
        if (confirmMessage && !confirming) {
          event.preventDefault();
          setConfirming(true);
        }
      }}
    >
      <input name="libraryItemId" type="hidden" value={itemId} />
      <Button disabled={pending} size="sm" type="submit" variant={variant}>
        {children}
      </Button>
      {confirming && confirmMessage ? (
        <ConfirmPanel
          confirmLabel="삭제 확인"
          description={confirmMessage}
          onCancel={() => setConfirming(false)}
          pending={pending}
          title="보관한 책을 영구 삭제할까요?"
        />
      ) : null}
      {state.status === "error" ? (
        <p className="mt-2 text-sm text-[var(--color-burgundy)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
