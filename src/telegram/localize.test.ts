import assert from "node:assert/strict";
import test from "node:test";

import { localizeTelegramReplyMarkup, localizeTelegramText } from "./localize.js";

test("localizeTelegramText translates common command and status responses in English mode", () => {
  const status = [
    "<b>服务状态</b>",
    "桥接状态：ready",
    "平台连通：正常",
    "配置完成：是",
    "当前会话：无",
    "问题：无"
  ].join("\n");

  assert.equal(
    localizeTelegramText(status, "en"),
    [
      "<b>Service Status</b>",
      "Bridge state: ready",
      "Platform connectivity: OK",
      "Setup complete: Yes",
      "Current session: None",
      "Issues: None"
    ].join("\n")
  );

  assert.equal(
    localizeTelegramText(
      "用法：/thread name <名称> 或 /thread meta branch=<分支> sha=<提交> origin=<URL> 或 /thread clean-terminals",
      "en"
    ),
    "Usage: /thread name <name> or /thread meta branch=<branch> sha=<commit> origin=<URL> or /thread clean-terminals"
  );
});

test("localizeTelegramReplyMarkup translates inline button labels in English mode", () => {
  const replyMarkup = localizeTelegramReplyMarkup({
    inline_keyboard: [[
      { text: "浏览目录", callback_data: "new:browse" },
      { text: "手动输入路径", callback_data: "path:manual" }
    ]]
  }, "en");

  assert.deepEqual(replyMarkup?.inline_keyboard[0]?.map((button) => button.text), [
    "Browse directory",
    "Enter path"
  ]);
});
