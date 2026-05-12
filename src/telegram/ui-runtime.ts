import type {
  PendingInteractionState,
  RuntimeStatusField,
  UiLanguage
} from "../types.js";
import { BRIDGE_EXTENSION_RUNTIME_STATUS_FIELDS, CODEX_CLI_RUNTIME_STATUS_FIELDS } from "../types.js";
import type { ActivityStatus, CollabAgentStateSnapshot, InspectSnapshot } from "../activity/types.js";
import type {
  InteractionApprovalCardView,
  InteractionExpiredCardView,
  InteractionQuestionCardView,
  InteractionResolvedCardView
} from "../core/interaction-model/interaction.js";
import type {
  RuntimeCommandEntryView,
  RuntimeInspectControlsView,
  RuntimeInspectView,
  RuntimeHubSessionView,
  RuntimeHubTerminalSummaryView,
  RuntimeHubView,
  RollbackConfirmView,
  RollbackPickerView,
  RollbackTargetView,
  RuntimePreferencesView,
  RuntimeStatusCardView,
  RuntimeStatusControlsView
} from "../core/interaction-model/runtime.js";
import { truncateText } from "../util/text.js";
import { BLOCKED_PROGRESS_APPROVAL, BLOCKED_PROGRESS_USER_INPUT } from "../util/blocked-progress.js";
import type { TelegramInlineKeyboardButton, TelegramInlineKeyboardMarkup } from "./api.js";
import {
  encodeAgentCollapseCallback,
  encodeAgentExpandCallback,
  encodeCommandPanelOpenCallback,
  encodeHubSelectCallback,
  encodeInspectCollapseCallback,
  encodeInspectCloseCallback,
  encodeInspectExpandCallback,
  encodeInspectPageCallback,
  encodeInteractionAnswerCollapseCallback,
  encodeInteractionAnswerExpandCallback,
  encodeInteractionCancelCallback,
  encodeInteractionDecisionCallback,
  encodeInteractionQuestionCallback,
  encodeInteractionTextCallback,
  encodePlanCollapseCallback,
  encodePlanExpandCallback,
  encodeRollbackBackCallback,
  encodeRollbackCloseCallback,
  encodeRollbackConfirmCallback,
  encodeRollbackPageCallback,
  encodeRollbackPickCallback,
  encodeRuntimeCloseCallback,
  encodeRuntimePageCallback,
  encodeRuntimeResetCallback,
  encodeRuntimeSaveCallback,
  encodeRuntimeToggleCallback,
  encodeStatusInspectCallback,
  encodeStatusInterruptCallback
} from "./ui-callbacks.js";
import { renderInlineMarkdown } from "./ui-final-answer.js";
import {
  chunkButtons,
  escapeHtml,
  formatHtmlField,
  formatHtmlHeading,
  formatRelativeTime
} from "./ui-shared.js";
import { buildBridgeCommandActionRows } from "./ui-bridge-actions.js";
import { getTranslator } from "../i18n/index.js";

export type {
  InteractionApprovalCardView,
  InteractionExpiredCardView,
  InteractionQuestionCardView,
  InteractionResolvedCardView
} from "../core/interaction-model/interaction.js";
export type {
  RuntimeCommandEntryView,
  RuntimeInspectControlsView,
  RuntimeInspectView,
  RuntimeHubSessionView,
  RuntimeHubTerminalSummaryView,
  RuntimeHubView,
  RollbackConfirmView,
  RollbackPickerView,
  RollbackTargetView,
  RuntimePreferencesView,
  RuntimeStatusCardView,
  RuntimeStatusControlsView
} from "../core/interaction-model/runtime.js";

type InteractionApprovalCardRenderView = Omit<InteractionApprovalCardView, "kind">;
type InteractionQuestionCardRenderView = Omit<InteractionQuestionCardView, "kind">;
type InteractionResolvedCardRenderView = Omit<InteractionResolvedCardView, "kind">;
type InteractionExpiredCardRenderView = Omit<InteractionExpiredCardView, "kind">;

interface RuntimeCardContext {
  sessionName?: string | null;
  projectName?: string | null;
}

export interface RuntimeStatusFieldOptionView {
  field: RuntimeStatusField;
  label: string;
  selected: boolean;
}

const RUNTIME_FIELD_PAGE_SIZE = 4;
const ROLLBACK_TARGET_PAGE_SIZE = 6;
const HUB_SECTION_DIVIDER = "━━━━━━━━━━━━━━━━━━";
const INSPECT_PAGE_CHAR_LIMIT = 3200;

export function buildRuntimeStatusCard(options: RuntimeStatusCardView): string {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const progressTextLimit = options.progressTextLimit ?? 240;
  const expandedPlanEntryLimit = options.expandedPlanEntryLimit ?? 10;
  const expandedPlanEntryTextLimit = options.expandedPlanEntryTextLimit ?? 200;
  const expandedAgentLimit = options.expandedAgentLimit ?? 10;
  const expandedAgentProgressTextLimit = options.expandedAgentProgressTextLimit ?? 160;
  const lines: string[] = [formatHtmlHeading(LL.runtime.statusTitle())];
  pushHtmlRuntimeCardContext(lines, options, language);

  lines.push(formatRuntimeCardRow(LL.runtime.state(), options.state));

  for (const line of options.optionalFieldLines ?? []) {
    lines.push(formatRuntimeStatusOptionalField(line, language));
  }

  if (options.progressText) {
    const progressText = renderInlineMarkdown(truncateText(options.progressText, progressTextLimit));
    if (stripHtml(progressText).length > 72) {
      lines.push(formatHtmlHeading(LL.runtime.progress()));
      lines.push(progressText);
    } else {
      lines.push(formatRuntimeCardRow(LL.runtime.progress(), progressText, { valueIsHtml: true }));
    }
  }

  appendExpandedPlanSection(lines, {
    language,
    entries: options.planEntries,
    expanded: options.planExpanded,
    entryLimit: expandedPlanEntryLimit,
    entryTextLimit: expandedPlanEntryTextLimit
  });

  appendExpandedAgentSection(lines, {
    language,
    entries: options.agentEntries,
    expanded: options.agentsExpanded,
    entryLimit: expandedAgentLimit,
    entryProgressTextLimit: expandedAgentProgressTextLimit
  });

  if (options.includeFooter ?? true) {
    lines.push(buildRuntimeSurfaceFooter(language));
  }
  return lines.join("\n");
}

export function buildRuntimeStatusReplyMarkup(options: RuntimeStatusControlsView): TelegramInlineKeyboardMarkup | undefined {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];

  if (options.planEntries.length > 0) {
    rows.push([{
      text: options.planExpanded
        ? LL.runtime.hidePlan()
        : buildCollapsedPlanButtonLabel(options.planEntries, language),
      callback_data: options.planExpanded
        ? encodePlanCollapseCallback(options.sessionId)
        : encodePlanExpandCallback(options.sessionId)
    }]);
  }

  if (options.agentEntries.length > 0) {
    rows.push([{
      text: options.agentsExpanded
        ? LL.runtime.hideAgents()
        : buildCollapsedAgentButtonLabel(options.agentEntries, language),
      callback_data: options.agentsExpanded
        ? encodeAgentCollapseCallback(options.sessionId)
        : encodeAgentExpandCallback(options.sessionId)
    }]);
  }

  rows.push([
    {
      text: LL.runtime.inspect(),
      callback_data: encodeStatusInspectCallback(options.sessionId)
    },
    {
      text: LL.runtime.commands(),
      callback_data: encodeCommandPanelOpenCallback()
    },
    {
      text: LL.runtime.interrupt(),
      callback_data: encodeStatusInterruptCallback(options.sessionId)
    }
  ]);

  return {
    inline_keyboard: rows
  };
}

