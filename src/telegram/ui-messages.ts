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

function buildSessionProjectContextBlock(title: string, sessionName: string, projectName: string): string {
  return [
    formatHtmlHeading(title),
    formatHtmlField("会话名：", sessionName),
    formatHtmlField("项目：", projectName)
  ].join("\n");
}

function buildProjectBadgeLabels(candidate: ProjectCandidate): string[] {
  const labels: string[] = [];
  if (candidate.group !== "recent" && candidate.isRecent) {
    labels.push("最近");
  }
  if (candidate.group !== "discovered" && candidate.fromScan) {
    labels.push("本地发现");
  }
  if (candidate.hasExistingSession) {
    labels.push("有历史会话");
  }

  return labels;
}

export function buildProjectPickerMessage(picker: ProjectPickerResult): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  const visibleCandidates = picker.groups.flatMap((group) => group.candidates);
  const candidateButtons = visibleCandidates.map((candidate, index) => ({
    text: String(index + 1),
    callback_data: encodePickCallback(candidate.projectKey)
  }));

  rows.push(...chunkButtons(candidateButtons, 5));
  rows.push([
    { text: "浏览目录", callback_data: encodeNewBrowseOpenCallback() },
    { text: "手动输入路径", callback_data: encodePathManualCallback() }
  ]);

  const lines = [picker.title];
  for (const noticeLine of picker.noticeLines) {
    lines.push("", noticeLine);
  }
  if (picker.emptyText) {
    lines.push("", picker.emptyText);
  }

  let itemIndex = 1;
  for (const group of picker.groups) {
    lines.push("", group.title);
    for (const candidate of group.candidates) {
      const badges = buildProjectBadgeLabels(candidate);
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

export function buildProjectBrowseRootPickerMessage(options: {
  roots: Array<{ index: number; label: string; pathLabel: string }>;
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = options.roots.map((root) => [{
    text: `${root.index + 1}`,
    callback_data: encodeNewBrowseRootCallback(root.index)
  }]);
  rows.push([{ text: "返回项目列表", callback_data: encodeNewBrowseBackCallback() }]);

  const lines = ["选择要浏览的根目录"];
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

export function buildManualPathPrompt(): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  return {
    text: "请发送要开始会话的目录路径，例如：/home/ubuntu/Repo/openclaw\n发送 /cancel 返回项目列表。",
    replyMarkup: {
      inline_keyboard: [[{ text: "返回项目列表", callback_data: encodePathBackCallback() }]]
    }
  };
}

export function buildManualPathConfirmMessage(candidate: ProjectCandidate): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  return {
    text: [
      "要在这个目录中新建会话吗？",
      formatHtmlField("项目：", candidate.displayName),
      formatHtmlField("路径：", candidate.projectPath)
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{ text: "确认新建会话", callback_data: encodePathConfirmCallback(candidate.projectKey) }],
        [{ text: "返回项目列表", callback_data: encodePathBackCallback() }]
      ]
    }
  };
}

