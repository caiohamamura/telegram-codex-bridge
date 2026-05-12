import type { UiLanguage } from "../types.js";
import { getTranslator } from "../i18n/index.js";
import type { TelegramInlineKeyboardMarkup } from "./api.js";
import {
  encodeBrowseBackCallback,
  encodeBrowseCloseCallback,
  encodeBrowseOpenCallback,
  encodeBrowsePageCallback,
  encodeBrowseRefreshCallback,
  encodeBrowseRootCallback,
  encodeBrowseUseCurrentDirCallback,
  encodeBrowseUseCurrentDirCancelCallback,
  encodeBrowseUseCurrentDirConfirmCallback,
  encodeBrowseUpCallback
} from "./ui-callbacks.js";
import { escapeHtml, formatHtmlField, formatHtmlHeading } from "./ui-shared.js";

export interface ProjectBrowserDirectoryEntryView {
  index: number;
  name: string;
  kind: "directory" | "file" | "symlink";
  sizeLabel: string | null;
}

function entryListLabel(entry: ProjectBrowserDirectoryEntryView): string {
  switch (entry.kind) {
    case "directory":
      return `${entry.name}/`;
    case "symlink":
      return `${entry.name} @`;
    case "file":
      return entry.name;
  }
}

function entryButtonLabel(entry: ProjectBrowserDirectoryEntryView): string {
  return entry.kind === "directory" ? `${entry.name}/` : entry.name;
}

export function buildProjectBrowserDirectoryMessage(options: {
  language?: UiLanguage;
  token: string;
  projectName: string;
  relativePathLabel: string;
  page: number;
  totalPages: number;
  entries: ProjectBrowserDirectoryEntryView[];
  canGoUp: boolean;
  allowUseCurrentDirectory?: boolean;
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = options.entries.map((entry) => [{
    text: entryButtonLabel(entry),
    callback_data: encodeBrowseOpenCallback(options.token, entry.index)
  }]);

  const pagerRow: Array<{ text: string; callback_data: string }> = [];
  if (options.page > 0) {
    pagerRow.push({
      text: LL.common.previousPage(),
      callback_data: encodeBrowsePageCallback(options.token, options.page - 1)
    });
  }
  if (options.page + 1 < options.totalPages) {
    pagerRow.push({
      text: LL.common.nextPage(),
      callback_data: encodeBrowsePageCallback(options.token, options.page + 1)
    });
  }
  if (pagerRow.length > 0) {
    rows.push(pagerRow);
  }

  if (options.canGoUp) {
    rows.push([
      { text: LL.browser.up(), callback_data: encodeBrowseUpCallback(options.token) },
      { text: LL.browser.backToRoot(), callback_data: encodeBrowseRootCallback(options.token) }
    ]);
  } else {
    rows.push([{ text: LL.browser.backToRoot(), callback_data: encodeBrowseRootCallback(options.token) }]);
  }

  if (options.allowUseCurrentDirectory) {
    rows.push([{ text: LL.browser.useCurrentDirectory(), callback_data: encodeBrowseUseCurrentDirCallback(options.token) }]);
  }

  rows.push([
    { text: LL.browser.refresh(), callback_data: encodeBrowseRefreshCallback(options.token) },
    { text: LL.common.close(), callback_data: encodeBrowseCloseCallback(options.token) }
  ]);

  const lines = [
    formatHtmlHeading(LL.browser.title()),
    formatHtmlField(LL.browser.project(), options.projectName),
    formatHtmlField(LL.browser.location(), options.relativePathLabel),
    formatHtmlField(LL.browser.page(), `${options.page + 1}/${options.totalPages}`),
    formatHtmlField(LL.browser.mode(), LL.browser.readonly())
  ];

  if (options.entries.length === 0) {
    lines.push("", LL.browser.empty());
  } else {
    for (const [index, entry] of options.entries.entries()) {
      const details = entry.sizeLabel && entry.kind === "file" ? ` · ${entry.sizeLabel}` : "";
      lines.push("", `${index + 1}. ${escapeHtml(entryListLabel(entry))}${escapeHtml(details)}`);
    }
  }

  return {
    text: lines.join("\n"),
    replyMarkup: { inline_keyboard: rows }
  };
}

export function buildProjectBrowserUseCurrentDirectoryConfirmMessage(options: {
  token: string;
  projectName: string;
  directoryPath: string;
  language?: UiLanguage;
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  return {
    text: [
      formatHtmlHeading(LL.browser.confirmNewSession()),
      formatHtmlField(LL.browser.directory(), options.directoryPath),
      formatHtmlField(LL.browser.displayName(), options.projectName),
      LL.browser.confirmNewInDirectory()
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{ text: LL.projects.confirmNewSessionButton(), callback_data: encodeBrowseUseCurrentDirConfirmCallback(options.token) }],
        [{ text: LL.browser.backToDirectory(), callback_data: encodeBrowseUseCurrentDirCancelCallback(options.token) }]
      ]
    }
  };
}