export function buildRuntimeHubMessage(options: RuntimeHubView): string {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const sessionProgressTextLimit = options.sessionProgressTextLimit ?? 120;
  const currentViewedSessionProgressTextLimit = options.currentViewedSessionProgressTextLimit ?? sessionProgressTextLimit;
  const otherSessionProgressTextLimit = options.otherSessionProgressTextLimit ?? sessionProgressTextLimit;
  const recentEndedSessionProgressTextLimit = options.recentEndedSessionProgressTextLimit ?? 0;
  const hubPlanEntryLimit = options.hubPlanEntryLimit ?? 6;
  const hubPlanEntryTextLimit = options.hubPlanEntryTextLimit ?? 120;
  const hubAgentEntryLimit = options.hubAgentEntryLimit ?? 4;
  const hubAgentProgressTextLimit = options.hubAgentProgressTextLimit ?? 100;
  const usesSlotSections = options.completed !== undefined
    || options.currentViewedSession !== undefined
    || options.otherSessions !== undefined
    || options.recentEndedSessions !== undefined;
  const lines: string[] = [buildRuntimeHubHeading(
    language === "en"
      ? `Hub: ${options.windowIndex + 1}/${Math.max(1, options.totalWindows)}${options.completed ? " · Completed" : ""}`
      : `目录：${options.windowIndex + 1}/${Math.max(1, options.totalWindows)}${options.completed ? " · 已完成" : ""}`
  )];

  if (usesSlotSections) {
    if (options.currentViewedSession) {
      pushRuntimeHubSectionHeading(lines, LL.runtime.currentViewedSession());
      pushRuntimeHubSession(lines, options.currentViewedSession, null, {
        language,
        progressTextLimit: currentViewedSessionProgressTextLimit,
        emphasizeMarkers: false,
        showMarkers: false
      });

      appendExpandedHubPlanSection(lines, {
        language,
        entries: options.planEntries,
        expanded: options.planExpanded,
        entryLimit: hubPlanEntryLimit,
        entryTextLimit: hubPlanEntryTextLimit
      });

      appendExpandedHubAgentSection(lines, {
        language,
        entries: options.agentEntries,
        expanded: options.agentsExpanded,
        entryLimit: hubAgentEntryLimit,
        entryProgressTextLimit: hubAgentProgressTextLimit
      });
    }

    if ((options.otherSessions?.length ?? 0) > 0) {
      pushRuntimeHubSectionHeading(lines, LL.runtime.otherRunningSessions());
      for (const session of options.otherSessions ?? []) {
        pushRuntimeHubSession(lines, session, null, {
          language,
          progressTextLimit: otherSessionProgressTextLimit,
          emphasizeMarkers: false,
          showMarkers: false
        });
      }
    }

    if ((options.recentEndedSessions?.length ?? 0) > 0) {
      pushRuntimeHubSectionHeading(lines, LL.runtime.recentEndedSessions());
      for (const session of options.recentEndedSessions ?? []) {
        pushRuntimeHubSession(lines, session, null, {
          language,
          progressTextLimit: recentEndedSessionProgressTextLimit,
          emphasizeMarkers: false,
          showMarkers: false
        });
      }
    }

    if (options.reminderText) {
      lines.push("", escapeHtml(options.reminderText));
    }
    lines.push("", buildRuntimeHubFooter(language));
    return lines.join("\n");
  }

  const sessionCollectionKind = options.sessionCollectionKind ?? "running";
  const genericSessionLayout = options.genericSessionLayout ?? "detailed";
  const sessions = options.sessions ?? [];
  const focusedSession = sessions.find((session) => session.isFocused) ?? sessions[0] ?? null;
  const allOtherSessions = sessions.filter((session) => session.sessionId !== focusedSession?.sessionId);
  const genericVisibleSessionLimit = options.genericVisibleSessionLimit && options.genericVisibleSessionLimit > 0
    ? options.genericVisibleSessionLimit
    : null;
  const visibleOtherSessionLimit = genericVisibleSessionLimit === null
    ? allOtherSessions.length
    : Math.max(0, genericVisibleSessionLimit - (focusedSession ? 1 : 0));
  const otherSessions = allOtherSessions.slice(0, visibleOtherSessionLimit);
  const hiddenOtherSessionCount = allOtherSessions.length - otherSessions.length;
  const activeInputSession = options.activeInputSession
    && !sessions.some((session) => session.sessionId === options.activeInputSession?.sessionId)
    ? options.activeInputSession
    : null;

  lines[0] = buildRuntimeHubHeading(
    language === "en"
      ? `Hub: ${options.windowIndex + 1}/${Math.max(1, options.totalWindows)} · ${(options.totalSessions ?? sessions.length)} session${(options.totalSessions ?? sessions.length) === 1 ? "" : "s"}`
      : `目录：${options.windowIndex + 1}/${Math.max(1, options.totalWindows)} · ${options.totalSessions ?? sessions.length} 个会话`
  );

  if (activeInputSession) {
    pushRuntimeHubSectionHeading(lines, LL.runtime.currentInputSession());
    if (genericSessionLayout === "compact") {
      pushCompactRuntimeHubSession(lines, activeInputSession, null, {
        language,
        showMarkers: true
      });
    } else {
      pushRuntimeHubSession(lines, activeInputSession, null, {
        language,
        progressTextLimit: sessionProgressTextLimit,
        emphasizeMarkers: true,
        showMarkers: true
      });
    }
  }

  if (focusedSession) {
    pushRuntimeHubSectionHeading(lines,
      sessionCollectionKind === "running"
        ? LL.runtime.focusedRunningSession()
        : LL.runtime.focusedSession()
    );
    if (genericSessionLayout === "compact") {
      pushCompactRuntimeHubSession(lines, focusedSession, 1, {
        language,
        showMarkers: true
      });
    } else {
      pushRuntimeHubSession(lines, focusedSession, 1, {
        language,
        progressTextLimit: sessionProgressTextLimit,
        emphasizeMarkers: true,
        showMarkers: true
      });
    }

    appendExpandedHubPlanSection(lines, {
      language,
      entries: options.planEntries,
      expanded: options.planExpanded,
      entryLimit: hubPlanEntryLimit,
      entryTextLimit: hubPlanEntryTextLimit
    });

    appendExpandedHubAgentSection(lines, {
      language,
      entries: options.agentEntries,
      expanded: options.agentsExpanded,
      entryLimit: hubAgentEntryLimit,
      entryProgressTextLimit: hubAgentProgressTextLimit
    });
  }

  if (otherSessions.length > 0 || hiddenOtherSessionCount > 0) {
    pushRuntimeHubSectionHeading(lines,
      sessionCollectionKind === "running"
        ? LL.runtime.otherRunningSessions()
        : LL.runtime.otherSessions()
    );
    for (const [index, session] of otherSessions.entries()) {
      if (genericSessionLayout === "compact") {
        pushCompactRuntimeHubSession(lines, session, index + (focusedSession ? 2 : 1), {
          language,
          showMarkers: true
        });
      } else {
        pushRuntimeHubSession(lines, session, index + 2, {
          language,
          progressTextLimit: sessionProgressTextLimit,
          emphasizeMarkers: false,
          showMarkers: true
        });
      }
    }

    if (hiddenOtherSessionCount > 0) {
      lines.push(LL.runtime.moreSessionsPrefix() + hiddenOtherSessionCount + LL.runtime.moreSessionsSuffix());
    }
  }

  if (options.isMainHub && (options.terminalSummaries?.length ?? 0) > 0) {
    pushRuntimeHubSectionHeading(lines, LL.runtime.recentTerminalSessions());

    for (const [index, summary] of (options.terminalSummaries ?? []).entries()) {
      pushRuntimeHubTerminalSummary(lines, summary, index + 1, language);
    }
  }

  if (options.reminderText) {
    lines.push("", escapeHtml(options.reminderText));
  }
  lines.push("", buildRuntimeHubFooter(language));
  return lines.join("\n");
}

function buildRuntimeHubHeading(summary: string): string {
  return `🎯 <b>Active Hub</b> [${escapeHtml(summary)}]`;
}

function pushRuntimeHubSectionHeading(lines: string[], label: string): void {
  lines.push("", `<b>[${escapeHtml(label)}]</b>`);
}

function appendExpandedPlanSection(
  lines: string[],
  options: {
    language: UiLanguage;
    entries: string[] | undefined;
    expanded: boolean | undefined;
    entryLimit: number;
    entryTextLimit: number;
  }
): void {
  if (!options.expanded || !options.entries || options.entries.length === 0) {
    return;
  }

  const LL = getTranslator(options.language);

  lines.push("", `<b>${LL.runtime.planLabel()}</b>`);

  for (const [index, entry] of options.entries.slice(0, options.entryLimit).entries()) {
    lines.push(`${index + 1}. ${renderInlineMarkdown(truncateText(entry, options.entryTextLimit))}`);
  }

  if (options.entries.length > options.entryLimit) {
    lines.push(LL.runtime.moreStepsPrefix() + (options.entries.length - options.entryLimit) + LL.runtime.moreStepsSuffix());
  }
}

function appendExpandedAgentSection(
  lines: string[],
  options: {
    language: UiLanguage;
    entries: CollabAgentStateSnapshot[] | undefined;
    expanded: boolean | undefined;
    entryLimit: number;
    entryProgressTextLimit: number;
  }
): void {
  if (!options.expanded || !options.entries || options.entries.length === 0) {
    return;
  }

  const LL = getTranslator(options.language);

  lines.push("", `<b>${LL.runtime.agentsLabel()}</b>`);

  for (const [index, entry] of options.entries.slice(0, options.entryLimit).entries()) {
    lines.push(renderAgentRuntimeLine(entry, index + 1, options.entryProgressTextLimit));
  }

  if (options.entries.length > options.entryLimit) {
    lines.push(LL.runtime.moreAgentsPrefix() + (options.entries.length - options.entryLimit) + LL.runtime.moreAgentsSuffix());
  }
}

function appendExpandedHubPlanSection(
  lines: string[],
  options: {
    language: UiLanguage;
    entries: string[] | undefined;
    expanded: boolean | undefined;
    entryLimit: number;
    entryTextLimit: number;
  }
): void {
  if (!options.expanded || !options.entries || options.entries.length === 0) {
    return;
  }

  const LL = getTranslator(options.language);

  pushRuntimeHubSectionHeading(lines, LL.runtime.planDetails());

  for (const [index, entry] of options.entries.slice(0, options.entryLimit).entries()) {
    lines.push(renderHubPlanEntryLine(entry, index + 1, options.language, options.entryTextLimit));
  }

  if (options.entries.length > options.entryLimit) {
    lines.push(LL.runtime.morePlanItemsPrefix() + (options.entries.length - options.entryLimit) + LL.runtime.morePlanItemsSuffix());
  }
}

function appendExpandedHubAgentSection(
  lines: string[],
  options: {
    language: UiLanguage;
    entries: CollabAgentStateSnapshot[] | undefined;
    expanded: boolean | undefined;
    entryLimit: number;
    entryProgressTextLimit: number;
  }
): void {
  if (!options.expanded || !options.entries || options.entries.length === 0) {
    return;
  }

  const LL = getTranslator(options.language);

  pushRuntimeHubSectionHeading(lines, LL.runtime.collabAgents());

  for (const entry of options.entries.slice(0, options.entryLimit)) {
    lines.push(renderHubAgentDetailLine(entry, options.language, options.entryProgressTextLimit));
  }

  if (options.entries.length > options.entryLimit) {
    lines.push(LL.runtime.moreAgentsPrefix() + (options.entries.length - options.entryLimit) + LL.runtime.moreAgentsSuffix());
  }
}

function pushRuntimeHubSession(
  lines: string[],
  session: RuntimeHubSessionView,
  index: number | null,
  options: {
    language: UiLanguage;
    progressTextLimit: number;
    emphasizeMarkers: boolean;
    showMarkers: boolean;
  }
): void {
  const LL = getTranslator(options.language);
  const markerValues: string[] = [];
  if (options.showMarkers) {
    if (session.isFocused) markerValues.push(String(LL.runtime.viewing()));
    if (session.isActiveInputTarget) markerValues.push(String(LL.runtime.currentInput()));
  }
  const markerText = !options.emphasizeMarkers && markerValues.length > 0
    ? ` · ${markerValues.map((marker) => escapeHtml(marker)).join(" · ")}`
    : "";
  const displayIndex = session.slot ?? index;
  const statePrefix = String(LL.runtime.state());
  const folderLine = buildRuntimeHubFolderLine(session.sessionName, session.projectName);

  lines.push(HUB_SECTION_DIVIDER);
  lines.push(`${buildRuntimeHubStateBadge(session.state)} <b>${buildRuntimeHubSessionLabel(session.sessionName, displayIndex)}</b>`);

  if (folderLine) {
    lines.push(folderLine);
  }

  lines.push(`<i>(${statePrefix}: ${escapeHtml(session.state)}${markerText})</i>`);

  if (options.emphasizeMarkers && markerValues.length > 0) {
    lines.push(`<i>(${markerValues.map((marker) => escapeHtml(marker)).join(" · ")})</i>`);
  }

  if (session.progressText && options.progressTextLimit > 0) {
    lines.push("<b>[Runtime Preview]</b>");
    lines.push(`<blockquote expandable>${renderInlineMarkdown(truncateText(session.progressText, options.progressTextLimit))}</blockquote>`);
  }
}

