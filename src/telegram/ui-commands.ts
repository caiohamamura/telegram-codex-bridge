import {
  getTelegramCommandPanelEntry,
  getTelegramCommandPanelGroups,
  type TelegramCommandPanelEntry
} from "./commands.js";
import type { TelegramInlineKeyboardMarkup } from "./api.js";
import type { UiLanguage } from "../types.js";
import { getTranslator } from "../i18n/index.js";
import {
  encodeCommandPanelEditCloseCallback,
  encodeCommandPanelEditHelpCallback,
  encodeCommandPanelEditOpenCallback,
  encodeCommandPanelEditPageCallback,
  encodeCommandPanelEditResetCallback,
  encodeCommandPanelEditSaveCallback,
  encodeCommandPanelEditToggleCallback,
  encodeCommandPanelOpenCallback,
  encodeCommandPanelRunCallback
} from "./ui-callbacks.js";
import { chunkButtons, formatHtmlField, formatHtmlHeading } from "./ui-shared.js";

export const COMMAND_PANEL_MAX_COMMANDS = 8;
const COMMAND_PANEL_PAGE_SIZE = 6;

interface CommandPanelEditPage {
  groupLabel: string;
  groupPage: number;
  groupPageCount: number;
  entries: TelegramCommandPanelEntry[];
}

export function resolveCommandPanelEntries(commands: string[], language: UiLanguage): TelegramCommandPanelEntry[] {
  return commands
    .map((command) => getTelegramCommandPanelEntry(command, language))
    .filter((entry): entry is TelegramCommandPanelEntry => Boolean(entry));
}

export function buildHelpReplyMarkup(language: UiLanguage): TelegramInlineKeyboardMarkup {
  const LL = getTranslator(language);
  return {
    inline_keyboard: [[{
      text: LL.commandPanel.openPanel(),
      callback_data: encodeCommandPanelOpenCallback()
    }]]
  };
}

export function buildCommandPanelMessage(options: {
  commands: TelegramCommandPanelEntry[];
  language: UiLanguage;
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const LL = getTranslator(options.language);
  const rows = chunkButtons(options.commands.map((entry) => ({
    text: entry.shortLabel,
    callback_data: encodeCommandPanelRunCallback(entry.command)
  })), 2);

  rows.push([
    {
      text: LL.commandPanel.fullHelp(),
      callback_data: encodeCommandPanelEditHelpCallback()
    },
    {
      text: LL.commandPanel.editCommands(),
      callback_data: encodeCommandPanelEditOpenCallback()
    }
  ]);

  const lines = [
    formatHtmlHeading(LL.commandPanel.title()),
    LL.commandPanel.tapToRun(),
    formatHtmlField(
      LL.commandPanel.selectedLabel(),
      `${options.commands.length}/${COMMAND_PANEL_MAX_COMMANDS}`
    )
  ];

  if (options.commands.length === 0) {
    lines.push(LL.commandPanel.noCommands());
  } else {
    lines.push(...options.commands.map((entry, index) =>
      `${index + 1}. /${entry.command} ${entry.description}`
    ));
  }

  return {
    text: lines.join("\n"),
    replyMarkup: { inline_keyboard: rows }
  };
}

export function buildCommandPanelEditMessage(options: {
  token: string;
  commands: string[];
  page: number;
  language: UiLanguage;
}): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
} {
  const LL = getTranslator(options.language);
  const pages = buildCommandPanelEditPages(options.language);
  const totalPages = Math.max(1, pages.length);
  const safePage = Math.min(Math.max(options.page, 0), totalPages - 1);
  const currentPage = pages[safePage] ?? {
    groupLabel: LL.commandPanel.title(),
    groupPage: 0,
    groupPageCount: 1,
    entries: []
  };
  const selectedSet = new Set(options.commands);
  const selectedEntries = resolveCommandPanelEntries(options.commands, options.language);
  const selectedSummary = selectedEntries.length > 0
    ? selectedEntries.map((entry, index) => `${index + 1}. /${entry.command} ${entry.description}`).join("\n")
    : LL.commandPanel.noSelected();

  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = currentPage.entries.map((entry) => [{
    text: `${selectedSet.has(entry.command) ? "✓" : "＋"} ${entry.shortLabel}`,
    callback_data: encodeCommandPanelEditToggleCallback(options.token, entry.command)
  }]);

  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (safePage > 0) {
    navigation.push({
      text: LL.common.previous(),
      callback_data: encodeCommandPanelEditPageCallback(options.token, safePage - 1)
    });
  }
  if (safePage + 1 < totalPages) {
    navigation.push({
      text: LL.common.next(),
      callback_data: encodeCommandPanelEditPageCallback(options.token, safePage + 1)
    });
  }
  if (navigation.length > 0) {
    rows.push(navigation);
  }

  rows.push([{ text: LL.commandPanel.save(), callback_data: encodeCommandPanelEditSaveCallback(options.token) }]);
  rows.push([{ text: LL.commandPanel.restoreDefault(), callback_data: encodeCommandPanelEditResetCallback(options.token) }]);
  rows.push([{ text: LL.common.close(), callback_data: encodeCommandPanelEditCloseCallback(options.token) }]);

  return {
    text: [
      formatHtmlHeading(LL.commandPanel.editTitle()),
      LL.commandPanel.editHint(),
      LL.commandPanel.editAppendHint(),
      formatHtmlField(LL.commandPanel.currentGroup(), currentPage.groupLabel),
      formatHtmlField(LL.commandPanel.selectedCommands(), `${options.commands.length}/${COMMAND_PANEL_MAX_COMMANDS}`),
      selectedSummary,
      formatHtmlField(LL.commandPanel.groupPage(), `${currentPage.groupPage + 1}/${currentPage.groupPageCount}`),
      formatHtmlField(LL.commandPanel.totalPage(), `${safePage + 1}/${totalPages}`)
    ].join("\n"),
    replyMarkup: { inline_keyboard: rows }
  };
}

function buildCommandPanelEditPages(language: UiLanguage): CommandPanelEditPage[] {
  const groups = getTelegramCommandPanelGroups(language);
  const pages: CommandPanelEditPage[] = [];

  for (const group of groups) {
    const totalPages = Math.max(1, Math.ceil(group.entries.length / COMMAND_PANEL_PAGE_SIZE));
    for (let page = 0; page < totalPages; page += 1) {
      pages.push({
        groupLabel: group.label,
        groupPage: page,
        groupPageCount: totalPages,
        entries: group.entries.slice(page * COMMAND_PANEL_PAGE_SIZE, (page + 1) * COMMAND_PANEL_PAGE_SIZE)
      });
    }
  }

  return pages;
}
