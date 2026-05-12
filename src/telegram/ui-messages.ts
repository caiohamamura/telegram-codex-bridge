import { basename } from "node:path";

import type {
  ProjectCandidate,
  ProjectPickerResult,
  ReasoningEffort,
  ReadinessSnapshot,
  SessionRow,
  UiLanguage
} from "../types.js";
import { getTranslator } from "../i18n/index.js";
import { truncateText } from "../util/text.js";
import type { TelegramInlineKeyboardMarkup } from "./api.js";
import {
  encodeNewBrowseBackCallback,
  encodeNewBrowseOpenCallback,
  encodeNewBrowseRootCallback,
  encodeModelCloseCallback,
  encodeModelDefaultCallback,
  encodeModelEffortCallback,
  encodeModelPageCallback,
  encodeModelPickCallback,
  encodePathBackCallback,
  encodePathConfirmCallback,
  encodePathManualCallback,
  encodePickCallback,
  encodeRenameProjectCallback,
  encodeRenameProjectClearCallback,
  encodeRenameSessionCallback,
  encodeResumeCloseCallback,
  encodeResumePageCallback,
  encodeResumePickCallback
} from "./ui-callbacks.js";
import {
  chunkButtons,
  escapeHtml,
  formatHtmlField,
  formatHtmlHeading,
  formatReasoningEffortLabel,
  formatRelativeTime
} from "./ui-shared.js";

function displayProjectName(projectName: string, projectAlias: string | null | undefined): string {
  return projectAlias?.trim() || projectName;
}

function buildSessionProjectContextBlock(title: string, sessionName: string, projectName: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return [
    formatHtmlHeading(title),
    formatHtmlField(LL.where.sessionName(), sessionName),
    formatHtmlField(LL.where.project(), projectName)
  ].join("\n");
}

function buildProjectBadgeLabels(candidate: ProjectCandidate, language: UiLanguage): string[] {
  const LL = getTranslator(language);
  const labels: string[] = [];
  if (candidate.group !== "recent" && candidate.isRecent) {
    labels.push(LL.projects.badges.recent());
  }
  if (candidate.group !== "discovered" && candidate.fromScan) {
    labels.push(LL.projects.badges.locallyDiscovered());
  }
  if (candidate.hasExistingSession) {
    labels.push(LL.projects.badges.hasHistory());
  }

  return labels;
}

export function buildProjectPickerMessage(picker: ProjectPickerResult, language: UiLanguage = "zh"): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const LL = getTranslator(language);
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  const visibleCandidates = picker.groups.flatMap((group) => group.candidates);
  const candidateButtons = visibleCandidates.map((candidate, index) => ({
    text: String(index + 1),
    callback_data: encodePickCallback(candidate.projectKey)
  }));

  rows.push(...chunkButtons(candidateButtons, 5));
  rows.push([
    { text: LL.projects.browseDirectory(), callback_data: encodeNewBrowseOpenCallback() },
    { text: LL.projects.enterPath(), callback_data: encodePathManualCallback() }
  ]);

  const lines: string[] = [LL.projects.pickerTitle()];
  for (const noticeLine of picker.noticeLines) {
    lines.push("", noticeLine);
  }
  if (picker.emptyText) {
    lines.push("", LL.projects.empty());
  }

  let itemIndex = 1;
  for (const group of picker.groups) {
    lines.push("", formatProjectPickerGroupTitle(group.key, language));
    for (const candidate of group.candidates) {
      const badges = buildProjectBadgeLabels(candidate, language);
      lines.push(`${itemIndex}. ${candidate.displayName}`);
      lines.push(`   ${candidate.pathLabel}`);
      if (badges.length > 0) {
        lines.push(`   ${badges.join(" · ")}`);
      }
      itemIndex += 1;
    }
  }

  return {
    text: lines.join("\n"),
    replyMarkup: { inline_keyboard: rows }
  };
}