function pushCompactRuntimeHubSession(
  lines: string[],
  session: RuntimeHubSessionView,
  index: number | null,
  options: {
    language: UiLanguage;
    showMarkers: boolean;
  }
): void {
  const LL = getTranslator(options.language);
  const markerValues: string[] = [];
  if (options.showMarkers) {
    if (session.isFocused) markerValues.push(String(LL.runtime.viewing()));
    if (session.isActiveInputTarget) markerValues.push(String(LL.runtime.currentInput()));
  }
  const displayIndex = session.slot ?? index;
  const metaParts: string[] = [];
  const folderMeta = buildRuntimeHubFolderMeta(session.sessionName, session.projectName);

  if (folderMeta) {
    metaParts.push(folderMeta);
  }
  metaParts.push(`${String(LL.runtime.state())}: ${escapeHtml(session.state)}`);
  for (const marker of markerValues) {
    metaParts.push(escapeHtml(marker));
  }

  lines.push(HUB_SECTION_DIVIDER);
  lines.push(`${buildRuntimeHubStateBadge(session.state)} <b>${buildRuntimeHubSessionLabel(session.sessionName, displayIndex)}</b>`);
  lines.push(`<i>(${metaParts.join(" · ")})</i>`);
}

function buildRuntimeSurfaceFooter(language: UiLanguage): string {
  const LL = getTranslator(language);
  return LL.runtime.surfaceFooter();
}

function buildRuntimeHubFooter(_language: UiLanguage): string {
  return "💡 <i>/status | /inspect | /interrupt</i>";
}

function buildRuntimeHubSessionLabel(sessionName: string, displayIndex: number | null | undefined): string {
  const escapedSessionName = escapeHtml(sessionName);
  return displayIndex === null || displayIndex === undefined
    ? `SESSION: ${escapedSessionName}`
    : `SESSION #${displayIndex}: ${escapedSessionName}`;
}

function buildRuntimeHubFolderMeta(sessionName: string, projectName?: string | null): string | null {
  const trimmedProjectName = projectName?.trim();
  if (!trimmedProjectName || trimmedProjectName === sessionName.trim()) {
    return null;
  }
  return `Folder: ${escapeHtml(trimmedProjectName)}`;
}

function buildRuntimeHubFolderLine(sessionName: string, projectName?: string | null): string | null {
  const folderMeta = buildRuntimeHubFolderMeta(sessionName, projectName);
  return folderMeta ? `<i>(${folderMeta})</i>` : null;
}

function buildRuntimeHubStateBadge(state: string): string {
  const normalized = state.trim().toLowerCase();

  if (/(completed|已完成|archived|归档)/u.test(normalized)) {
    return "🏁";
  }
  if (/(failed|失败|interrupted|已中断)/u.test(normalized)) {
    return "⛔";
  }
  if (/(running|执行中|starting|准备中|reconnecting)/u.test(normalized)) {
    return "🟢";
  }
  return "🟡";
}

function pushRuntimeHubTerminalSummary(
  lines: string[],
  summary: RuntimeHubTerminalSummaryView,
  index: number,
  language: UiLanguage
): void {
  const LL = getTranslator(language);
  const folderLine = buildRuntimeHubFolderLine(summary.sessionName, summary.projectName);

  lines.push(HUB_SECTION_DIVIDER);
  lines.push(`${buildRuntimeHubStateBadge(summary.state)} <b>${index}. ${escapeHtml(summary.sessionName)}</b>`);
  if (folderLine) {
    lines.push(folderLine);
  }
  lines.push(`<i>(${LL.runtime.state()}: ${escapeHtml(summary.state)})</i>`);
}

export function buildRuntimeHubReplyMarkup(options: {
  token: string;
  callbackVersion: number;
  language?: UiLanguage;
  sessions?: RuntimeHubSessionView[];
  slotSessionIds?: Array<string | null>;
  focusedSessionId: string | null;
  planEntries?: string[];
  planExpanded?: boolean;
  agentEntries?: CollabAgentStateSnapshot[];
  agentsExpanded?: boolean;
  bridgeActions?: Array<{ command: "cancel" | "hub" | "status" | "inspect" | "interrupt" | "commands"; style?: "default" | "primary" }>;
}): TelegramInlineKeyboardMarkup {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];

  if (options.slotSessionIds) {
    const slotSessionIds = options.slotSessionIds.slice(0, 5);
    while (slotSessionIds.length < 5) {
      slotSessionIds.push(null);
    }

    rows.push(slotSessionIds.map((sessionId, index) => {
      const style: TelegramInlineKeyboardButton["style"] = sessionId && sessionId === options.focusedSessionId
        ? "primary"
        : "default";
      return {
        text: sessionId ? String(index + 1) : "·",
        callback_data: encodeHubSelectCallback(options.token, options.callbackVersion, index + 1),
        style
      };
    }));
  } else {
    const sessions = options.sessions ?? [];
    if (sessions.length > 1) {
      const sessionButtons = sessions.map((session, index) => {
        const style: TelegramInlineKeyboardButton["style"] = session.sessionId === options.focusedSessionId
          ? "primary"
          : "default";
        return {
          text: session.isFocused
            ? `${LL.runtime.viewing()} · ${truncateText(session.sessionName, 18)}`
            : session.isActiveInputTarget
              ? `${LL.runtime.current()} · ${truncateText(session.sessionName, 18)}`
              : truncateText(session.sessionName, 18),
          callback_data: encodeHubSelectCallback(options.token, options.callbackVersion, index),
          style
        };
      });
      rows.push(...chunkButtons(sessionButtons, 2));
    }
  }

  appendHubSecondaryButtons(
    rows,
    options.focusedSessionId,
    options.planEntries,
    options.planExpanded,
    options.agentEntries,
    options.agentsExpanded,
    language,
    options.bridgeActions
  );

  return { inline_keyboard: rows };
}

function appendHubSecondaryButtons(
  rows: TelegramInlineKeyboardMarkup["inline_keyboard"],
  focusedSessionId: string | null | undefined,
  planEntries: string[] | undefined,
  planExpanded: boolean | undefined,
  agentEntries: CollabAgentStateSnapshot[] | undefined,
  agentsExpanded: boolean | undefined,
  language: UiLanguage,
  bridgeActions?: Array<{ command: "cancel" | "hub" | "status" | "inspect" | "interrupt" | "commands"; style?: "default" | "primary" }>
): void {
  const LL = getTranslator(language);
  const buttons: TelegramInlineKeyboardMarkup["inline_keyboard"][number] = [];

  if (focusedSessionId && (planEntries?.length ?? 0) > 0) {
    buttons.push({
      text: planExpanded
        ? LL.runtime.hidePlan()
        : buildCollapsedPlanButtonLabel(planEntries ?? [], language),
      callback_data: planExpanded
        ? encodePlanCollapseCallback(focusedSessionId)
        : encodePlanExpandCallback(focusedSessionId)
    });
  }

  if (focusedSessionId && (agentEntries?.length ?? 0) > 0) {
    buttons.push({
      text: agentsExpanded
        ? LL.runtime.hideAgents()
        : buildCollapsedAgentButtonLabel(agentEntries ?? [], language),
      callback_data: agentsExpanded
        ? encodeAgentCollapseCallback(focusedSessionId)
        : encodeAgentExpandCallback(focusedSessionId)
    });
  }

  if (buttons.length > 0) {
    rows.push(buttons);
  }

  if (bridgeActions && bridgeActions.length > 0) {
    rows.push(...buildBridgeCommandActionRows(bridgeActions, language, { chunkSize: 2 }));
    return;
  }

  rows.push([{
    text: LL.runtime.commands(),
    callback_data: encodeCommandPanelOpenCallback()
  }]);
}

export function buildRuntimeStatusFieldLabel(field: RuntimeStatusField, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  switch (field) {
    case "model-name":
      return LL.runtime.fields.modelName();
    case "model-with-reasoning":
      return LL.runtime.fields.modelWithReasoning();
    case "current-dir":
      return LL.runtime.fields.currentDir();
    case "project-root":
      return LL.runtime.fields.projectRoot();
    case "git-branch":
      return LL.runtime.fields.gitBranch();
    case "context-remaining":
      return LL.runtime.fields.contextRemaining();
    case "context-used":
      return LL.runtime.fields.contextUsed();
    case "five-hour-limit":
      return LL.runtime.fields.fiveHourLimit();
    case "weekly-limit":
      return LL.runtime.fields.weeklyLimit();
    case "codex-version":
      return LL.runtime.fields.codexVersion();
    case "context-window-size":
      return LL.runtime.fields.contextWindowSize();
    case "used-tokens":
      return LL.runtime.fields.usedTokens();
    case "total-input-tokens":
      return LL.runtime.fields.totalInputTokens();
    case "total-output-tokens":
      return LL.runtime.fields.totalOutputTokens();
    case "session-id":
      return LL.runtime.fields.sessionId();
    case "session_name":
      return LL.runtime.fields.sessionName();
    case "project_name":
      return LL.runtime.fields.projectName();
    case "project_path":
      return LL.runtime.fields.projectPath();
    case "plan_mode":
      return LL.runtime.fields.planMode();
    case "model_reasoning":
      return LL.runtime.fields.modelReasoning();
    case "thread_id":
      return LL.runtime.fields.threadId();
    case "turn_id":
      return LL.runtime.fields.turnId();
    case "blocked_reason":
      return LL.runtime.fields.blockedReason();
    case "current_step":
      return LL.runtime.fields.currentStep();
    case "last_token_usage":
      return LL.runtime.fields.lastTokenUsage();
    case "total_token_usage":
      return LL.runtime.fields.totalTokenUsage();
    case "context_window":
      return LL.runtime.fields.contextWindow();
    case "final_answer_ready":
      return LL.runtime.fields.finalAnswerReady();
  }
}