export function buildNoNewProjectsMessage(): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  return {
    text: "这个入口已下线。请使用浏览目录或手动输入路径。",
    replyMarkup: {
      inline_keyboard: [
        [{ text: "浏览目录", callback_data: encodeNewBrowseOpenCallback() }],
        [{ text: "手动输入路径", callback_data: encodePathManualCallback() }],
        [{ text: "返回项目列表", callback_data: encodePathBackCallback() }]
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
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const state = resolveModelDisplayState(options.session, options.modelState);
  const totalPages = Math.max(1, Math.ceil(options.models.length / MODEL_PAGE_SIZE));
  const safePage = Math.min(Math.max(options.page, 0), totalPages - 1);
  const pageModels = options.models.slice(safePage * MODEL_PAGE_SIZE, (safePage + 1) * MODEL_PAGE_SIZE);
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
    [{ text: buildDefaultModelButtonLabel(state), callback_data: encodeModelDefaultCallback(options.session.sessionId) }],
    ...pageModels.map((model, index) => [{
      text: buildModelButtonLabel(model, state),
      callback_data: encodeModelPickCallback(options.session.sessionId, safePage * MODEL_PAGE_SIZE + index)
    }])
  ];
  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (safePage > 0) {
    navigation.push({ text: "上一页", callback_data: encodeModelPageCallback(options.session.sessionId, safePage - 1) });
  }
  if (safePage + 1 < totalPages) {
    navigation.push({ text: "下一页", callback_data: encodeModelPageCallback(options.session.sessionId, safePage + 1) });
  }
  if (navigation.length > 0) {
    rows.push(navigation);
  }
  rows.push([{ text: "关闭", callback_data: encodeModelCloseCallback(options.session.sessionId) }]);

  return {
    text: [
      "选择模型",
      `当前配置：${formatModelReasoning(state.configuredModel, state.configuredReasoningEffort)}`,
      `当前生效：${formatModelReasoning(state.effectiveModel, state.effectiveReasoningEffort)}`,
      `第 ${safePage + 1}/${totalPages} 页`,
      "先选模型，再按该模型支持情况选择思考强度。"
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
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const state = resolveModelDisplayState(options.session, options.modelState);
  const isConfiguredModel = state.configuredModel === options.model.id;
  const isEffectiveModel = state.effectiveModel === options.model.id;
  const effortButtons = options.model.supportedReasoningEfforts.map((option) => ({
    text: buildReasoningEffortButtonLabel(option.reasoningEffort, state, isConfiguredModel, isEffectiveModel),
    callback_data: encodeModelEffortCallback(options.session.sessionId, options.modelIndex, option.reasoningEffort)
  }));
  const rows = [
    [{
      text: buildDefaultEffortButtonLabel(options.model.defaultReasoningEffort, state, isConfiguredModel, isEffectiveModel),
      callback_data: encodeModelEffortCallback(options.session.sessionId, options.modelIndex, null)
    }],
    ...chunkButtons(effortButtons, 2),
    [{ text: "关闭", callback_data: encodeModelCloseCallback(options.session.sessionId) }]
  ];

  return {
    text: [
      "选择思考强度",
      `模型：${options.model.id}`,
      `当前配置：${formatModelReasoning(state.configuredModel, state.configuredReasoningEffort)}`,
      `当前生效：${formatModelReasoning(state.effectiveModel, state.effectiveReasoningEffort)}`,
      "仅展示这个模型实际支持的档位。"
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
    const marker = !options.archived && session.sessionId === options.activeSessionId ? "[当前] " : "";
    const parts = [
      `${marker}${session.displayName}`,
      displayProjectName(session.projectName, session.projectAlias),
      formatSessionState(session, language),
      formatLastTurnSummary(session, language),
      formatRelativeTime(session.lastUsedAt)
    ].filter((value): value is string => Boolean(value));

    lines.push(`${index + 1}. ${parts.join(" | ")}`);
  });

  return lines.join("\n");
}

export function buildProjectSelectedText(projectName: string): string {
  return formatHtmlField("当前项目：", projectName);
}

export function buildSessionCreatedText(sessionName: string, projectPath: string): string {
  return [
    formatHtmlHeading("已新建会话"),
    formatHtmlField("会话名：", sessionName),
    formatHtmlField("路径：", projectPath)
  ].join("\n");
}

export function buildSessionSwitchedText(sessionName: string, projectName: string): string {
  return buildSessionProjectContextBlock("已切换会话", sessionName, projectName);
}

export function buildSessionResumedText(sessionName: string, projectName: string): string {
  return buildSessionProjectContextBlock("已恢复 Codex 会话", sessionName, projectName);
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
} = {}): string {
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.max(1, Math.trunc(options.pageSize ?? 10));
  const includeAll = options.includeAll ?? false;
  if (threads.length === 0) {
    return escapeHtml(`可恢复的 Codex 会话（第 ${page} 页）\n暂无会话。${page > 1 ? `\n上一页：/resume ${includeAll ? "all " : ""}page ${page - 1}` : ""}`);
  }

  const lines = [`可恢复的 Codex 会话（第 ${page} 页）`, `发送 /resume ${includeAll ? "all " : ""}<序号> 恢复。`];
  threads.forEach((thread, index) => {
    const ordinal = (page - 1) * pageSize + index + 1;
    const projectName = basename(thread.cwd);
    const title = thread.name?.trim() || thread.preview?.trim() || projectName;
    const preview = thread.preview?.trim() && thread.preview.trim() !== title ? ` | ${thread.preview.trim()}` : "";
    const updatedAt = formatResumeThreadRelativeTime(thread.updatedAt);
    lines.push(`${ordinal}. ${title} | ${projectName}${preview}${updatedAt ? ` | ${updatedAt}` : ""}`);
  });
  if (page > 1) {
    lines.push(`上一页：/resume ${includeAll ? "all " : ""}page ${page - 1}`);
  }
  if (options.hasNext) {
    lines.push(`下一页：/resume ${includeAll ? "all " : ""}page ${page + 1}`);
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
} = {}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
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
    navigation.push({ text: "上一页", callback_data: encodeResumePageCallback(includeAll, page - 1) });
  }
  if (options.hasNext) {
    navigation.push({ text: "下一页", callback_data: encodeResumePageCallback(includeAll, page + 1) });
  }
  if (navigation.length > 0) {
    rows.push(navigation);
  }
  rows.push([{ text: "关闭", callback_data: encodeResumeCloseCallback() }]);

  return {
    text: buildResumeThreadListText(threads, options),
    replyMarkup: {
      inline_keyboard: rows
    }
  };
}

function formatResumeThreadRelativeTime(value: number | string): string | null {
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return formatResumeThreadRelativeTime(numeric);
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? formatRelativeTime(new Date(parsed).toISOString()) : null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  const milliseconds = value < 100_000_000_000 ? value * 1000 : value;
  return formatRelativeTime(new Date(milliseconds).toISOString());
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
  } | null
): string {
  const lines = [
    formatHtmlHeading("已归档会话"),
    formatHtmlField("会话名：", session.displayName),
    formatHtmlField("项目：", displayProjectName(session.projectName, session.projectAlias ?? null))
  ];
  if (nextActiveSession) {
    lines.push(formatHtmlField("当前会话：", nextActiveSession.displayName));
    lines.push(
      formatHtmlField(
        "当前项目：",
        displayProjectName(nextActiveSession.projectName, nextActiveSession.projectAlias ?? null)
      )
    );
  } else {
    lines.push("当前没有活动会话，请发送 /new 选择项目。");
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
}): string {
  const lines = [
    formatHtmlHeading("已批量归档会话"),
    formatHtmlField("已归档：", `${options.archivedCount} 个`)
  ];

  if (options.skippedRunningCount > 0) {
    lines.push(formatHtmlField("已跳过运行中：", `${options.skippedRunningCount} 个`));
  }

  if (options.failedCount > 0) {
    lines.push(formatHtmlField("失败：", `${options.failedCount} 个`));
  }

  if (options.nextActiveSession) {
    lines.push(formatHtmlField("当前会话：", options.nextActiveSession.displayName));
    lines.push(
      formatHtmlField(
        "当前项目：",
        displayProjectName(options.nextActiveSession.projectName, options.nextActiveSession.projectAlias ?? null)
      )
    );
  } else {
    lines.push("当前没有活动会话，请发送 /new 选择项目。");
  }

  return lines.join("\n");
}

