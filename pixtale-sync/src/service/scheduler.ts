import { taskService } from "./task";
import { SyncTaskStatusEnum } from "../enum/settings";
import { settingsService } from "./settings";
import { syncService } from "./sync";

// 定时同步服务：应用运行期间每分钟检查一次同步条件。

const checkInterval = 60_000;
let timer: ReturnType<typeof setInterval> | null = null;
let checking = false;

const schedulerService = {
  /** 启动每分钟一次的定时同步检查，并立即检查一次。 */
  startScheduler(): void {
    if (timer) {
      return;
    }

    void checkSchedule();
    timer = setInterval(() => void checkSchedule(), checkInterval);
  },

  /** 停止定时同步检查，不影响正在运行的同步任务。 */
  stopScheduler(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  },
};

export { schedulerService };

/** 检查当前配置和任务状态，满足条件时执行一次同步。 */
async function checkSchedule(): Promise<void> {
  if (checking) {
    return;
  }

  checking = true;
  try {
    const settings = await settingsService.get();
    if (
      settings.taskStatus !== SyncTaskStatusEnum.ENABLED ||
      settings.taskInterval === 0 ||
      !isSyncDue(settings.lastSyncAt, settings.taskInterval)
    ) {
      return;
    }

    if (await taskService.hasRunningTask()) {
      return;
    }

    await syncService.sync();
  } catch (error) {
    console.error("定时同步失败", error);
  } finally {
    checking = false;
  }
}

/** 判断最近完成时间是否已超过设置的同步间隔。 */
function isSyncDue(lastSyncAt: string | null, interval: number): boolean {
  if (!lastSyncAt) {
    return true;
  }

  const lastTime = Date.parse(lastSyncAt);
  return (
    Number.isNaN(lastTime) ||
    Date.now() - lastTime >= interval * 60 * 1000
  );
}