export function buildRuntimePreferencesAppliedMessage(fields: RuntimeStatusField[], language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  const summary = fields.length > 0
    ? fields.map((field) => buildRuntimeStatusFieldLabel(field, language)).join(language === "en" ? ", " : "、")
    : LL.common.none();

  return [
    formatHtmlHeading(LL.runtime.preferences.appliedTitle()),
    formatHtmlField(LL.runtime.preferences.currentFields(), summary)
  ].join("\n");
}

export function buildRuntimePreferencesClosedMessage(fields: RuntimeStatusField[], language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  const summary = fields.length > 0
    ? fields.map((field) => buildRuntimeStatusFieldLabel(field, language)).join(language === "en" ? ", " : "、")
    : LL.common.none();

  return [
    formatHtmlHeading(LL.runtime.preferences.closedTitle()),
    formatHtmlField(LL.runtime.preferences.currentFields(), summary)
  ].join("\n");
}

export function buildRuntimePreferencesMessage(options: RuntimePreferencesView, language: UiLanguage = "zh"): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const LL = getTranslator(language);
  const pages = buildRuntimePreferencePages(language);
  const totalPages = Math.max(1, pages.length);
  const safePage = Math.min(Math.max(options.page, 0), totalPages - 1);
  const currentPage = pages[safePage] ?? {
    groupLabel: "Codex CLI",
    groupPage: 0,
    groupPageCount: 1,
    fields: [...CODEX_CLI_RUNTIME_STATUS_FIELDS].slice(0, RUNTIME_FIELD_PAGE_SIZE)
  };
  const pageFields = currentPage.fields;
  const selectedSet = new Set(options.fields);

  const selectedSummary = options.fields.length > 0
    ? options.fields.map((field, index) => `${index + 1}. ${buildRuntimeStatusFieldLabel(field, language)}`).join("\n")
    : LL.runtime.preferences.noSelectedFields();

  const rows = pageFields.map((field) => [{
    text: `${selectedSet.has(field) ? "✓" : "＋"} ${buildRuntimeStatusFieldLabel(field, language)}`,
    callback_data: encodeRuntimeToggleCallback(options.token, field)
  }]);

  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (safePage > 0) {
    navigation.push({ text: LL.common.previousPage(), callback_data: encodeRuntimePageCallback(options.token, safePage - 1) });
  }
  if (safePage + 1 < totalPages) {
    navigation.push({ text: LL.common.nextPage(), callback_data: encodeRuntimePageCallback(options.token, safePage + 1) });
  }
  if (navigation.length > 0) {
    rows.push(navigation);
  }

  rows.push([{ text: LL.runtime.preferences.save(), callback_data: encodeRuntimeSaveCallback(options.token) }]);
  rows.push([{ text: LL.runtime.preferences.reset(), callback_data: encodeRuntimeResetCallback(options.token) }]);
  rows.push([{ text: LL.common.close(), callback_data: encodeRuntimeCloseCallback(options.token) }]);

  return {
    text: [
      formatHtmlHeading(LL.runtime.preferences.title()),
      LL.runtime.preferences.hint(),
      LL.runtime.preferences.orderHint(),
      formatHtmlField("Codex CLI：", buildRuntimeStatusFieldGroupSummary(SELECTABLE_CODEX_CLI_RUNTIME_STATUS_FIELDS, language)),
      formatHtmlField("Bridge Extensions：", buildRuntimeStatusFieldGroupSummary(BRIDGE_EXTENSION_RUNTIME_STATUS_FIELDS, language)),
      formatHtmlField(LL.runtime.preferences.currentGroup(), currentPage.groupLabel),
      formatHtmlField(LL.runtime.preferences.selectedFields(), `${options.fields.length}${LL.runtime.selectedFieldCountSuffix()}`),
      selectedSummary,
      formatHtmlField(LL.runtime.preferences.groupPage(), `${currentPage.groupPage + 1}/${currentPage.groupPageCount}`),
      formatHtmlField(LL.runtime.preferences.totalPage(), `${safePage + 1}/${totalPages}`)
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: rows
    }
  };
}

export function buildInspectViewMessage(options: RuntimeInspectView & RuntimeInspectControlsView, language: UiLanguage = "zh"): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
  totalPages: number;
} {
  const LL = getTranslator(language);
  const pages = paginateInspectHtml(options.html);
  const safePage = Math.min(Math.max(options.page, 0), pages.length - 1);

  if (options.collapsed) {
    return {
      text: buildCollapsedInspectText(options.html, language),
      replyMarkup: {
        inline_keyboard: [[
          {
            text: LL.runtime.inspectSection.expandDetails(),
            callback_data: encodeInspectExpandCallback(options.sessionId, safePage)
          },
          {
            text: LL.runtime.commands(),
            callback_data: encodeCommandPanelOpenCallback()
          },
          {
            text: LL.common.close(),
            callback_data: encodeInspectCloseCallback(options.sessionId)
          }
        ]]
      },
      totalPages: pages.length
    };
  }

  const buttons: Array<{ text: string; callback_data: string }> = [];
  if (safePage > 0) {
    buttons.push({ text: LL.common.previousPage(), callback_data: encodeInspectPageCallback(options.sessionId, safePage - 1) });
  }
  if (safePage + 1 < pages.length) {
    buttons.push({ text: LL.common.nextPage(), callback_data: encodeInspectPageCallback(options.sessionId, safePage + 1) });
  }

  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  if (buttons.length > 0) {
    rows.push(buttons);
  }
  rows.push([
    { text: LL.runtime.inspectSection.collapseDetails(), callback_data: encodeInspectCollapseCallback(options.sessionId) },
    { text: LL.runtime.commands(), callback_data: encodeCommandPanelOpenCallback() },
    { text: LL.common.close(), callback_data: encodeInspectCloseCallback(options.sessionId) }
  ]);

  return {
    text: `${pages[safePage]}\n\n${formatHtmlField(LL.runtime.inspectSection.detailPage(), `${safePage + 1}/${pages.length}`)}`,
    replyMarkup: {
      inline_keyboard: rows
    },
    totalPages: pages.length
  };
}

export function buildRollbackPickerMessage(options: RollbackPickerView, language: UiLanguage = "zh"): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
  totalPages: number;
} {
  const LL = getTranslator(language);
  const totalPages = Math.max(1, Math.ceil(options.targets.length / ROLLBACK_TARGET_PAGE_SIZE));
  const safePage = Math.min(Math.max(options.page, 0), totalPages - 1);
  const pageTargets = options.targets.slice(safePage * ROLLBACK_TARGET_PAGE_SIZE, (safePage + 1) * ROLLBACK_TARGET_PAGE_SIZE);
  const rows = pageTargets.map((target) => [{
    text: `${target.sequenceNumber}. ${truncateText(target.label, 24)}`,
    callback_data: encodeRollbackPickCallback(options.sessionId, safePage, target.index)
  }]);

  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (safePage > 0) {
    navigation.push({ text: LL.common.previousPage(), callback_data: encodeRollbackPageCallback(options.sessionId, safePage - 1) });
  }
  if (safePage + 1 < totalPages) {
    navigation.push({ text: LL.common.nextPage(), callback_data: encodeRollbackPageCallback(options.sessionId, safePage + 1) });
  }
  if (navigation.length > 0) {
    rows.push(navigation);
  }
  rows.push([{ text: LL.common.close(), callback_data: encodeRollbackCloseCallback(options.sessionId) }]);

  const lines = [
    formatHtmlHeading(LL.runtime.rollback.selectTarget()),
    LL.runtime.rollback.onlyUserInput(),
    formatHtmlField(LL.runtime.rollback.pageLabel(), `${safePage + 1}/${totalPages}`)
  ];

  pageTargets.forEach((target) => {
    lines.push(`${target.sequenceNumber}. ${escapeHtml(target.label)}`);
  });

  return {
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: rows
    },
    totalPages
  };
}

export function buildRollbackConfirmMessage(options: RollbackConfirmView, language: UiLanguage = "zh"): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const LL = getTranslator(language);
  return {
    text: [
      formatHtmlHeading(LL.runtime.rollback.confirmRollback()),
      formatHtmlField(LL.runtime.rollback.targetLabel(), `${options.target.sequenceNumber}. ${options.target.label}`),
      formatHtmlField(LL.runtime.rollback.turnCountToDelete(), `${options.target.rollbackCount}`),
      LL.runtime.rollback.localChangesWarning()
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{ text: LL.runtime.rollback.confirmButton(), callback_data: encodeRollbackConfirmCallback(options.sessionId, options.target.index) }],
        [{ text: LL.runtime.rollback.backToList(), callback_data: encodeRollbackBackCallback(options.sessionId, options.page) }],
        [{ text: LL.common.close(), callback_data: encodeRollbackCloseCallback(options.sessionId) }]
      ]
    }
  };
}

export function buildRollbackClosedMessage(language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return [
    formatHtmlHeading(LL.runtime.rollback.closedTitle()),
    LL.runtime.rollback.notRolledBack()
  ].join("\n");
}

export function buildInspectClosedMessage(language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return [
    formatHtmlHeading(LL.runtime.rollback.closedInspectTitle()),
    LL.runtime.rollback.reopenHint()
  ].join("\n");
}

export function buildRuntimeErrorCard(
  options: RuntimeCardContext & {
    title: string;
    detail?: string | null;
  }
): string {
  const lines: string[] = [formatHtmlHeading("Error")];
  pushHtmlRuntimeCardContext(lines, options);
  if (options.projectName && options.projectName !== options.sessionName) {
    lines.push(formatHtmlField("Project:", options.projectName));
  }
  lines.push(formatHtmlField("Title:", truncateText(options.title, 200)));

  if (options.detail) {
    lines.push(formatHtmlField("Detail:", truncateText(options.detail, 240)));
  }

  return lines.join("\n");
}

function appendInteractionHubHint(lines: string[], hubHint?: string | null): void {
  if (!hubHint) {
    return;
  }

  lines.push("", escapeHtml(hubHint));
}

function appendBridgeActionRows(
  rows: TelegramInlineKeyboardMarkup["inline_keyboard"],
  actions: readonly { command: "cancel" | "hub" | "status" | "inspect" | "interrupt" | "commands"; style?: "default" | "primary" }[] | undefined,
  language: UiLanguage,
  options?: {
    chunkSize?: number;
  }
): void {
  if (!actions || actions.length === 0) {
    return;
  }

  rows.push(...buildBridgeCommandActionRows(actions, language, options));
}

