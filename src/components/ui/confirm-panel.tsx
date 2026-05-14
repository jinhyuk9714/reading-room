"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmPanelProps = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmPanel({
  title,
  description,
  confirmLabel,
  cancelLabel = "취소",
  pending = false,
  onCancel,
  children,
}: ConfirmPanelProps) {
  return (
    <div
      aria-modal="false"
      className="rounded-md border border-[var(--color-burgundy)]/30 bg-white p-3 shadow-sm"
      role="alertdialog"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-burgundy)]" />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
            {description}
          </p>
        </div>
      </div>
      {children}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          {cancelLabel}
        </Button>
        <Button disabled={pending} size="sm" type="submit" variant="danger">
          {pending ? "처리 중" : confirmLabel}
        </Button>
      </div>
    </div>
  );
}