export function buildProjectBrowserTextPreviewMessage(options: {
  language?: UiLanguage;
  token: string;
  projectName: string;
  relativeFilePath: string;
  fileName: string;
  sizeLabel: string;
  modifiedAtLabel: string;
  page: number;
  totalPages: number;
  pageText: string;
  truncated: boolean;
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  const pagerRow: Array<{ text: string; callback_data: string }> = [];

  if (options.page > 0) {
    pagerRow.push({
      text: LL.common.previousPage(),
      callback_data: encodeBrowsePageCallback(options.token, options.page - 1)
    });
  }
  if (options.page + 1 < options.totalPages) {
    pagerRow.push({
      text: LL.common.nextPage(),
      callback_data: encodeBrowsePageCallback(options.token, options.page + 1)
    });
  }
  if (pagerRow.length > 0) {
    rows.push(pagerRow);
  }

  rows.push([{ text: LL.browser.returnToDirectory(), callback_data: encodeBrowseBackCallback(options.token) }]);

  const lines = [
    formatHtmlHeading(LL.browser.previewTitle()),
    formatHtmlField(LL.browser.project(), options.projectName),
    formatHtmlField(LL.browser.file(), options.fileName),
    formatHtmlField(LL.browser.path(), options.relativeFilePath),
    formatHtmlField(LL.browser.size(), options.sizeLabel),
    formatHtmlField(LL.browser.modified(), options.modifiedAtLabel),
    formatHtmlField(LL.browser.previewPage(), `${options.page + 1}/${options.totalPages}`)
  ];

  if (options.truncated) {
    lines.push(LL.browser.previewTruncated());
  }

  lines.push("", `<pre>${escapeHtml(options.pageText)}</pre>`);

  return {
    text: lines.join("\n"),
    replyMarkup: { inline_keyboard: rows }
  };
}

export function buildProjectBrowserFileInfoMessage(options: {
  language?: UiLanguage;
  projectName: string;
  relativeFilePath: string;
  fileName: string;
  sizeLabel: string;
  modifiedAtLabel: string;
}): string {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);

  return [
    formatHtmlHeading(LL.browser.infoTitle()),
    formatHtmlField(LL.browser.project(), options.projectName),
    formatHtmlField(LL.browser.file(), options.fileName),
    formatHtmlField(LL.browser.path(), options.relativeFilePath),
    formatHtmlField(LL.browser.size(), options.sizeLabel),
    formatHtmlField(LL.browser.modified(), options.modifiedAtLabel),
    formatHtmlField(LL.browser.type(), LL.browser.binary())
  ].join("\n");
}

export function buildProjectBrowserImageCaption(options: {
  language?: UiLanguage;
  projectName: string;
  relativeFilePath: string;
  fileName: string;
  sizeLabel: string;
}): string {
  const language = options.language ?? "zh";
  const LL = getTranslator(language);

  return [
    formatHtmlHeading(LL.browser.imagePreview()),
    formatHtmlField(LL.browser.project(), options.projectName),
    formatHtmlField(LL.browser.file(), options.fileName),
    formatHtmlField(LL.browser.path(), options.relativeFilePath),
    formatHtmlField(LL.browser.size(), options.sizeLabel)
  ].join("\n");
}

export function formatProjectBrowserRootLabel(language: UiLanguage = "zh"): string {
  return getTranslator(language).browser.root();
}