export function buildInteractionApprovalCard(options: InteractionApprovalCardRenderView): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const language: UiLanguage = "zh";
  const LL = getTranslator(language);
  const lines = [formatHtmlHeading(options.title), formatHtmlField(LL.runtime.interaction.type(), options.subtitle)];
  if (options.body) {
    lines.push(formatHtmlField(LL.runtime.interaction.body(), options.body));
  }
  if (options.detail) {
    lines.push(formatHtmlField(LL.runtime.interaction.detail(), options.detail));
  }
  appendInteractionHubHint(lines, options.hubHint);

  const actionRow = options.actions.map((action, index) => ({
    text: action.text,
    callback_data: encodeInteractionDecisionCallback(options.interactionId, index)
  }));

  return {
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: (() => {
        const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
        actionRow,
        [{ text: LL.runtime.interaction.cancelInteraction(), callback_data: encodeInteractionCancelCallback(options.interactionId) }]
        ];
        appendBridgeActionRows(rows, options.bridgeActions, language, { chunkSize: 2 });
        return rows;
      })()
    }
  };
}

export function buildInteractionQuestionCard(options: InteractionQuestionCardRenderView): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const language: UiLanguage = "zh";
  const LL = getTranslator(language);
  const lines = [
    formatHtmlHeading(options.title),
    formatHtmlField(LL.runtime.interaction.questionLabel(), `${options.questionIndex}/${options.totalQuestions}`),
    formatHtmlField(LL.runtime.interaction.headerLabel(), options.header),
    escapeHtml(options.question)
  ];

  if (options.isSecret) {
    lines.push(`<i>${LL.runtime.interaction.secretNotice()}</i>`);
  }

  if (options.awaitingText) {
    lines.push(`<i>${LL.runtime.interaction.awaitingTextNotice()}</i>`);
    appendInteractionHubHint(lines, options.hubHint);
    return {
      text: lines.join("\n"),
      replyMarkup: {
        inline_keyboard: (() => {
          const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
            [{ text: LL.runtime.interaction.cancelInteraction(), callback_data: encodeInteractionCancelCallback(options.interactionId) }]
          ];
          appendBridgeActionRows(rows, options.bridgeActions, language, { chunkSize: 2 });
          return rows;
        })()
      }
    };
  }

  if (!options.options || options.options.length === 0) {
    lines.push(`<i>${LL.runtime.interaction.sendTextPrompt()}</i>`);
    appendInteractionHubHint(lines, options.hubHint);
    return {
      text: lines.join("\n"),
      replyMarkup: {
        inline_keyboard: (() => {
          const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
          [{ text: LL.runtime.interaction.sendTextAnswer(), callback_data: encodeInteractionTextCallback(options.interactionId, options.questionIndex - 1) }],
          [{ text: LL.runtime.interaction.cancelInteraction(), callback_data: encodeInteractionCancelCallback(options.interactionId) }]
          ];
          appendBridgeActionRows(rows, options.bridgeActions, language, { chunkSize: 2 });
          return rows;
        })()
      }
    };
  }

  for (const [index, option] of options.options.entries()) {
    lines.push(`${index + 1}. ${escapeHtml(option.label)}: ${escapeHtml(option.description)}`);
  }

  const optionButtons = options.options.map((option, index) => ({
    text: option.label,
    callback_data: encodeInteractionQuestionCallback(options.interactionId, options.questionIndex - 1, index)
  }));
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = chunkButtons(optionButtons, 2);

  if (options.isOther) {
    rows.push([
      {
        text: LL.common.other(),
        callback_data: encodeInteractionTextCallback(options.interactionId, options.questionIndex - 1)
      }
    ]);
  }

  rows.push([{ text: LL.runtime.interaction.cancelInteraction(), callback_data: encodeInteractionCancelCallback(options.interactionId) }]);
  appendBridgeActionRows(rows, options.bridgeActions, language, { chunkSize: 2 });
  appendInteractionHubHint(lines, options.hubHint);

  return {
    text: lines.join("\n"),
    replyMarkup: { inline_keyboard: rows }
  };
}

export function buildInteractionResolvedCard(options: InteractionResolvedCardRenderView): {
  text: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
} {
  const language: UiLanguage = "zh";
  const LL = getTranslator(language);
  const stateText = options.state === "answered"
    ? LL.runtime.interactionState.answered()
    : options.state === "canceled"
      ? LL.runtime.interactionState.canceled()
      : LL.runtime.interactionState.failed();
  const lines = [
    formatHtmlHeading(options.title),
    formatHtmlField(LL.runtime.interaction.stateLabel(), stateText)
  ];
  if (options.summary) {
    lines.push(formatHtmlField(LL.runtime.interaction.resultLabel(), options.summary));
  }
  if (options.expanded && options.details && options.details.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.interaction.submittedAnswers()));
    for (const detail of options.details) {
      lines.push(escapeHtml(detail));
    }
  }
  appendInteractionHubHint(lines, options.hubHint);

  if (!options.expandable || !options.interactionId) {
    const rows = buildBridgeCommandActionRows(options.bridgeActions ?? [], language, { chunkSize: 2 });
    return rows.length > 0
      ? {
          text: lines.join("\n"),
          replyMarkup: { inline_keyboard: rows }
        }
      : { text: lines.join("\n") };
  }

  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [[{
    text: options.expanded ? LL.runtime.interaction.collapseAnswers() : LL.runtime.interaction.expandAnswers(),
    callback_data: options.expanded
      ? encodeInteractionAnswerCollapseCallback(options.interactionId)
      : encodeInteractionAnswerExpandCallback(options.interactionId)
  }]];
  appendBridgeActionRows(rows, options.bridgeActions, language, { chunkSize: 2 });
  return {
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: rows
    }
  };
}

export function buildInteractionExpiredCard(options: InteractionExpiredCardRenderView): {
  text: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
} {
  const LL = getTranslator("zh");
  const lines = [
    formatHtmlHeading(options.title),
    formatHtmlField(LL.runtime.interaction.stateLabel(), LL.runtime.interaction.expiredLabel())
  ];
  if (options.reason) {
    lines.push(formatHtmlField(LL.runtime.interaction.detail(), options.reason));
  }
  return { text: lines.join("\n") };
}

export function buildTurnStatusCard(
  status: ActivityStatus,
  context?: {
    sessionName?: string | null;
    projectName?: string | null;
  }
): string {
  const lines: string[] = [];

  if (context?.sessionName) {
    lines.push(`Session: ${context.sessionName}`);
  }

  if (context?.projectName) {
    lines.push(`Project: ${context.projectName}`);
  }

  lines.push(`Status: ${formatTurnStatus(status.turnStatus)}`);

  const blockedOn = formatBlockedReason(status.threadBlockedReason);
  if (blockedOn) {
    lines.push(`Blocked on: ${blockedOn}`);
  }

  lines.push(`Current step: ${describeCurrentStep(status)}`);

  const latestUpdate = getLatestStatusUpdate(status);
  if (latestUpdate) {
    lines.push(`Update: ${latestUpdate}`);
  } else if (status.latestProgress) {
    lines.push(`Latest progress: ${status.latestProgress}`);
  }

  const milestone = shouldShowMilestone(status, latestUpdate !== null) ? formatLatestMilestone(status) : null;
  if (milestone) {
    lines.push(`Latest milestone: ${milestone}`);
  }

  if (status.finalMessageAvailable) {
    lines.push("Final answer: ready");
  }

  lines.push("Use /inspect for full details. Use /interrupt to stop the current turn.");
  return lines.join("\n");
}

export function buildInspectText(
  snapshot: InspectSnapshot,
  options?: {
    debugFilePath?: string | null;
    sessionName?: string | null;
    projectName?: string | null;
    commands?: RuntimeCommandEntryView[];
    note?: string | null;
  },
  language: UiLanguage = "zh"
): string {
  const LL = getTranslator(language);
  const lines = [formatHtmlHeading(LL.runtime.inspectSection.currentTaskDetails())];

  if (options?.sessionName) {
    lines.push(formatHtmlField(LL.runtime.inspectSection.session(), options.sessionName));
  }

  if (options?.projectName && options.projectName !== options.sessionName) {
    lines.push(formatHtmlField(LL.runtime.inspectSection.project(), options.projectName));
  }

  lines.push(formatHtmlField(LL.runtime.inspectSection.state(), formatInspectTurnStatus(snapshot.turnStatus, language)));

  const blockedOn = formatInspectBlockedReason(snapshot.threadBlockedReason, language);
  if (blockedOn) {
    lines.push(formatHtmlField(LL.runtime.inspectSection.blockedReason(), blockedOn));
  }

  lines.push(formatHtmlField(LL.runtime.inspectSection.currentAction(), describeInspectCurrentStep(snapshot, language)));

  if (snapshot.currentItemDurationSec !== null) {
    lines.push(formatHtmlField(LL.runtime.inspectSection.elapsedTime(), formatDuration(snapshot.currentItemDurationSec)));
  }

  const conclusion = selectInspectConclusion(snapshot, language);
  if (conclusion) {
    lines.push(formatHtmlField(LL.runtime.inspectSection.recentConclusion(), conclusion));
  }

  if (snapshot.finalMessageAvailable) {
    lines.push(formatHtmlField(LL.runtime.inspectSection.finalAnswerReady(), LL.runtime.inspectSection.ready()));
  }

  if (options?.note) {
    lines.push(formatHtmlField(LL.runtime.inspectSection.note(), options.note));
  }

  const timelineLines = formatInspectTimelineSection(snapshot.recentTransitions, language);
  if (timelineLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.recentActions()));
    lines.push(...timelineLines);
  }

  const commandLines = formatInspectCommandSection(options?.commands ?? [], snapshot.recentCommandSummaries, language);
  if (commandLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.recentCommands()));
    lines.push(...commandLines);
  }

  const fileChangeLines = formatInspectSummarySection(snapshot.recentFileChangeSummaries);
  if (fileChangeLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.recentFileChanges()));
    lines.push(...fileChangeLines);
  }

  const toolLines = formatInspectSummarySection([
    ...snapshot.recentMcpSummaries,
    ...snapshot.recentWebSearches
  ]);
  if (toolLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.recentToolsAndSearch()));
    lines.push(...toolLines);
  }

  const hookLines = formatInspectSummarySection(snapshot.recentHookSummaries);
  if (hookLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.recentHooks()));
    lines.push(...hookLines);
  }

  const noticeLines = formatInspectSummarySection(
    [
      ...snapshot.recentNoticeSummaries,
      snapshot.terminalInteractionSummary
    ].filter((value): value is string => Boolean(value))
  );
  if (noticeLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.noticesAndWarnings()));
    lines.push(...noticeLines);
  }

  const tokenUsageLines = formatTokenUsageSection(snapshot.tokenUsage, language);
  if (tokenUsageLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.tokenUsage()));
    lines.push(...tokenUsageLines);
  }

  if (snapshot.latestDiffSummary) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.recentDiff()));
    lines.push(formatHtmlListItem(snapshot.latestDiffSummary));
  }

  const planLines = formatInspectSummarySection(snapshot.planSnapshot);
  if (planLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.planList()));
    lines.push(...planLines);
  }

  const proposedPlanLines = formatInspectSummarySection(snapshot.proposedPlanSnapshot);
  if (proposedPlanLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.planDraft()));
    lines.push(...proposedPlanLines);
  }

  const commentaryLines = formatInspectSummarySection(snapshot.completedCommentary);
  if (commentaryLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.supplementaryNotes()));
    lines.push(...commentaryLines);
  }

  const pendingInteractionLines = formatPendingInteractionSection(snapshot.pendingInteractions, language);
  if (pendingInteractionLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.pendingInteractions()));
    lines.push(...pendingInteractionLines);
  }

  const answeredInteractionLines = formatInspectSummarySection(snapshot.answeredInteractions);
  if (answeredInteractionLines.length > 0) {
    lines.push("", formatHtmlHeading(LL.runtime.inspectSection.recentAnsweredInteractions()));
    lines.push(...answeredInteractionLines);
  }

  return lines.join("\n");
}

