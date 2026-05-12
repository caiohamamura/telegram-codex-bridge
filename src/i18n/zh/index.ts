import type { BaseTranslation } from "../i18n-types.js";

const zh = {
  common: {
    none: "无",
    yes: "是",
    no: "否",
    ok: "正常",
    unhealthy: "异常",
    unavailable: "暂无",
    close: "关闭",
    current: "当前",
    defaultModel: "默认模型",
    default: "默认",
    configured: "配置",
    effective: "生效"
  },
  status: {
    title: "服务状态",
    bridgeState: "桥接状态：",
    platformConnectivity: "平台连通：",
    setupComplete: "配置完成：",
    codexAvailable: "Codex 可用：",
    currentSession: "当前会话：",
    lastChecked: "最近检查：",
    issues: "问题："
  },
  where: {
    title: "当前会话",
    sessionName: "会话名：",
    project: "项目：",
    path: "路径：",
    state: "状态：",
    modelConfigured: "模型配置：",
    modelEffective: "模型生效：",
    bridgeSessionId: "Bridge 会话 ID：",
    codexThreadId: "Codex 线程 ID：",
    lastTurnId: "最近 Turn ID：",
    lastResult: "上次结果：",
    noActiveSession: "当前没有活动会话。",
    threadNotCreated: "尚未创建（首次发送任务后生成）"
  },
  sessions: {
    recentTitle: "最近会话",
    archivedTitle: "已归档会话",
    empty: "暂无会话。"
  },
  sessionState: {
    running: "执行中",
    interrupted: "已中断",
    failed: "失败",
    idle: "空闲",
    lastCompleted: "上次已完成",
    lastInterrupted: "上次已中断",
    lastFailed: "上次失败",
    failureBridgeRestart: "桥接服务重启",
    failureAppServerLost: "Codex 服务断开",
    failureTurnFailed: "执行失败",
    failureUnknown: "未知原因"
  },
  commands: {
    heading: "可用指令",
    groups: {
      helpStatus: "帮助与状态",
      sessionProject: "会话与项目",
      codex: "Codex",
      control: "控制"
    }
  }
} satisfies BaseTranslation;

export default zh;