function formatProjectPickerGroupTitle(group: ProjectPickerResult["groups"][number]["key"], language: UiLanguage): string {
  const LL = getTranslator(language);
  switch (group) {
    case "pinned":
      return LL.projects.groups.pinned();
    case "recent":
      return LL.projects.groups.recent();
  }
}

export function buildProjectBrowseRootPickerMessage(options: {
  roots: Array<{ index: number; label: string; pathLabel: string }>;
  language?: UiLanguage;
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = options.roots.map((root) => [{
    text: `${root.index + 1}`,
    callback_data: encodeNewBrowseRootCallback(root.index)
  }]);
  rows.push([{ text: LL.projects.backToProjects(), callback_data: encodeNewBrowseBackCallback() }]);

  const lines: string[] = [LL.projects.selectRoot()];
  for (const root of options.roots) {
    lines.push("");
    lines.push(`${root.index + 1}. ${root.label}`);
    lines.push(`   ${root.pathLabel}`);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: { inline_keyboard: rows }
  };
}

export function buildManualPathPrompt(language: UiLanguage = "zh"): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const LL = getTranslator(language);
  return {
    text: LL.projects.manualPathPrompt(),
    replyMarkup: {
      inline_keyboard: [[{ text: LL.projects.backToProjects(), callback_data: encodePathBackCallback() }]]
    }
  };
}

export function buildManualPathConfirmMessage(candidate: ProjectCandidate, language: UiLanguage = "zh"): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const LL = getTranslator(language);
  return {
    text: [
      LL.projects.confirmNewSession(),
      formatHtmlField(LL.where.project(), candidate.displayName),
      formatHtmlField(LL.where.path(), candidate.projectPath)
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{ text: LL.projects.confirmNewSessionButton(), callback_data: encodePathConfirmCallback(candidate.projectKey) }],
        [{ text: LL.projects.backToProjects(), callback_data: encodePathBackCallback() }]
      ]
    }
  };
}

export function buildNoNewProjectsMessage(language: UiLanguage = "zh"): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const LL = getTranslator(language);
  return {
    text: LL.projects.offlineEntry(),
    replyMarkup: {
      inline_keyboard: [
        [{ text: LL.projects.browseDirectory(), callback_data: encodeNewBrowseOpenCallback() }],
        [{ text: LL.projects.enterPath(), callback_data: encodePathManualCallback() }],
        [{ text: LL.projects.backToProjects(), callback_data: encodePathBackCallback() }]
      ]
    }
  };
}

interface ModelPickerOption {
  id: string;
  displayName: string;
  isDefault: boolean;
}

interface ReasoningEffortOption {
  reasoningEffort: ReasoningEffort;
  description: string;
}

const MODEL_PAGE_SIZE = 8;

export interface SessionModelDisplayState {
  configuredModel: string | null;
  configuredReasoningEffort: ReasoningEffort | null;
  effectiveModel: string | null;
  effectiveReasoningEffort: ReasoningEffort | null;
}