export function summarizePendingInteractionState(state: PendingInteractionState, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  switch (state) {
    case "pending":
      return LL.runtime.interactionState.pending();
    case "awaiting_text":
      return LL.runtime.interactionState.awaitingText();
    case "answered":
      return LL.runtime.interactionState.answered();
    case "canceled":
      return LL.runtime.interactionState.canceled();
    case "expired":
      return LL.runtime.interactionState.expired();
    case "failed":
      return LL.runtime.interactionState.failed();
    default:
      return state;
  }
}

function buildRuntimeStatusFieldGroupSummary(fields: readonly RuntimeStatusField[], language: UiLanguage = "zh"): string {
  return fields.map((field) => buildRuntimeStatusFieldLabel(field, language)).join(language === "en" ? ", " : "、");
}

const SELECTABLE_CODEX_CLI_RUNTIME_STATUS_FIELDS: readonly RuntimeStatusField[] = [
  "model-name",
  "model-with-reasoning",
  "current-dir",
  "project-root",
  "context-remaining",
  "context-used",
  "context-window-size",
  "used-tokens",
  "total-input-tokens",
  "total-output-tokens",
  "session-id"
] as const;

function buildRuntimePreferencePages(language: UiLanguage = "zh"): Array<{
  groupLabel: string;
  groupPage: number;
  groupPageCount: number;
  fields: RuntimeStatusField[];
}> {
  const groups = [
    { groupLabel: "Codex CLI", fields: [...SELECTABLE_CODEX_CLI_RUNTIME_STATUS_FIELDS] },
    { groupLabel: "Bridge Extensions", fields: [...BRIDGE_EXTENSION_RUNTIME_STATUS_FIELDS] }
  ];

  void language;

  return groups.flatMap(({ groupLabel, fields }) => {
    const groupPageCount = Math.max(1, Math.ceil(fields.length / RUNTIME_FIELD_PAGE_SIZE));
    return Array.from({ length: groupPageCount }, (_value, groupPage) => ({
      groupLabel,
      groupPage,
      groupPageCount,
      fields: fields.slice(groupPage * RUNTIME_FIELD_PAGE_SIZE, (groupPage + 1) * RUNTIME_FIELD_PAGE_SIZE)
    }));
  });
}

function buildCollapsedInspectText(html: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  const blocks = html.split("\n\n");
  const summary = blocks[0] ?? html;
  return `${summary}\n${formatHtmlField(LL.runtime.inspectSection.note(), LL.runtime.inspectSection.collapseHint())}`;
}

function paginateInspectHtml(html: string): string[] {
  const blocks = html.split("\n\n");
  const summary = blocks[0] ?? html;
  const sections = blocks.slice(1);
  if (sections.length === 0) {
    return [html];
  }

  const sectionLengthLimit = Math.max(200, INSPECT_PAGE_CHAR_LIMIT - summary.length - 2);
  const normalizedSections = sections.flatMap((section) => splitOversizedInspectSection(section, sectionLengthLimit));
  const pages: string[] = [];
  let current = summary;

  for (const section of normalizedSections) {
    const candidate = `${current}\n\n${section}`;
    if (candidate.length <= INSPECT_PAGE_CHAR_LIMIT) {
      current = candidate;
      continue;
    }

    pages.push(current);
    current = `${summary}\n\n${section}`;
  }

  pages.push(current);
  return pages;
}

function splitOversizedInspectSection(section: string, maxLength: number): string[] {
  if (section.length <= maxLength) {
    return [section];
  }

  const lines = section.split("\n");
  const header = isStandaloneInspectHeading(lines[0] ?? "") ? lines[0] ?? null : null;
  const bodyLines = header ? lines.slice(1) : lines;
  if (bodyLines.length === 0) {
    return [section];
  }

  const chunks: string[] = [];
  const lineLengthLimit = Math.max(32, maxLength - (header ? header.length + 1 : 0));
  let currentLines = header ? [header] : [];

  for (const line of bodyLines) {
    const lineChunks = splitOversizedInspectLine(line, lineLengthLimit);
    for (const lineChunk of lineChunks) {
      const candidateLines = [...currentLines, lineChunk];
      const candidate = candidateLines.join("\n");
      if (candidate.length <= maxLength) {
        currentLines = candidateLines;
        continue;
      }

      if (currentLines.length > (header ? 1 : 0)) {
        chunks.push(currentLines.join("\n"));
      }
      currentLines = header ? [header, lineChunk] : [lineChunk];
    }
  }

  if (currentLines.length > (header ? 1 : 0)) {
    chunks.push(currentLines.join("\n"));
  }

  return chunks.length > 0 ? chunks : [section];
}

function splitOversizedInspectLine(line: string, maxLength: number): string[] {
  if (line.length <= maxLength) {
    return [line];
  }

  const { prefix, content } = splitInspectLinePrefix(line);
  const contentLengthLimit = Math.max(16, maxLength - prefix.length);
  if (!content || prefix.length >= maxLength) {
    return splitEscapedInspectText(line, maxLength);
  }

  return splitEscapedInspectText(content, contentLengthLimit).map((chunk) => `${prefix}${chunk}`);
}

function splitInspectLinePrefix(line: string): { prefix: string; content: string } {
  const patterns = [
    /^(\d+\.\s+<b>[^<]+<\/b>\s+)(.+)$/u,
    /^(-\s+<b>[^<]+<\/b>\s+)(.+)$/u,
    /^(\d+\.\s+)(.+)$/u,
    /^(-\s+)(.+)$/u,
    /^(<b>[^<]+<\/b>\s+)(.+)$/u
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      return {
        prefix: match[1] ?? "",
        content: match[2] ?? ""
      };
    }
  }

  return {
    prefix: "",
    content: line
  };
}

function splitEscapedInspectText(text: string, maxLength: number): string[] {
  const tokens = text.match(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);|\s+|./giu) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const token of tokens) {
    if (current.length + token.length <= maxLength) {
      current += token;
      continue;
    }

    if (current.length > 0) {
      chunks.push(current.trimEnd());
      current = token.trimStart();
      continue;
    }

    chunks.push(token);
  }

  if (current.length > 0) {
    chunks.push(current.trimEnd());
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

function isStandaloneInspectHeading(line: string): boolean {
  return /^<b>[^<]+<\/b>$/u.test(line.trim());
}

function pushHtmlRuntimeCardContext(lines: string[], context: RuntimeCardContext, language: UiLanguage = "zh"): void {
  const LL = getTranslator(language);
  if (context.sessionName) {
    lines.push(formatRuntimeCardRow(LL.runtime.session(), context.sessionName));
  }
}

function formatRuntimeStatusOptionalField(line: string, language: UiLanguage): string {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex === -1) {
    return escapeHtml(line);
  }

  const rawLabel = line.slice(0, separatorIndex).trim();
  const rawValue = line.slice(separatorIndex + 1).trimStart();
  if (!rawLabel) {
    return escapeHtml(line);
  }

  return formatRuntimeCardRow(
    language === "en" ? formatRuntimeStatusOptionalLabel(rawLabel) : formatRuntimeStatusOptionalLabelZh(rawLabel, language),
    rawValue
  );
}

