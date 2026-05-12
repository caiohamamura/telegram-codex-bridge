import { classifyNotification } from "../codex/notification-classifier.js";
import type { BridgePlatform } from "../core/domain/binding.js";
import { getTranslator } from "../i18n/index.js";
import type { BridgeStateStore } from "../state/store.js";
import type { UiLanguage } from "../types.js";

type GlobalRuntimeNotice = Extract<
  ReturnType<typeof classifyNotification>,
  {
    kind:
      | "config_warning"
      | "deprecation_notice"
      | "model_rerouted"
      | "skills_changed"
      | "thread_compacted"
      | "thread_compaction_completed"
  }
>;

interface RuntimeNoticeBroadcasterDeps {
  getStore: () => BridgeStateStore | null;
  activePack: BridgePlatform;
  getUiLanguage: () => UiLanguage;
  safeSendMessage: (chatId: string, text: string) => Promise<boolean>;
}

export class RuntimeNoticeBroadcaster {
  constructor(private readonly deps: RuntimeNoticeBroadcasterDeps) {}

  async broadcast(notification: GlobalRuntimeNotice): Promise<void> {
    const store = this.deps.getStore();
    if (!store) {
      return;
    }

    const message = this.formatGlobalRuntimeNotice(notification);
    if (!message) {
      return;
    }

    const bindings = store.listChatBindings(this.deps.activePack);
    for (const binding of bindings) {
      const delivered = await this.deps.safeSendMessage(binding.chatId, message);
      if (!delivered) {
        store.createRuntimeNotice({
          chatId: binding.chatId,
          type: "app_server_notice",
          message
        });
      }
    }
  }

  private formatGlobalRuntimeNotice(notification: GlobalRuntimeNotice): string | null {
    const LL = getTranslator(this.deps.getUiLanguage());
    switch (notification.kind) {
      case "config_warning":
        return notification.summary
          ? `${LL.notices.configWarningPrefix()}${notification.summary}${notification.detail ? `\n${notification.detail}` : ""}`
          : null;
      case "deprecation_notice":
        return notification.summary
          ? `${LL.notices.deprecationWarningPrefix()}${notification.summary}${notification.detail ? `\n${notification.detail}` : ""}`
          : null;
      case "model_rerouted":
        if (!notification.fromModel || !notification.toModel) {
          return null;
        }
        return `${LL.notices.modelAdjustedPrefix()}${notification.fromModel}${LL.notices.modelAdjustedArrow()}${notification.toModel}${notification.reason ? `${LL.notices.modelAdjustedReasonPrefix()}${notification.reason}${LL.notices.modelAdjustedReasonSuffix()}` : ""}`;
      case "skills_changed":
        return LL.notices.skillsRefreshed();
      case "thread_compacted":
      case "thread_compaction_completed":
        return LL.notices.threadCompacted();
      default:
        return null;
    }
  }
}