export function buildModelPickerMessage(options: {
  session: SessionRow;
  models: ModelPickerOption[];
  page: number;
  modelState?: SessionModelDisplayState;
  language?: UiLanguage;
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const state = resolveModelDisplayState(options.session, options.modelState);
  const totalPages = Math.max(1, Math.ceil(options.models.length / MODEL_PAGE_SIZE));
  const safePage = Math.min(Math.max(options.page, 0), totalPages - 1);
  const pageModels = options.models.slice(safePage * MODEL_PAGE_SIZE, (safePage + 1) * MODEL_PAGE_SIZE);
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
    [{ text: buildDefaultModelButtonLabel(state, language), callback_data: encodeModelDefaultCallback(options.session.sessionId) }],
    ...pageModels.map((model, index) => [{
      text: buildModelButtonLabel(model, state, language),
      callback_data: encodeModelPickCallback(options.session.sessionId, safePage * MODEL_PAGE_SIZE + index)
    }])
  ];
  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (safePage > 0) {
    navigation.push({ text: LL.common.previousPage(), callback_data: encodeModelPageCallback(options.session.sessionId, safePage - 1) });
  }
  if (safePage + 1 < totalPages) {
    navigation.push({ text: LL.common.nextPage(), callback_data: encodeModelPageCallback(options.session.sessionId, safePage + 1) });
  }
  if (navigation.length > 0) {
    rows.push(navigation);
  }
  rows.push([{ text: LL.common.close(), callback_data: encodeModelCloseCallback(options.session.sessionId) }]);

  return {
    text: [
      LL.model.selectModel(),
      `${LL.model.current()}${LL.common.configured()}：${formatModelReasoning(state.configuredModel, state.configuredReasoningEffort, language)}`,
      `${LL.model.current()}${LL.common.effective()}：${formatModelReasoning(state.effectiveModel, state.effectiveReasoningEffort, language)}`,
      language === "en"
        ? `${LL.model.pageLabel()} ${safePage + 1}/${totalPages}`
        : `第 ${safePage + 1}/${totalPages} ${LL.model.pageLabel()}`,
      LL.model.modelTip()
    ].join("\n"),
    replyMarkup: { inline_keyboard: rows }
  };
}