function formatRuntimeStatusOptionalLabel(label: string): string {
  const uppercaseTokens = new Set(["api", "cli", "html", "id", "json", "mcp", "url", "uuid"]);
  return label
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (uppercaseTokens.has(lower)) {
        return lower.toUpperCase();
      }

      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function formatRuntimeStatusOptionalLabelZh(label: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  switch (label) {
    case "model-with-reasoning":
      return LL.runtime.optionalLabel.model();
    case "plan_mode":
      return "Plan Mode";
    case "current-dir":
      return LL.runtime.optionalLabel.currentDir();
    default:
      return formatRuntimeStatusOptionalLabel(label);
  }
}

function buildCollapsedPlanButtonLabel(_entries: string[], language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return LL.runtime.planEntry();
}

function buildCollapsedAgentButtonLabel(entries: CollabAgentStateSnapshot[], language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return language === "en"
    ? `Agents: ${entries.length}${LL.runtime.agentsRunningSuffix()}`
    : `Agent：${entries.length}${LL.runtime.agentsRunningSuffix()}`;
}

function renderAgentRuntimeLine(entry: CollabAgentStateSnapshot, index: number, progressLimit = 160): string {
  const prefix = `${index}. ${escapeHtml(entry.label)} (${escapeHtml(formatAgentStatus(entry.status))})`;
  if (!entry.progress) {
    return prefix;
  }

  return `${prefix}: ${renderInlineMarkdown(truncateText(entry.progress, progressLimit))}`;
}

function selectCurrentPlanEntry(entries: string[]): string | null {
  return entries.find((entry) => /\(inProgress\)$/u.test(entry))
    ?? entries.find((entry) => /\((pending|todo)\)$/u.test(entry))
    ?? entries[0]
    ?? entries.at(-1)
    ?? null;
}

function stripPlanEntryStatus(entry: string): string {
  return entry
    .replace(/^\d+\.\s*/u, "")
    .replace(/^[-*]\s+/u, "")
    .replace(/\s+\((inProgress|pending|todo|completed|failed|blocked)\)$/u, "")
    .replace(/^#+\s*/u, "")
    .trim();
}

function renderHubPlanEntryLine(entry: string, index: number, language: UiLanguage, textLimit: number): string {
  const parsedStatus = parsePlanEntryStatus(entry);
  const renderedText = renderInlineMarkdown(truncateText(stripPlanEntryStatus(entry), textLimit));
  if (!parsedStatus) {
    return `${index}. ${renderedText}`;
  }

  return `${index}. <b>${escapeHtml(formatHubPlanStatus(parsedStatus, language))}</b> · ${renderedText}`;
}

function parsePlanEntryStatus(entry: string): "inProgress" | "completed" | "pending" | "todo" | "failed" | "blocked" | null {
  const match = entry.match(/\((inProgress|pending|todo|completed|failed|blocked)\)\s*$/u);
  return (match?.[1] as "inProgress" | "completed" | "pending" | "todo" | "failed" | "blocked" | null) ?? null;
}

function formatHubPlanStatus(
  status: "inProgress" | "completed" | "pending" | "todo" | "failed" | "blocked",
  language: UiLanguage
): string {
  const LL = getTranslator(language);
  switch (status) {
    case "inProgress":
      return LL.runtime.planStatus.inProgress();
    case "completed":
      return LL.runtime.planStatus.completed();
    case "pending":
    case "todo":
      return LL.runtime.planStatus.pending();
    case "failed":
      return LL.runtime.planStatus.failed();
    case "blocked":
      return LL.runtime.planStatus.blocked();
  }
}

function renderHubAgentDetailLine(
  entry: CollabAgentStateSnapshot,
  language: UiLanguage,
  progressLimit: number
): string {
  const LL = getTranslator(language);
  const progressText = entry.progress
    ? renderInlineMarkdown(truncateText(entry.progress, progressLimit))
    : escapeHtml(LL.runtime.agentStatus.waitingForUpdate());
  return `${buildHubAgentStatusBadge(entry.status)} <b>${escapeHtml(entry.label)}</b> · ${escapeHtml(formatHubAgentStatus(entry.status, language))} · ${progressText}`;
}

function buildHubAgentStatusBadge(status: CollabAgentStateSnapshot["status"]): string {
  switch (status) {
    case "running":
      return "🟢";
    case "completed":
      return "🏁";
    case "errored":
    case "notFound":
      return "⛔";
    case "pendingInit":
    case "shutdown":
    default:
      return "🟡";
  }
}

function formatHubAgentStatus(status: CollabAgentStateSnapshot["status"], language: UiLanguage): string {
  const LL = getTranslator(language);
  switch (status) {
    case "pendingInit":
      return LL.runtime.agentStatus.pendingInit();
    case "running":
      return LL.runtime.agentStatus.running();
    case "completed":
      return LL.runtime.agentStatus.completed();
    case "errored":
      return LL.runtime.agentStatus.errored();
    case "shutdown":
      return LL.runtime.agentStatus.stopped();
    case "notFound":
      return LL.runtime.agentStatus.notFound();
    default:
      return status;
  }
}

function formatAgentStatus(status: CollabAgentStateSnapshot["status"]): string {
  switch (status) {
    case "pendingInit":
      return "pending";
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "errored":
      return "errored";
    case "shutdown":
      return "shutdown";
    case "notFound":
      return "not found";
    default:
      return status;
  }
}

function buildDetailedRuntimeCommandLines(
  command: RuntimeCommandEntryView,
  index: number | null,
  language: UiLanguage
): string[] {
  const LL = getTranslator(language);
  const prefix = index === null ? "" : `${index}. `;
  const detailPrefix = index === null ? "" : "- ";
  const lines = [`${prefix}${formatHtmlField(LL.runtime.inspectSection.commandLabel(), formatRuntimeCommandText(command.commandText))}`];
  lines.push(`${detailPrefix}${formatHtmlField(LL.runtime.inspectSection.commandState(), formatInspectCommandState(command.state, language))}`);

  if (command.latestSummary) {
    lines.push(`${detailPrefix}${formatHtmlField(LL.runtime.inspectSection.commandResult(), truncateText(command.latestSummary, 220))}`);
  }

  if (command.cwd) {
    lines.push(`${detailPrefix}${formatHtmlField(LL.runtime.inspectSection.commandDirectory(), truncateText(command.cwd, 220))}`);
  }

  if (typeof command.exitCode === "number") {
    lines.push(`${detailPrefix}${formatHtmlField(LL.runtime.inspectSection.commandExitCode(), `${command.exitCode}`)}`);
  }

  if (typeof command.durationMs === "number") {
    lines.push(`${detailPrefix}${formatHtmlField(LL.runtime.inspectSection.commandDuration(), formatCommandDuration(command.durationMs))}`);
  }

  return lines;
}

function formatInspectCommandSection(commands: RuntimeCommandEntryView[], fallbackSummaries: string[], language: UiLanguage): string[] {
  if (commands.length === 0) {
    return formatInspectSummarySection(fallbackSummaries);
  }

  return commands.flatMap((command, index) => buildDetailedRuntimeCommandLines(command, index + 1, language));
}

function formatPendingInteractionSection(snapshot: InspectSnapshot["pendingInteractions"], language: UiLanguage): string[] {
  const LL = getTranslator(language);
  return snapshot.map((interaction, index) => {
    const suffix = interaction.awaitingText ? LL.runtime.inspectSection.awaitingTextSuffix() : "";
    return `${index + 1}. ${escapeHtml(interaction.interactionKind)} / ${escapeHtml(interaction.requestMethod)} / ${escapeHtml(summarizePendingInteractionState(interaction.state, language))}${suffix}`;
  });
}

function formatTokenUsageSection(tokenUsage: InspectSnapshot["tokenUsage"], language: UiLanguage): string[] {
  if (!tokenUsage) {
    return [];
  }

  const LL = getTranslator(language);
  const lines = [
    formatHtmlListItem(`${LL.runtime.tokenUsageThisPrefix()}${tokenUsage.lastTotalTokens}（${LL.runtime.tokenUsageInput()}${tokenUsage.lastInputTokens}${LL.runtime.tokenUsageOutput()}${tokenUsage.lastOutputTokens}${LL.runtime.tokenUsageCache()}${tokenUsage.lastCachedInputTokens}${LL.runtime.tokenUsageReasoning()}${tokenUsage.lastReasoningOutputTokens}）`),
    formatHtmlListItem(`${LL.runtime.tokenUsageTotalPrefix()}${tokenUsage.totalTokens}（${LL.runtime.tokenUsageInput()}${tokenUsage.totalInputTokens}${LL.runtime.tokenUsageOutput()}${tokenUsage.totalOutputTokens}${LL.runtime.tokenUsageCache()}${tokenUsage.totalCachedInputTokens}${LL.runtime.tokenUsageReasoning()}${tokenUsage.totalReasoningOutputTokens}）`)
  ];
  if (tokenUsage.modelContextWindow !== null) {
    lines.push(formatHtmlListItem(`${LL.runtime.tokenContextWindowPrefix()}${tokenUsage.modelContextWindow}`));
  }

  return lines;
}

function formatRuntimeCommandText(commandText: string): string {
  const trimmed = commandText.trim();
  if (trimmed.startsWith("$")) {
    return truncateText(trimmed, 220);
  }

  return truncateText(`$ ${trimmed}`, 220);
}

function formatInspectSummarySection(values: string[]): string[] {
  return values
    .filter((value) => value.trim().length > 0)
    .map((value) => formatHtmlListItem(value));
}

function formatInspectTimelineSection(transitions: InspectSnapshot["recentTransitions"], language: UiLanguage): string[] {
  return transitions
    .slice(-5)
    .reverse()
    .map((transition, index) => `${index + 1}. ${escapeHtml(`${formatRelativeTime(transition.at, language)}：${translateInspectSummary(transition.summary, language)}`)}`);
}

function formatRuntimeCardRow(
  label: string,
  value: string,
  options: {
    valueIsHtml?: boolean;
  } = {}
): string {
  const renderedValue = options.valueIsHtml ? value : escapeHtml(value);
  return `${formatHtmlHeading(label)} · ${renderedValue}`;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/gu, "");
}

function formatHtmlListItem(value: string): string {
  return `- ${escapeHtml(value)}`;
}

function formatInspectTurnStatus(status: ActivityStatus["turnStatus"], language: UiLanguage): string {
  const LL = getTranslator(language);
  switch (status) {
    case "idle":
      return LL.runtime.inspectTurnStatus.idle();
    case "starting":
      return LL.runtime.inspectTurnStatus.starting();
    case "running":
      return LL.runtime.inspectTurnStatus.running();
    case "blocked":
      return LL.runtime.inspectTurnStatus.blocked();
    case "interrupted":
      return LL.runtime.inspectTurnStatus.interrupted();
    case "completed":
      return LL.runtime.inspectTurnStatus.completed();
    case "failed":
      return LL.runtime.inspectTurnStatus.failed();
    default:
      return LL.runtime.inspectTurnStatus.unknown();
  }
}

function formatInspectCommandState(state: string, language: UiLanguage): string {
  const LL = getTranslator(language);
  switch (state.toLowerCase()) {
    case "running":
      return LL.runtime.commandState.running();
    case "completed":
      return LL.runtime.commandState.completed();
    case "failed":
      return LL.runtime.commandState.failed();
    case "interrupted":
      return LL.runtime.commandState.interrupted();
    default:
      return state;
  }
}

function formatInspectBlockedReason(reason: ActivityStatus["threadBlockedReason"], language: UiLanguage): string | null {
  const LL = getTranslator(language);
  switch (reason) {
    case "waitingOnApproval":
      return LL.runtime.blockedToken.waitingOnApproval();
    case "waitingOnUserInput":
      return LL.runtime.blockedToken.waitingOnUserInput();
    default:
      return null;
  }
}

function describeInspectCurrentStep(status: ActivityStatus, language: UiLanguage): string {
  const LL = getTranslator(language);
  if (status.threadBlockedReason === "waitingOnApproval") {
    return LL.runtime.currentStep.waitingForApproval();
  }

  if (status.threadBlockedReason === "waitingOnUserInput") {
    return LL.runtime.currentStep.waitingForInput();
  }

  switch (status.activeItemType) {
    case "planning":
      return LL.runtime.currentStep.updatingPlan();
    case "commandExecution":
      return appendSpecificLabel(LL.runtime.currentStep.runningCommand(), status.activeItemLabel, ["command"], "：");
    case "fileChange":
      return appendSpecificLabel(LL.runtime.currentStep.editingFiles(), status.activeItemLabel, ["file changes"], "：");
    case "mcpToolCall":
      return appendSpecificLabel(LL.runtime.currentStep.callingMcpTool(), status.activeItemLabel, ["MCP tool call"], "：");
    case "webSearch":
      return appendSpecificLabel(LL.runtime.currentStep.webSearch(), status.activeItemLabel, ["web search"], "：");
    case "agentMessage":
      return appendSpecificLabel(LL.runtime.currentStep.draftingResponse(), status.activeItemLabel, ["assistant response"], "：");
    case "reasoning":
      return LL.runtime.currentStep.thinking();
    case "other":
      return appendSpecificLabel(LL.runtime.currentStep.processingTask(), status.activeItemLabel, ["work item", "other"], "：");
    default:
      return defaultInspectStepForStatus(status.turnStatus, language);
  }
}

function selectInspectConclusion(status: ActivityStatus, language: UiLanguage): string | null {
  const latestUpdate = getLatestStatusUpdate(status);
  if (latestUpdate) {
    return latestUpdate;
  }

  if (status.latestProgress) {
    return status.latestProgress;
  }

  return formatInspectMilestone(status, language);
}

function translateInspectSummary(summary: string, language: UiLanguage): string {
  const LL = getTranslator(language);
  if (summary === "turn started") {
    return LL.runtime.inspectSection.turnStarted();
  }

  const completedMatch = summary.match(/^turn completed \((.+)\)$/u);
  if (completedMatch) {
    return `${LL.runtime.inspectSection.turnCompleted()}${formatInspectTurnStatus(mapCompletionWord(completedMatch[1] ?? "unknown"), language)})`;
  }

  const blockedMatch = summary.match(/^thread blocked \((.+)\)$/u);
  if (blockedMatch) {
    return `${LL.runtime.inspectSection.threadBlocked()}${translateBlockedToken(blockedMatch[1] ?? "", language)})`;
  }

  const statusMatch = summary.match(/^thread status (.+)$/u);
  if (statusMatch) {
    return `${LL.runtime.inspectSection.threadStatus()}${translateThreadStatusToken(statusMatch[1] ?? "", language)}`;
  }

  const startedMatch = summary.match(/^(.+) started$/u);
  if (startedMatch) {
    return `${LL.runtime.inspectSection.itemStarted()}${startedMatch[1] ?? ""}`;
  }

  const itemCompletedMatch = summary.match(/^(.+) completed$/u);
  if (itemCompletedMatch) {
    return `${LL.runtime.inspectSection.itemCompleted()}${itemCompletedMatch[1] ?? ""}`;
  }

  return summary;
}

function formatTurnStatus(status: ActivityStatus["turnStatus"]): string {
  switch (status) {
    case "idle":
      return "Idle";
    case "starting":
      return "Starting";
    case "running":
      return "Running";
    case "blocked":
      return "Blocked";
    case "interrupted":
      return "Interrupted";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

function formatBlockedReason(reason: ActivityStatus["threadBlockedReason"]): string | null {
  switch (reason) {
    case "waitingOnApproval":
      return "approval";
    case "waitingOnUserInput":
      return "user input";
    default:
      return null;
  }
}

function describeCurrentStep(status: ActivityStatus): string {
  if (status.threadBlockedReason === "waitingOnApproval") {
    return BLOCKED_PROGRESS_APPROVAL;
  }

  if (status.threadBlockedReason === "waitingOnUserInput") {
    return BLOCKED_PROGRESS_USER_INPUT;
  }

  switch (status.activeItemType) {
    case "planning":
      return "Updating the plan";
    case "commandExecution":
      return appendSpecificLabel("Running command", status.activeItemLabel, ["command"]);
    case "fileChange":
      return appendSpecificLabel("Editing files", status.activeItemLabel, ["file changes"]);
    case "mcpToolCall":
      return appendSpecificLabel("Calling MCP tool", status.activeItemLabel, ["MCP tool call"]);
    case "webSearch":
      return appendSpecificLabel("Searching the web", status.activeItemLabel, ["web search"]);
    case "agentMessage":
      return appendSpecificLabel("Drafting the response", status.activeItemLabel, ["assistant response"]);
    case "reasoning":
      return "Thinking";
    case "other":
      return appendSpecificLabel("Working on", status.activeItemLabel, ["work item", "other"]);
    default:
      return defaultStepForStatus(status.turnStatus);
  }
}

function appendSpecificLabel(base: string, label: string | null, genericLabels: string[], separator = ": "): string {
  if (!label || genericLabels.includes(label)) {
    return base;
  }

  return `${base}${separator}${label}`;
}

function defaultStepForStatus(status: ActivityStatus["turnStatus"]): string {
  switch (status) {
    case "starting":
      return "Waiting for first activity";
    case "running":
      return "Processing";
    case "blocked":
      return "Waiting";
    case "completed":
      return "No active step";
    case "interrupted":
      return "No active step";
    case "failed":
      return "No active step";
    case "idle":
      return "Ready";
    default:
      return "Waiting for activity";
  }
}

function defaultInspectStepForStatus(status: ActivityStatus["turnStatus"], language: UiLanguage): string {
  const LL = getTranslator(language);
  switch (status) {
    case "starting":
      return LL.runtime.currentStep.waitingForFirstActivity();
    case "running":
      return LL.runtime.currentStep.processing();
    case "blocked":
      return LL.runtime.currentStep.waitingToContinue();
    case "completed":
      return LL.runtime.currentStep.noActiveStep();
    case "interrupted":
      return LL.runtime.currentStep.interruptedNoStep();
    case "failed":
      return LL.runtime.currentStep.failedNoStep();
    case "idle":
      return LL.runtime.currentStep.noActiveStep();
    default:
      return LL.runtime.currentStep.waitingForActivity();
  }
}

function formatLatestMilestone(status: ActivityStatus): string | null {
  if (!status.lastHighValueEventType || !status.lastHighValueTitle) {
    return null;
  }

  if (
    status.latestProgress &&
    status.lastHighValueEventType !== "done" &&
    status.lastHighValueEventType !== "blocked"
  ) {
    return null;
  }

  const value = buildMilestoneText(status);
  if (!value) {
    return null;
  }

  return status.latestProgress === value ? null : value;
}

function formatInspectMilestone(status: ActivityStatus, language: UiLanguage): string | null {
  const LL = getTranslator(language);
  const title = status.lastHighValueTitle;
  if (!title) {
    return null;
  }

  switch (status.lastHighValueEventType) {
    case "ran_cmd": {
      const command = stripPrefix(title, "Ran cmd: ");
      return status.lastHighValueDetail
        ? `命令结果：${command} -> ${status.lastHighValueDetail}`
        : `开始运行命令：${command}`;
    }
    case "changed":
      return `文件变更：${status.lastHighValueDetail ?? stripPrefix(title, "Changed: ")}`;
    case "found":
      return `发现：${status.lastHighValueDetail ?? stripPrefix(title, "Found: ")}`;
    case "blocked":
      return `阻塞：${status.lastHighValueDetail ?? stripPrefix(title, "Blocked: ")}`;
    case "done":
      return status.lastHighValueDetail ? LL.runtime.milestone.replyGenerated() : `执行结束：${stripPrefix(title, "Done: ")}`;
    default:
      return null;
  }
}

function shouldShowMilestone(status: ActivityStatus, hasRecentUpdates: boolean): boolean {
  if (!hasRecentUpdates) {
    return true;
  }

  return status.lastHighValueEventType === "done" || status.lastHighValueEventType === "blocked";
}

function getLatestStatusUpdate(status: ActivityStatus): string | null {
  return status.recentStatusUpdates.at(-1) ?? null;
}

function buildMilestoneText(status: ActivityStatus): string | null {
  const title = status.lastHighValueTitle;
  if (!title) {
    return null;
  }

  switch (status.lastHighValueEventType) {
    case "ran_cmd": {
      const command = stripPrefix(title, "Ran cmd: ");
      return status.lastHighValueDetail
        ? `Command result: ${command} -> ${status.lastHighValueDetail}`
        : `Command started: ${command}`;
    }
    case "changed":
      return `File change: ${status.lastHighValueDetail ?? stripPrefix(title, "Changed: ")}`;
    case "found":
      return `Discovery: ${status.lastHighValueDetail ?? stripPrefix(title, "Found: ")}`;
    case "blocked":
      return `Blocker: ${status.lastHighValueDetail ?? stripPrefix(title, "Blocked: ")}`;
    case "done":
      return status.lastHighValueDetail
        ? `Assistant reply: ${status.lastHighValueDetail}`
        : `Completion: ${stripPrefix(title, "Done: ")}`;
    default:
      return null;
  }
}

function stripPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (remainder === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainder}s`;
}

function formatCommandDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = Math.round((durationMs / 1000) * 10) / 10;
  return `${seconds}s`;
}

function mapCompletionWord(status: string): ActivityStatus["turnStatus"] {
  switch (status) {
    case "completed":
      return "completed";
    case "interrupted":
      return "interrupted";
    case "failed":
    case "error":
      return "failed";
    default:
      return "unknown";
  }
}

function translateBlockedToken(token: string, language: UiLanguage): string {
  const LL = getTranslator(language);
  switch (token) {
    case "waitingOnApproval":
      return LL.runtime.blockedToken.waitingOnApproval();
    case "waitingOnUserInput":
      return LL.runtime.blockedToken.waitingOnUserInput();
    default:
      return token;
  }
}

function translateThreadStatusToken(token: string, language: UiLanguage): string {
  const LL = getTranslator(language);
  switch (token) {
    case "notLoaded":
      return LL.runtime.threadStatus.notLoaded();
    case "idle":
      return LL.runtime.threadStatus.idle();
    case "active":
      return LL.runtime.threadStatus.active();
    case "systemError":
      return LL.runtime.threadStatus.systemError();
    default:
      return token;
  }
}
