import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAuthors(authors: string[] | null | undefined): string {
  if (!authors || authors.length === 0) {
    return "작가 미상";
  }
  return authors.join(", ");
}

export function formatDate(date: string | null | undefined): string {
  if (!date) {
    return "아직 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}
