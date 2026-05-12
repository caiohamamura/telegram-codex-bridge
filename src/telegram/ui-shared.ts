import type { ReasoningEffort, SessionRow, UiLanguage } from "../types.js";
import { getTranslator } from "../i18n/index.js";

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatHtmlHeading(text: string): string {
  return `<b>${escapeHtml(text)}</b>`;
}

export function formatHtmlField(label: string, value: string): string {
  return `${formatHtmlHeading(label)} ${escapeHtml(value)}`;
}

export function chunkButtons<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function formatRelativeTime(isoTime: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  const diffMs = Math.max(0, Date.now() - Date.parse(isoTime));
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return LL.shared.justNow();
  }

  if (minutes < 60) {
    return `${minutes}${LL.shared.minutesAgo()}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}${LL.shared.hoursAgo()}`;
  }

  const days = Math.floor(hours / 24);
  return `${days}${LL.shared.daysAgo()}`;
}

export function formatReasoningEffortLabel(effort: ReasoningEffort, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  switch (effort) {
    case "none":
      return LL.shared.effortNone();
    case "minimal":
      return LL.shared.effortMinimal();
    case "low":
      return LL.shared.effortLow();
    case "medium":
      return LL.shared.effortMedium();
    case "high":
      return LL.shared.effortHigh();
    case "xhigh":
      return LL.shared.effortXhigh();
  }
}

export function formatSessionModelReasoningConfig(
  session: Pick<SessionRow, "selectedModel" | "selectedReasoningEffort">,
  language: UiLanguage = "zh"
): string {
  const LL = getTranslator(language);
  const modelLabel = session.selectedModel ?? LL.common.defaultModel();
  const effortLabel = session.selectedReasoningEffort ? formatReasoningEffortLabel(session.selectedReasoningEffort, language) : LL.common.default();
  return `${modelLabel} + ${effortLabel}`;
}