export function buildUnarchiveSuccessText(sessionName: string, projectName: string): string {
  return buildSessionProjectContextBlock("已恢复会话", sessionName, projectName);
}

export function buildSessionRenamedText(name: string): string {
  return formatHtmlField("当前会话已重命名为：", name);
}

export function buildProjectAliasRenamedText(name: string): string {
  return formatHtmlField("当前项目别名已更新为：", name);
}

export function buildProjectAliasClearedText(projectName: string): string {
  return formatHtmlField("已清除项目别名：", projectName);
}

export function buildProjectPinnedText(projectName: string): string {
  return formatHtmlField("已收藏项目：", projectName);
}

export function buildModelPickerClosedText(session: SessionRow, modelState?: SessionModelDisplayState): string {
  const state = resolveModelDisplayState(session, modelState);
  return [
    formatHtmlHeading("已关闭模型选择"),
    formatHtmlField("当前配置：", formatModelReasoning(state.configuredModel, state.configuredReasoningEffort)),
    formatHtmlField("当前生效：", formatModelReasoning(state.effectiveModel, state.effectiveReasoningEffort))
  ].join("\n");
}

export function buildRenameTargetPicker(options: {
  sessionId: string;
  projectName: string;
  hasProjectAlias: boolean;
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
    [
      { text: "重命名会话", callback_data: encodeRenameSessionCallback(options.sessionId) },
      { text: "设置项目别名", callback_data: encodeRenameProjectCallback(options.sessionId) }
    ]
  ];

  if (options.hasProjectAlias) {
    rows.push([{ text: "清除项目别名", callback_data: encodeRenameProjectClearCallback(options.sessionId) }]);
  }

  return {
    text: [
      "要修改哪个名称？",
      formatHtmlField("当前项目：", options.projectName)
    ].join("\n"),
    replyMarkup: { inline_keyboard: rows }
  };
}

