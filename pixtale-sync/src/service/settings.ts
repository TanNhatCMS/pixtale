import type { SyncTaskStatus } from "../enum/settings";
import { getDb } from "../lib/db";

// 应用设置业务：读取并保存同步、日志和上传配置。

export type Settings = {
  taskInterval: number;
  logMaxCount: number;
  taskStatus: SyncTaskStatus;
  uploadConcurrency: number;
  lastSyncAt: string | null;
};

const settingsService = {
  /** 查询当前应用设置。 */
  async get(): Promise<Settings> {
    const db = await getDb();
    const rows = await db.select<Settings[]>(
      `SELECT task_interval AS taskInterval, log_max_count AS logMaxCount,
            task_status AS taskStatus,
            upload_concurrency AS uploadConcurrency,
            last_sync_at AS lastSyncAt
     FROM settings
     WHERE id = 1`,
    );
    return rows[0];
  },

  /** 保存整体同步任务状态。 */
  async updateTaskStatus(value: SyncTaskStatus): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE settings SET task_status = $1 WHERE id = 1", [
      value,
    ]);
  },

  /** 保存任务同步间隔。 */
  async updateTaskInterval(value: number): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE settings SET task_interval = $1 WHERE id = 1", [
      value,
    ]);
  },

  /** 保存日志最大保留数量。 */
  async updateLogMaxCount(value: number): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE settings SET log_max_count = $1 WHERE id = 1", [
      value,
    ]);
  },

  /** 保存文件上传并发数。 */
  async updateUploadConcurrency(value: number): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE settings SET upload_concurrency = $1 WHERE id = 1",
      [value],
    );
  },

  /** 记录最近一次完整同步的完成时间。 */
  async updateLastSyncAt(): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE settings SET last_sync_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 1",
    );
  },
};

export { settingsService };
