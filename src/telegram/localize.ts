import type { TelegramInlineKeyboardMarkup } from "./api.js";
import type { UiLanguage } from "../types.js";

type Replacement = readonly [RegExp, string];

const EXACT_TEXT_REPLACEMENTS = new Map<string, string>([
  ["无", "None"],
  ["是", "Yes"],
  ["否", "No"],
  ["正常", "OK"],
  ["异常", "Unhealthy"],
  ["暂无", "None"],
  ["暂无会话。", "No sessions."],
  ["当前没有活动会话。", "There is no active session."],
  ["当前没有运行中的会话。", "There are no running sessions."],
  ["当前有待处理的交互，请先完成当前操作。", "There is a pending interaction. Complete it first."],
  ["当前没有可取消的输入。", "There is no pending input to cancel."],
  ["请先发送 /new 选择项目。", "Send /new first to choose a project."],
  ["Codex 服务暂时不可用，请稍后重试。", "The Codex service is temporarily unavailable. Try again later."],
  ["桥接状态未知，请在本机运行 ctb doctor。", "Bridge status is unknown. Run ctb doctor on this machine."],
  ["这个命令还没开放。", "This command is not available yet."],
  ["这个按钮已过期，请重新操作。", "This button expired. Please try again."],
  ["这个按钮已过期，请重新发送 /runtime。", "This button expired. Send /runtime again."],
  ["这个按钮已过期，请重新发送 /inspect。", "This button expired. Send /inspect again."],
  ["这个按钮已过期，请重新发送 /rollback。", "This button expired. Send /rollback again."],
  ["这个按钮已过期，请重新打开编辑器。", "This button expired. Reopen the editor."],
  ["这个按钮已过期，请重新打开命令面板。", "This button expired. Reopen the command panel."],
  ["这个操作已处理。", "This action has already been handled."],
  ["当前没有可用的活动详情。", "There are no activity details available."],
  ["当前平台正在限流，请稍后再试。", "The current platform is rate limiting. Try again later."],
  ["暂时无法更新这条消息，请稍后再试。", "Could not update this message right now. Try again later."],
  ["暂时无法关闭这条消息，请稍后再试。", "Could not close this message right now. Try again later."],
  ["暂时无法打开命令面板，请稍后重试。", "Could not open the command panel right now. Try again later."],
  ["暂时无法打开编辑器，请稍后重试。", "Could not open the editor right now. Try again later."],
  ["暂时无法更新编辑器，请稍后重试。", "Could not update the editor right now. Try again later."],
  ["已保存。", "Saved."],
  ["已保存，但暂时无法刷新命令面板。", "Saved, but the command panel could not be refreshed right now."],
  ["状态存储当前不可用。", "State storage unavailable."],
  ["至少保留 1 个快捷指令。", "Keep at least 1 shortcut command."],
  ["最多只能保留 8 个快捷指令。", "You can keep at most 8 shortcut commands."],
  ["这个指令当前不能加入快捷指令。", "This command cannot be added to shortcuts right now."],
  ["当前项目仍在执行，请等待完成或发送 /interrupt。", "The current project is still running. Wait for it to finish or send /interrupt."],
  ["当前项目仍在执行，请先等待完成或停止当前操作。", "The current project is still running. Wait for it to finish or interrupt the current operation first."],
  ["当前没有正在执行的操作。", "There is no running operation."],
  ["已请求停止当前操作。", "Requested interruption of the current operation."],
  ["当前无法中断正在运行的操作。", "The running operation cannot be interrupted right now."],
  ["这次操作未成功完成，请重试。", "This operation did not complete successfully. Try again."],
  ["当前无法开始实施，请稍后重试。", "Implementation cannot start right now. Try again later."],
  ["选择要新建会话的项目", "Choose a project for the new session"],
  ["已收藏", "Pinned"],
  ["最近使用", "Recent"],
  ["浏览目录", "Browse directory"],
  ["手动输入路径", "Enter path"],
  ["返回项目列表", "Back to projects"],
  ["选择要浏览的根目录", "Choose a root directory to browse"],
  ["确认新建会话", "Create session"],
  ["这个入口已下线。请使用浏览目录或手动输入路径。", "This entry is no longer available. Browse a directory or enter a path manually."],
  ["选择模型", "Choose Model"],
  ["选择思考强度", "Choose Reasoning Effort"],
  ["上一页", "Previous"],
  ["下一页", "Next"],
  ["关闭", "Close"],
  ["保存并应用", "Save and apply"],
  ["恢复默认", "Restore defaults"],
  ["展开详情", "Expand details"],
  ["收起详情", "Collapse details"],
  ["命令", "Commands"],
  ["重命名会话", "Rename session"],
  ["设置项目别名", "Set project alias"],
  ["清除项目别名", "Clear project alias"],
  ["取消", "Cancel"],
  ["当前任务详情", "Current Task Details"],
  ["最近动作", "Recent Actions"],
  ["最近命令", "Recent Commands"],
  ["最近文件变更", "Recent File Changes"],
  ["最近工具与搜索", "Recent Tools and Searches"],
  ["提示与告警", "Notices and Warnings"],
  ["Token 用量", "Token Usage"],
  ["最近差异", "Recent Diff"],
  ["计划清单", "Plan"],
  ["方案草稿", "Proposed Plan"],
  ["补充说明", "Commentary"],
  ["待处理交互", "Pending Interactions"],
  ["最近已答交互", "Recently Answered Interactions"],
  ["选择回滚目标", "Choose Rollback Target"],
  ["确认回滚", "Confirm Rollback"],
  ["确认回滚", "Confirm rollback"],
  ["返回列表", "Back to list"],
  ["已关闭回滚目标选择", "Rollback Target Picker Closed"],
  ["未执行回滚。", "No rollback was performed."]
]);

