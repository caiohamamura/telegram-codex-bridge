import type { Translation } from "../i18n-types.js";

const en = {
  common: {
    none: "None",
    yes: "Yes",
    no: "No",
    ok: "OK",
    unhealthy: "Unhealthy",
    unavailable: "None",
    close: "Close",
    current: "current",
    defaultModel: "Default model",
    default: "default",
    configured: "configured",
    effective: "effective"
  },
  status: {
    title: "Service Status",
    bridgeState: "Bridge state:",
    platformConnectivity: "Platform connectivity:",
    setupComplete: "Setup complete:",
    codexAvailable: "Codex available:",
    currentSession: "Current session:",
    lastChecked: "Last checked:",
    issues: "Issues:"
  },
  where: {
    title: "Current Session",
    sessionName: "Session:",
    project: "Project:",
    path: "Path:",
    state: "State:",
    modelConfigured: "Model configured:",
    modelEffective: "Model effective:",
    bridgeSessionId: "Bridge session ID:",
    codexThreadId: "Codex thread ID:",
    lastTurnId: "Last turn ID:",
    lastResult: "Last result:",
    noActiveSession: "There is no active session.",
    threadNotCreated: "Not created yet; generated after the first task"
  },
  sessions: {
    recentTitle: "Recent Sessions",
    archivedTitle: "Archived Sessions",
    empty: "No sessions."
  },
  sessionState: {
    running: "running",
    interrupted: "interrupted",
    failed: "failed",
    idle: "idle",
    lastCompleted: "Last turn completed",
    lastInterrupted: "Last turn interrupted",
    lastFailed: "Last turn failed",
    failureBridgeRestart: "bridge service restarted",
    failureAppServerLost: "Codex service disconnected",
    failureTurnFailed: "turn failed",
    failureUnknown: "unknown reason"
  },
  commands: {
    heading: "Available commands",
    groups: {
      helpStatus: "Help & Status",
      sessionProject: "Sessions & Projects",
      codex: "Codex",
      control: "Control"
    }
  }
} satisfies Translation;

export default en;
