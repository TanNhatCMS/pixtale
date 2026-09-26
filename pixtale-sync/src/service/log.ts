import type { LogStatus } from "../enum/log";
import { getDb } from "../lib/db";

// 同步日志业务：记录同步事件的执行结果。

export type SyncLogStatus = LogStatus;

export type SyncLog = {
  id: number;
  path: string;
  taskName: string;
  eventName: string;
  status: SyncLogStatus;
  message: string | null;
  createdAt: string;
};

export type SyncLogPage = {
  items: SyncLog[];
  total: number;
};

type CountRow = {
  total: number;
};

const logService = {
  /** 新增一条同步事件日志。 */
  async add(
    taskName: string,
    eventName: string,
    path: string,
    status: LogStatus,
    message?: string,
  ): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO log (task_name, event_name, path, status, message)
     VALUES ($1, $2, $3, $4, $5)`,
      [taskName, eventName, path, status, message ?? null],
    );
  },

  /** 按状态和创建时间倒序分页查询同步日志。 */
  async list(
    page: number,
    pageSize: number,
    status?: SyncLogStatus,
    search: string = "",
  ): Promise<SyncLogPage> {
    const db = await getDb();
    const offset = Math.max(0, page) * pageSize;
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const keyword = search.trim();
    if (keyword) {
      params.push(`%${escapeLike(keyword)}%`);
      conditions.push(`event_name LIKE $${params.length} ESCAPE '\\'`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;
    const [items, countRows] = await Promise.all([
      db.select<SyncLog[]>(
        `SELECT id, path, task_name AS taskName, event_name AS eventName,
              status, message,
              created_at AS createdAt
       FROM log
       ${where}
       ORDER BY id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
        [...params, pageSize, offset],
      ),
      db.select<CountRow[]>(
        `SELECT COUNT(*) AS total FROM log ${where}`,
        params,
      ),
    ]);
    return {
      items,
      total: countRows[0]?.total ?? 0,
    };
  },

  /** 删除全部同步日志。 */
  async clear(): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM log");
  },

  /** 删除超出最大保留数量的旧日志，0 表示不限制。 */
  async trim(maxCount: number): Promise<void> {
    if (maxCount === 0) {
      return;
    }

    const db = await getDb();
    await db.execute(
      `DELETE FROM log
     WHERE id IN (
       SELECT id
       FROM log
       ORDER BY id DESC
       LIMIT -1 OFFSET $1
     )`,
      [maxCount],
    );
  },
};

export { logService };

/** 转义 SQLite LIKE 查询中的通配字符。 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