const REGEX_REPLACEMENTS: Replacement[] = [
  [/用法：\/thread name <名称> 或 \/thread meta branch=<分支> sha=<提交> origin=<URL> 或 \/thread clean-terminals/g, "Usage: /thread name <name> or /thread meta branch=<branch> sha=<commit> origin=<URL> or /thread clean-terminals"],
  [/服务状态/g, "Service Status"],
  [/桥接状态：/g, "Bridge state: "],
  [/平台连通：/g, "Platform connectivity: "],
  [/配置完成：/g, "Setup complete: "],
  [/Codex 可用：/g, "Codex available: "],
  [/当前会话：/g, "Current session: "],
  [/当前项目：/g, "Current project: "],
  [/会话名：/g, "Session: "],
  [/项目：/g, "Project: "],
  [/路径：/g, "Path: "],
  [/状态：/g, "State: "],
  [/最近检查：/g, "Last checked: "],
  [/问题：/g, "Issues: "],
  [/当前字段：/g, "Current fields: "],
  [/当前分组：/g, "Current group: "],
  [/已选字段：/g, "Selected fields: "],
  [/分组页码：/g, "Group page: "],
  [/总页码：/g, "Total page: "],
  [/页码：/g, "Page: "],
  [/详情页：/g, "Details page: "],
  [/目标：/g, "Target: "],
  [/将删除的 turn 数：/g, "Turns to remove: "],
  [/模型：/g, "Model: "],
  [/当前配置：/g, "Configured: "],
  [/当前生效：/g, "Effective: "],
  [/模型配置：/g, "Model configured: "],
  [/模型生效：/g, "Model effective: "],
  [/上次结果：/g, "Last result: "],
  [/最近 Turn ID：/g, "Last turn ID: "],
  [/Codex 线程 ID：/g, "Codex thread ID: "],
  [/Bridge 会话 ID：/g, "Bridge session ID: "],
  [/阻塞原因：/g, "Blocked on: "],
  [/当前动作：/g, "Current action: "],
  [/已耗时：/g, "Elapsed: "],
  [/最近结论：/g, "Latest conclusion: "],
  [/最终答复：/g, "Final answer: "],
  [/说明：/g, "Note: "],
  [/已新建会话/g, "Session Created"],
  [/已切换会话/g, "Session Switched"],
  [/已恢复 Codex 会话/g, "Codex Session Resumed"],
  [/已恢复会话/g, "Session Restored"],
  [/已归档会话/g, "Session Archived"],
  [/已批量归档会话/g, "Sessions Archived"],
  [/已关闭模型选择/g, "Model Picker Closed"],
  [/最近会话/g, "Recent Sessions"],
  [/已归档：/g, "Archived: "],
  [/已跳过运行中：/g, "Skipped running: "],
  [/失败：/g, "Failed: "],
  [/\[当前\]/g, "[current]"],
  [/\[已配置\]/g, "[configured]"],
  [/\[启用\]/g, "[enabled]"],
  [/\[禁用\]/g, "[disabled]"],
  [/\[已安装\]/g, "[installed]"],
  [/\[未安装\]/g, "[not installed]"],
  [/\[可访问\]/g, "[accessible]"],
  [/\[不可访问\]/g, "[not accessible]"],
  [/\[未启用\]/g, "[not enabled]"],
  [/默认模型/g, "Default model"],
  [/默认/g, "default"],
  [/生效/g, "effective"],
  [/执行中/g, "running"],
  [/已中断/g, "interrupted"],
  [/空闲/g, "idle"],
  [/上次已完成/g, "Last turn completed"],
  [/上次已中断/g, "Last turn interrupted"],
  [/上次失败/g, "Last turn failed"],
  [/尚未创建（首次发送任务后生成）/g, "Not created yet; generated after the first task"],
  [/没有最近项目，请浏览目录或手动输入路径。/g, "No recent projects yet. Browse a directory or enter a path manually."],
  [/请发送要开始会话的目录路径，例如：/g, "Send the directory path to start the session, for example: "],
  [/发送 \/cancel 返回项目列表。/g, "Send /cancel to return to the project list."],
  [/要在这个目录中新建会话吗？/g, "Create a new session in this directory?"],
  [/先选模型，再按该模型支持情况选择思考强度。/g, "Choose a model first, then choose a reasoning effort supported by that model."],
  [/仅展示这个模型实际支持的档位。/g, "Only efforts actually supported by this model are shown."],
  [/按按钮选择要显示的字段。/g, "Use the buttons to choose fields to display."],
  [/选择顺序就是显示顺序；新选中的字段会追加到末尾。/g, "Selection order is display order; newly selected fields are appended."],
  [/当前没有已选字段。/g, "No fields selected."],
  [/只展示用户输入，不展示 agent 输出。/g, "Only user inputs are shown; agent outputs are hidden."],
  [/本地文件改动不会自动撤销。/g, "Local file changes will not be automatically undone."],
  [/使用 \/inspect 查看详情，使用 \/interrupt 打断，使用 \/status 查看状态。/g, "Use /inspect for details, /interrupt to stop, and /status for status."],
  [/提示：需要查看运行卡片时，可发送 \/hub。/g, "Tip: send /hub when you need the runtime card."],
  [/用法：\/skill <技能名> :: 任务说明/g, "Usage: /skill <skill-name> :: <task>"],
  [/用法：\/plugin install <市场>\/<插件名>/g, "Usage: /plugin install <market>/<plugin-name>"],
  [/用法：\/plugin uninstall <插件ID>/g, "Usage: /plugin uninstall <plugin-id>"],
  [/用法：\/plugin install <市场>\/<插件名> 或 \/plugin uninstall <插件ID>/g, "Usage: /plugin install <market>/<plugin-name> or /plugin uninstall <plugin-id>"],
  [/用法：\/mcp、\/mcp reload 或 \/mcp login <名称>/g, "Usage: /mcp, /mcp reload, or /mcp login <name>"],
  [/用法：\/mcp login <名称>/g, "Usage: /mcp login <name>"],
  [/用法：\/rollback 或 \/rollback <回滚的 turn 数量>/g, "Usage: /rollback or /rollback <number-of-turns-to-rollback>"],
  [/用法：\/thread name <名称>/g, "Usage: /thread name <name>"],
  [/用法：\/thread meta branch=<分支> sha=<提交> origin=<URL>/g, "Usage: /thread meta branch=<branch> sha=<commit> origin=<URL>"],
  [/用法：\/thread name <名称> 或 \/thread meta branch=<分支> sha=<提交> origin=<URL> 或 \/thread clean-terminals/g, "Usage: /thread name <name> or /thread meta branch=<branch> sha=<commit> origin=<URL> or /thread clean-terminals"],
  [/用法：\/local_image <图片路径> :: 任务说明/g, "Usage: /local_image <image-path> :: <task>"],
  [/用法：\/mention <path> :: 任务说明/g, "Usage: /mention <path> :: <task>"],
  [/用法：\/attach <附件ID> :: 任务说明/g, "Usage: /attach <attachment-id> :: <task>"],
  [/当前项目没有可列出的技能。/g, "There are no skills to list for the current project."],
  [/当前项目没有可列出的插件。/g, "There are no plugins to list for the current project."],
  [/当前没有可列出的 Apps。/g, "There are no apps to list."],
  [/当前没有可列出的 MCP 服务器。/g, "There are no MCP servers to list."],
  [/当前没有可选择的回滚目标。/g, "There are no rollback targets to choose from."],
  [/找不到这个模型，请先发送 \/model 用按钮选择。/g, "Could not find that model. Send /model first and choose with the buttons."],
  [/找不到这个技能，请先发送 \/skills 查看当前项目的技能列表。/g, "Could not find that skill. Send /skills first to view the current project's skill list."],
  [/找不到这个插件，请先发送 \/plugins 查看当前可用列表。/g, "Could not find that plugin. Send /plugins first to view the available list."],
  [/当前会话还没有可压缩的 Codex 线程。/g, "The current session does not have a Codex thread to compact yet."],
  [/当前会话还没有 Codex 线程，请先完成一次任务。/g, "The current session does not have a Codex thread yet. Complete one task first."],
  [/当前会话还没有可回滚的 Codex 线程。/g, "The current session does not have a Codex thread to roll back yet."],
  [/当前会话还没有可分叉的 Codex 线程，请先完成一次任务。/g, "The current session does not have a Codex thread to fork yet. Complete one task first."],
  [/当前无法生成这个 MCP 服务器的登录链接。/g, "Could not generate a login link for this MCP server right now."],
  [/已重新加载 MCP 服务器配置。/g, "Reloaded MCP server configuration."],
  [/扫描警告：/g, "Scan warning: "],
  [/市场：/g, "Marketplace: "],
  [/例如：/g, "Example: "],
  [/账号：未登录/g, "Account: not logged in"],
  [/类型：API Key/g, "Type: API Key"],
  [/类型：ChatGPT/g, "Type: ChatGPT"],
  [/需要 OpenAI Auth：/g, "Requires OpenAI Auth: "],
  [/不支持认证/g, "auth unsupported"],
  [/未登录/g, "not logged in"],
  [/正常/g, "OK"],
  [/异常/g, "Unhealthy"],
  [/暂无/g, "None"],
  [/无/g, "None"],
  [/是/g, "Yes"],
  [/否/g, "No"],
  [/额度：/g, "Limit: "],
  [/限额计划：/g, "Limit plan: "],
  [/主额度使用：/g, "Primary limit usage: "],
  [/当前窗口/g, "current window"],
  [/分钟/g, "minutes"],
  [/无限/g, "unlimited"],
  [/可用/g, "available"],
  [/不可用/g, "unavailable"],
  [/ 个/g, ""],
  [/；/g, "; "],
  [/ 或 /g, " or "],
  [/：/g, ": "],
  [/（/g, " ("],
  [/）/g, ")"],
  [/。/g, "."],
  [/，/g, ", "],
  [/、/g, ", "]
];

export function localizeTelegramText(text: string, language: UiLanguage): string {
  if (language !== "en" || !containsHan(text)) {
    return text;
  }

  const exact = EXACT_TEXT_REPLACEMENTS.get(text);
  if (exact) {
    return exact;
  }

  let localized = text;
  for (const [pattern, replacement] of REGEX_REPLACEMENTS) {
    localized = localized.replace(pattern, replacement);
  }

  return localized;
}

export function localizeTelegramReplyMarkup(
  replyMarkup: TelegramInlineKeyboardMarkup | undefined,
  language: UiLanguage
): TelegramInlineKeyboardMarkup | undefined {
  if (language !== "en" || !replyMarkup) {
    return replyMarkup;
  }

  return {
    ...replyMarkup,
    inline_keyboard: replyMarkup.inline_keyboard.map((row) =>
      row.map((button) => ({
        ...button,
        text: localizeTelegramText(button.text, language)
      }))
    )
  };
}

export function localizeTelegramCaptionOptions<T extends { caption?: string } | undefined>(
  options: T,
  language: UiLanguage
): T {
  if (language !== "en" || !options?.caption) {
    return options;
  }

  return {
    ...options,
    caption: localizeTelegramText(options.caption, language)
  };
}

function containsHan(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}