export function buildReasoningEffortPickerMessage(options: {
  session: SessionRow;
  model: ModelPickerOption & {
    defaultReasoningEffort: ReasoningEffort;
    supportedReasoningEfforts: ReasoningEffortOption[];
  };
  modelIndex: number;
  modelState?: SessionModelDisplayState;
  language?: UiLanguage;
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const state = resolveModelDisplayState(options.session, options.modelState);
  const isConfiguredModel = state.configuredModel === options.model.id;
  const isEffectiveModel = state.effectiveModel === options.model.id;
  const effortButtons = options.model.supportedReasoningEfforts.map((option) => ({
    text: buildReasoningEffortButtonLabel(option.reasoningEffort, state, isConfiguredModel, isEffectiveModel, language),
    callback_data: encodeModelEffortCallback(options.session.sessionId, options.modelIndex, option.reasoningEffort)
  }));
  const rows = [
    [{
      text: buildDefaultEffortButtonLabel(options.model.defaultReasoningEffort, state, isConfiguredModel, isEffectiveModel, language),
      callback_data: encodeModelEffortCallback(options.session.sessionId, options.modelIndex, null)
    }],
    ...chunkButtons(effortButtons, 2),
    [{ text: LL.common.close(), callback_data: encodeModelCloseCallback(options.session.sessionId) }]
  ];

  return {
    text: [
      LL.model.selectEffort(),
      language === "en" ? `Model: ${options.model.id}` : `模型：${options.model.id}`,
      `${LL.model.current()}${LL.common.configured()}：${formatModelReasoning(state.configuredModel, state.configuredReasoningEffort, language)}`,
      `${LL.model.current()}${LL.common.effective()}：${formatModelReasoning(state.effectiveModel, state.effectiveReasoningEffort, language)}`,
      LL.model.effortTip()
    ].join("\n"),
    replyMarkup: { inline_keyboard: rows }
  };
}

export function buildStatusText(
  snapshot: ReadinessSnapshot,
  activeSession: SessionRow | null,
  runtimeStatusText?: string | null,
  modelState?: SessionModelDisplayState | null,
  language: UiLanguage = "zh"
): string {
  const LL = getTranslator(language);
  const issueText = snapshot.details.issues.length === 0 ? LL.common.none() : snapshot.details.issues.join(language === "en" ? "; " : "；");
  const resolvedModelState = activeSession ? resolveModelDisplayState(activeSession, modelState ?? undefined) : null;
  const activeSessionText = activeSession
    ? [
        displayProjectName(activeSession.projectName, activeSession.projectAlias),
        activeSession.displayName,
        formatSessionState(activeSession, language),
        `${LL.common.configured()} ${formatModelReasoning(
          resolvedModelState?.configuredModel ?? null,
          resolvedModelState?.configuredReasoningEffort ?? null,
          language
        )}`,
        `${LL.common.effective()} ${formatModelReasoning(
          resolvedModelState?.effectiveModel ?? null,
          resolvedModelState?.effectiveReasoningEffort ?? null,
          language
        )}`,
        formatLastTurnSummary(activeSession, language)
      ]
        .filter((value): value is string => Boolean(value))
        .join(" / ")
    : LL.common.none();

  const lines = [
    formatHtmlHeading(LL.status.title()),
    formatHtmlField(LL.status.bridgeState(), snapshot.state),
    formatHtmlField(LL.status.platformConnectivity(), snapshot.details.packState === "pack_unhealthy" ? LL.common.unhealthy() : LL.common.ok()),
    formatHtmlField(LL.status.setupComplete(), snapshot.details.setupState === "incomplete" ? LL.common.no() : LL.common.yes()),
    formatHtmlField(
      LL.status.codexAvailable(),
      snapshot.details.codexAuthenticated && snapshot.details.appServerAvailable ? LL.common.ok() : LL.common.unhealthy()
    ),
    formatHtmlField(LL.status.currentSession(), activeSessionText),
    formatHtmlField(LL.status.lastChecked(), snapshot.checkedAt),
    formatHtmlField(LL.status.issues(), issueText)
  ];

  if (runtimeStatusText) {
    lines.push("", runtimeStatusText);
  }

  return lines.join("\n");
}

export function buildWhereText(session: SessionRow | null, modelState?: SessionModelDisplayState, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  if (!session) {
    return LL.where.noActiveSession();
  }

  const state = resolveModelDisplayState(session, modelState);
  const lines = [
    formatHtmlHeading(LL.where.title()),
    formatHtmlField(LL.where.sessionName(), session.displayName),
    formatHtmlField(LL.where.project(), displayProjectName(session.projectName, session.projectAlias)),
    formatHtmlField(LL.where.path(), session.projectPath),
    formatHtmlField(LL.where.state(), formatSessionState(session, language)),
    formatHtmlField(LL.where.modelConfigured(), formatModelReasoning(state.configuredModel, state.configuredReasoningEffort, language)),
    formatHtmlField(LL.where.modelEffective(), formatModelReasoning(state.effectiveModel, state.effectiveReasoningEffort, language)),
    formatHtmlField("plan mode:", session.planMode ? "on" : "off")
  ];

  lines.push(formatHtmlField(LL.where.bridgeSessionId(), session.sessionId));
  lines.push(formatHtmlField(LL.where.codexThreadId(), session.threadId ?? LL.where.threadNotCreated()));
  lines.push(formatHtmlField(LL.where.lastTurnId(), session.lastTurnId ?? LL.common.unavailable()));
  const lastTurnSummary = formatLastTurnSummary(session, language);
  if (lastTurnSummary) {
    lines.push(formatHtmlField(LL.where.lastResult(), lastTurnSummary));
  }

  return lines.join("\n");
}

export function buildCurrentSessionCardText(
  session: SessionRow,
  language: UiLanguage,
  modelState?: SessionModelDisplayState
): string {
  const projectName = displayProjectName(session.projectName, session.projectAlias);
  const state = resolveModelDisplayState(session, modelState);
  return [
    `${escapeHtml(projectName)} / ${escapeHtml(session.displayName)}`,
    `${escapeHtml(formatSessionStateForCard(session, language))} · ${escapeHtml(formatSessionModelReasoningConfigForCard(state, language))}`
  ].join("\n");
}

export function buildSessionsText(options: {
  sessions: SessionRow[];
  activeSessionId: string | null;
  archived?: boolean;
  language?: UiLanguage;
}): string {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const title: string = options.archived ? LL.sessions.archivedTitle() : LL.sessions.recentTitle();
  if (options.sessions.length === 0) {
    return `${title}\n${LL.sessions.empty()}`;
  }

  const lines: string[] = [title];
  options.sessions.forEach((session, index) => {
    const marker = !options.archived && session.sessionId === options.activeSessionId ? LL.sessions.currentMarker() : "";
    const parts = [
      `${marker}${session.displayName}`,
      displayProjectName(session.projectName, session.projectAlias),
      formatSessionState(session, language),
      formatLastTurnSummary(session, language),
      formatRelativeTime(session.lastUsedAt, language)
    ].filter((value): value is string => Boolean(value));

    lines.push(`${index + 1}. ${parts.join(" | ")}`);
  });

  return lines.join("\n");
}

export function buildProjectSelectedText(projectName: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return formatHtmlField(LL.projects.currentProject(), projectName);
}

export function buildSessionCreatedText(sessionName: string, projectPath: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return [
    formatHtmlHeading(LL.projects.newSessionCreated()),
    formatHtmlField(LL.where.sessionName(), sessionName),
    formatHtmlField(LL.where.path(), projectPath)
  ].join("\n");
}

export function buildSessionSwitchedText(sessionName: string, projectName: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return buildSessionProjectContextBlock(LL.projects.sessionSwitched(), sessionName, projectName, language);
}

export function buildSessionResumedText(sessionName: string, projectName: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return buildSessionProjectContextBlock(LL.projects.codexSessionResumed(), sessionName, projectName, language);
}

export function buildResumeThreadListText(threads: Array<{
  name?: string | null;
  cwd: string;
  preview?: string;
  updatedAt: number | string;
}>, options: {
  page?: number;
  pageSize?: number;
  hasNext?: boolean;
  includeAll?: boolean;
  language?: UiLanguage;
} = {}): string {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.max(1, Math.trunc(options.pageSize ?? 10));
  const includeAll = options.includeAll ?? false;
  const allFlag = includeAll ? "all " : "";
  if (threads.length === 0) {
    const title = language === "en"
      ? `${LL.sessions.resumeTitle()} (${LL.model.pageLabel()} ${page})`
      : `${LL.sessions.resumeTitle()}（第 ${page} ${LL.model.pageLabel()}）`;
    const nav = page > 1 ? `\n${LL.common.previousPage()}：/resume ${allFlag}page ${page - 1}` : "";
    return escapeHtml(`${title}\n${LL.sessions.resumeEmpty()}${nav}`);
  }

  const title = language === "en"
    ? `${LL.sessions.resumeTitle()} (${LL.model.pageLabel()} ${page})`
    : `${LL.sessions.resumeTitle()}（第 ${page} ${LL.model.pageLabel()}）`;
  const lines = [
    title,
    language === "en"
      ? `Send /resume ${allFlag}<number> to resume.`
      : `发送 /resume ${allFlag}<序号> 恢复。`
  ];
  threads.forEach((thread, index) => {
    const ordinal = (page - 1) * pageSize + index + 1;
    const projectName = basename(thread.cwd);
    const title = thread.name?.trim() || thread.preview?.trim() || projectName;
    const preview = thread.preview?.trim() && thread.preview.trim() !== title ? ` | ${thread.preview.trim()}` : "";
    const updatedAt = formatResumeThreadRelativeTime(thread.updatedAt, language);
    lines.push(`${ordinal}. ${title} | ${projectName}${preview}${updatedAt ? ` | ${updatedAt}` : ""}`);
  });
  if (page > 1) {
    lines.push(`${LL.common.previousPage()}：/resume ${allFlag}page ${page - 1}`);
  }
  if (options.hasNext) {
    lines.push(`${LL.common.nextPage()}：/resume ${allFlag}page ${page + 1}`);
  }

  return escapeHtml(lines.join("\n"));
}

export function buildResumeThreadListMessage(threads: Array<{
  name?: string | null;
  cwd: string;
  preview?: string;
  updatedAt: number | string;
}>, options: {
  page?: number;
  pageSize?: number;
  hasNext?: boolean;
  includeAll?: boolean;
  language?: UiLanguage;
} = {}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.max(1, Math.trunc(options.pageSize ?? 10));
  const includeAll = options.includeAll ?? false;
  const selectionButtons = threads.map((thread, index) => ({
    text: String((page - 1) * pageSize + index + 1),
    callback_data: encodeResumePickCallback(includeAll, page, index)
  }));
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  rows.push(...chunkButtons(selectionButtons, 5));

  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (page > 1) {
    navigation.push({ text: LL.common.previousPage(), callback_data: encodeResumePageCallback(includeAll, page - 1) });
  }
  if (options.hasNext) {
    navigation.push({ text: LL.common.nextPage(), callback_data: encodeResumePageCallback(includeAll, page + 1) });
  }
  if (navigation.length > 0) {
    rows.push(navigation);
  }
  rows.push([{ text: LL.common.close(), callback_data: encodeResumeCloseCallback() }]);

  return {
    text: buildResumeThreadListText(threads, options),
    replyMarkup: {
      inline_keyboard: rows
    }
  };
}

function formatResumeThreadRelativeTime(value: number | string, language: UiLanguage = "zh"): string | null {
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return formatResumeThreadRelativeTime(numeric, language);
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? formatRelativeTime(new Date(parsed).toISOString(), language) : null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  const milliseconds = value < 100_000_000_000 ? value * 1000 : value;
  return formatRelativeTime(new Date(milliseconds).toISOString(), language);
}

export function buildArchiveSuccessText(
  session: {
    displayName: string;
    projectName: string;
    projectAlias?: string | null;
  },
  nextActiveSession?: {
    displayName: string;
    projectName: string;
    projectAlias?: string | null;
  } | null,
  language: UiLanguage = "zh"
): string {
  const LL = getTranslator(language);
  const lines = [
    formatHtmlHeading(LL.projects.archivedSession()),
    formatHtmlField(LL.where.sessionName(), session.displayName),
    formatHtmlField(LL.where.project(), displayProjectName(session.projectName, session.projectAlias ?? null))
  ];
  if (nextActiveSession) {
    lines.push(formatHtmlField(LL.status.currentSession(), nextActiveSession.displayName));
    lines.push(
      formatHtmlField(
        LL.projects.currentProject(),
        displayProjectName(nextActiveSession.projectName, nextActiveSession.projectAlias ?? null)
      )
    );
  } else {
    lines.push(LL.projects.noActiveSession());
  }

  return lines.join("\n");
}

export function buildArchiveAllSuccessText(options: {
  archivedCount: number;
  skippedRunningCount: number;
  failedCount: number;
  nextActiveSession?: {
    displayName: string;
    projectName: string;
    projectAlias?: string | null;
  } | null;
  language?: UiLanguage;
}): string {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const lines = [
    formatHtmlHeading(LL.sessions.batchArchivedTitle()),
    formatHtmlField(LL.projects.batchArchived(), `${options.archivedCount} ${LL.model.countUnit()}`)
  ];

  if (options.skippedRunningCount > 0) {
    lines.push(formatHtmlField(LL.projects.batchSkippedRunning(), `${options.skippedRunningCount} ${LL.model.countUnit()}`));
  }

  if (options.failedCount > 0) {
    lines.push(formatHtmlField(LL.projects.batchFailed(), `${options.failedCount} ${LL.model.countUnit()}`));
  }

  if (options.nextActiveSession) {
    lines.push(formatHtmlField(LL.status.currentSession(), options.nextActiveSession.displayName));
    lines.push(
      formatHtmlField(
        LL.projects.currentProject(),
        displayProjectName(options.nextActiveSession.projectName, options.nextActiveSession.projectAlias ?? null)
      )
    );
  } else {
    lines.push(LL.projects.noActiveSession());
  }

  return lines.join("\n");
}

export function buildUnarchiveSuccessText(sessionName: string, projectName: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return buildSessionProjectContextBlock(LL.projects.sessionRestored(), sessionName, projectName, language);
}

export function buildSessionRenamedText(name: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return formatHtmlField(LL.projects.sessionRenamed(), name);
}

export function buildProjectAliasRenamedText(name: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return formatHtmlField(LL.projects.projectAliasRenamed(), name);
}

export function buildProjectAliasClearedText(projectName: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return formatHtmlField(LL.projects.projectAliasCleared(), projectName);
}

export function buildProjectPinnedText(projectName: string, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  return formatHtmlField(LL.projects.projectFavorited(), projectName);
}

export function buildModelPickerClosedText(session: SessionRow, modelState?: SessionModelDisplayState, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  const state = resolveModelDisplayState(session, modelState);
  return [
    formatHtmlHeading(LL.model.modelPickerClosed()),
    formatHtmlField(`${LL.common.configured()}：`, formatModelReasoning(state.configuredModel, state.configuredReasoningEffort, language)),
    formatHtmlField(`${LL.common.effective()}：`, formatModelReasoning(state.effectiveModel, state.effectiveReasoningEffort, language))
  ].join("\n");
}

export function buildRenameTargetPicker(options: {
  sessionId: string;
  projectName: string;
  hasProjectAlias: boolean;
  language?: UiLanguage;
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
    [
      { text: LL.projects.renameSession(), callback_data: encodeRenameSessionCallback(options.sessionId) },
      { text: LL.projects.setProjectAlias(), callback_data: encodeRenameProjectCallback(options.sessionId) }
    ]
  ];

  if (options.hasProjectAlias) {
    rows.push([{ text: LL.projects.clearProjectAlias(), callback_data: encodeRenameProjectClearCallback(options.sessionId) }]);
  }

  return {
    text: [
      LL.model.editWhichName(),
      formatHtmlField(LL.projects.currentProject(), options.projectName)
    ].join("\n"),
    replyMarkup: { inline_keyboard: rows }
  };
}

export function buildUnsupportedCommandText(language: UiLanguage = "zh"): string {
  return language === "en" ? "This command is not yet available." : "这个命令还没开放。";
}

function formatSessionState(session: SessionRow, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  switch (session.status) {
    case "running":
      return LL.sessionState.running();
    case "interrupted":
      return LL.sessionState.interrupted();
    case "failed":
      return session.failureReason
        ? `${LL.sessionState.failed()}${language === "en" ? ` (${formatSessionFailureReason(session.failureReason, language)})` : `（${formatSessionFailureReason(session.failureReason, language)}）`}`
        : LL.sessionState.failed();
    case "idle":
    default:
      return LL.sessionState.idle();
  }
}

function formatSessionStateForCard(session: SessionRow, language: UiLanguage): string {
  const state = formatSessionState(session, language);
  return language === "en" ? state.charAt(0).toUpperCase() + state.slice(1) : state;
}

function formatReasoningEffortLabelForCard(effort: ReasoningEffort, language: UiLanguage): string {
  return formatReasoningEffortLabel(effort, language);
}

function formatSessionModelReasoningConfigForCard(state: SessionModelDisplayState, language: UiLanguage): string {
  const LL = getTranslator(language);
  return `${LL.common.configured()} ${formatModelReasoning(state.configuredModel, state.configuredReasoningEffort, language)} / ${LL.common.effective()} ${formatModelReasoning(state.effectiveModel, state.effectiveReasoningEffort, language)}`;
}

function formatSessionFailureReason(reason: SessionRow["failureReason"], language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  switch (reason) {
    case "bridge_restart":
      return LL.sessionState.failureBridgeRestart();
    case "app_server_lost":
      return LL.sessionState.failureAppServerLost();
    case "turn_failed":
      return LL.sessionState.failureTurnFailed();
    case "unknown":
    default:
      return LL.sessionState.failureUnknown();
  }
}

function formatLastTurnSummary(session: SessionRow, language: UiLanguage = "zh"): string | null {
  const LL = getTranslator(language);
  if (session.status === "running" || session.status === "failed" || session.status === "interrupted") {
    return null;
  }

  switch (session.lastTurnStatus) {
    case "completed":
      return LL.sessionState.lastCompleted();
    case "interrupted":
      return LL.sessionState.lastInterrupted();
    case "failed":
      return session.failureReason
        ? `${LL.sessionState.lastFailed()}${language === "en" ? ` (${formatSessionFailureReason(session.failureReason, language)})` : `（${formatSessionFailureReason(session.failureReason, language)}）`}`
        : LL.sessionState.lastFailed();
    default:
      return null;
  }
}

function buildDefaultModelButtonLabel(state: SessionModelDisplayState, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  const marker = state.configuredModel === null && state.configuredReasoningEffort === null ? ` [${LL.model.configuredMarker()}]` : "";
  return `${LL.model.clearOverride()}${marker}`;
}

function buildModelButtonLabel(model: ModelPickerOption, state: SessionModelDisplayState, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  const markers: string[] = [];
  if (state.configuredModel === model.id) {
    markers.push(LL.model.configuredMarker());
  }
  if (state.effectiveModel === model.id) {
    markers.push(LL.model.effectiveMarker());
  }
  const markerText = markers.length > 0 ? ` [${markers.join("/")}]` : "";
  return `${model.displayName}${markerText}`;
}

function buildDefaultEffortButtonLabel(
  defaultReasoningEffort: ReasoningEffort,
  state: SessionModelDisplayState,
  isConfiguredModel: boolean,
  isEffectiveModel: boolean,
  language: UiLanguage = "zh"
): string {
  const LL = getTranslator(language);
  const markers: string[] = [];
  if (isConfiguredModel && state.configuredReasoningEffort === null) {
    markers.push(LL.model.configuredMarker());
  }
  if (isEffectiveModel && state.effectiveReasoningEffort === null) {
    markers.push(LL.model.effectiveMarker());
  }
  const markerText = markers.length > 0 ? ` [${markers.join("/")}]` : "";
  return `${LL.common.default()}（${formatReasoningEffortLabel(defaultReasoningEffort, language)}）${markerText}`;
}

function buildReasoningEffortButtonLabel(
  effort: ReasoningEffort,
  state: SessionModelDisplayState,
  isConfiguredModel: boolean,
  isEffectiveModel: boolean,
  language: UiLanguage = "zh"
): string {
  const LL = getTranslator(language);
  const markers: string[] = [];
  if (isConfiguredModel && state.configuredReasoningEffort === effort) {
    markers.push(LL.model.configuredMarker());
  }
  if (isEffectiveModel && state.effectiveReasoningEffort === effort) {
    markers.push(LL.model.effectiveMarker());
  }
  const markerText = markers.length > 0 ? ` [${markers.join("/")}]` : "";
  return `${formatReasoningEffortLabel(effort, language)}${markerText}`;
}

function resolveModelDisplayState(
  session: SessionRow,
  state?: SessionModelDisplayState
): SessionModelDisplayState {
  if (state) {
    return state;
  }

  return {
    configuredModel: session.selectedModel ?? null,
    configuredReasoningEffort: session.selectedReasoningEffort ?? null,
    effectiveModel: session.selectedModel ?? null,
    effectiveReasoningEffort: session.selectedReasoningEffort ?? null
  };
}

function formatModelReasoning(model: string | null, effort: ReasoningEffort | null, language: UiLanguage = "zh"): string {
  const LL = getTranslator(language);
  const modelLabel = model ?? LL.common.defaultModel();
  const effortLabel = effort ? formatReasoningEffortLabel(effort, language) : LL.common.default();
  return `${modelLabel} + ${effortLabel}`;
}

function formatModelReasoningForCard(model: string | null, effort: ReasoningEffort | null, language: UiLanguage): string {
  const LL = getTranslator(language);
  const modelLabel = model ?? LL.common.defaultModel();
  const effortLabel = effort ? formatReasoningEffortLabel(effort, language) : LL.common.default();
  return `${modelLabel} + ${effortLabel}`;
}