export function buildUnsupportedCommandText(): string {
  return "这个命令还没开放。";
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
  if (language !== "en") {
    return formatSessionState(session);
  }

  switch (session.status) {
    case "running":
      return "Running";
    case "interrupted":
      return "Interrupted";
    case "failed":
      return "Failed";
    case "idle":
    default:
      return "Idle";
  }
}

function formatReasoningEffortLabelForCard(effort: ReasoningEffort, language: UiLanguage): string {
  if (language !== "en") {
    return formatReasoningEffortLabel(effort);
  }

  switch (effort) {
    case "none":
      return "off";
    case "minimal":
      return "minimal";
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "xhigh":
      return "very high";
  }
}

function formatSessionModelReasoningConfigForCard(state: SessionModelDisplayState, language: UiLanguage): string {
  if (language !== "en") {
    return `配置 ${formatModelReasoning(state.configuredModel, state.configuredReasoningEffort)} / 生效 ${formatModelReasoning(state.effectiveModel, state.effectiveReasoningEffort)}`;
  }

  return `configured ${formatModelReasoningForCard(state.configuredModel, state.configuredReasoningEffort, language)} / effective ${formatModelReasoningForCard(state.effectiveModel, state.effectiveReasoningEffort, language)}`;
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

function buildDefaultModelButtonLabel(state: SessionModelDisplayState): string {
  const marker = state.configuredModel === null && state.configuredReasoningEffort === null ? " [已配置]" : "";
  return `清除模型/强度覆盖${marker}`;
}

function buildModelButtonLabel(model: ModelPickerOption, state: SessionModelDisplayState): string {
  const markers: string[] = [];
  if (state.configuredModel === model.id) {
    markers.push("已配置");
  }
  if (state.effectiveModel === model.id) {
    markers.push("生效");
  }
  const markerText = markers.length > 0 ? ` [${markers.join("/")}]` : "";
  return `${model.displayName}${markerText}`;
}

function buildDefaultEffortButtonLabel(
  defaultReasoningEffort: ReasoningEffort,
  state: SessionModelDisplayState,
  isConfiguredModel: boolean,
  isEffectiveModel: boolean
): string {
  const markers: string[] = [];
  if (isConfiguredModel && state.configuredReasoningEffort === null) {
    markers.push("已配置");
  }
  if (isEffectiveModel && state.effectiveReasoningEffort === null) {
    markers.push("生效");
  }
  const markerText = markers.length > 0 ? ` [${markers.join("/")}]` : "";
  return `默认（${formatReasoningEffortLabel(defaultReasoningEffort)}）${markerText}`;
}

function buildReasoningEffortButtonLabel(
  effort: ReasoningEffort,
  state: SessionModelDisplayState,
  isConfiguredModel: boolean,
  isEffectiveModel: boolean
): string {
  const markers: string[] = [];
  if (isConfiguredModel && state.configuredReasoningEffort === effort) {
    markers.push("已配置");
  }
  if (isEffectiveModel && state.effectiveReasoningEffort === effort) {
    markers.push("生效");
  }
  const markerText = markers.length > 0 ? ` [${markers.join("/")}]` : "";
  return `${formatReasoningEffortLabel(effort)}${markerText}`;
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
  const effortLabel = effort ? formatReasoningEffortLabelForCard(effort, language) : LL.common.default();
  return `${modelLabel} + ${effortLabel}`;
}

function formatModelReasoningForCard(model: string | null, effort: ReasoningEffort | null, language: UiLanguage): string {
  const modelLabel = model ?? (language === "en" ? "Default model" : "默认模型");
  const effortLabel = effort
    ? formatReasoningEffortLabelForCard(effort, language)
    : language === "en" ? "default" : "默认";
  return `${modelLabel} + ${effortLabel}`;
}
