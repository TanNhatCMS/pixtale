import {
  TaskStatusEnum,
  TaskTypeEnum,
  type TaskStatus,
  type TaskType,
} from "../enum/task";
import { getDb } from "../lib/db";
import { useTaskStore } from "../store/task";
import { fileService } from "./file";

// 同步任务业务：管理任务数据、文件统计和同步进度。

export type Task = {
  id: number;
  userId: string;
  name: string;
  path: string;
  taskType: TaskType;
  storageId: string;
  storageName: string;
  itemCount: number;
  itemSize: number;
  completedCount: number;
  completedSize: number;
  taskStatus: TaskStatus;
  lastSyncAt: string | null;
  sortAt: number | null;
  createdAt: string;
};

const taskService = {
  /** 查询指定用户的全部同步任务。 */
  async list(userId: string): Promise<Task[]> {
    if (!userId) {
      return [];
    }

    try {
      const db = await getDb();
      return await db.select<Task[]>(
        `SELECT task.id, task.user_id AS userId,
              task.name, task.path,
              task.task_type AS taskType,
              task.storage_id AS storageId,
              COALESCE(storage.name, '') AS storageName,
              task.item_count AS itemCount,
              task.item_size AS itemSize,
              task.completed_count AS completedCount,
              task.completed_size AS completedSize,
              task.task_status AS taskStatus,
              task.last_sync_at AS lastSyncAt,
              task.sort_at AS sortAt,
              task.created_at AS createdAt
       FROM task
       LEFT JOIN storage ON storage.storage_id = task.storage_id
       WHERE task.user_id = $1
       ORDER BY
         CASE WHEN task.sort_at IS NULL THEN 1 ELSE 0 END,
         task.sort_at DESC,
         task.created_at ASC,
         task.id ASC`,
        [userId],
      );
    } catch {
      return [];
    }
  },

  /** 判断指定用户的本地路径是否已经被其他同步任务使用。 */
  async exists(path: string, userId: string): Promise<boolean> {
    const db = await getDb();
    const normalized = path.trim().replace(/[\\/]+$/, "");
    const rows = await db.select<Array<{ total: number }>>(
      `SELECT COUNT(*) AS total
     FROM task
     WHERE user_id = $1
       AND LOWER(RTRIM(path, '\\/')) = LOWER($2)`,
      [userId, normalized],
    );
    return (rows[0]?.total ?? 0) > 0;
  },

  /** 新增一条同步任务。 */
  async add(
    path: string,
    storageId: string,
    userId: string,
    taskType: TaskType = TaskTypeEnum.MAIN,
  ): Promise<void> {
    const db = await getDb();
    const taskName = getTaskName(path);
    const result = await db.execute(
      `INSERT INTO task (
       user_id, name, path, task_type, storage_id, item_count, item_size,
       completed_count, completed_size
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0)`,
      [userId, taskName, path, taskType, storageId, 0, 0],
    );

    if (result.lastInsertId !== undefined) {
      const taskId = result.lastInsertId;
      void useTaskStore.getState().refresh();

      // 后台扫描新任务，完成后回写文件数量和总大小。
      void fileService.scan(path, taskName, taskType, storageId)
        .then(async (directories) => {
          const files = directories.flatMap((directory) => directory.files);
          const itemSize = files.reduce((total, file) => total + file.size, 0);
          await taskService.updateProgress(taskId, files.length, itemSize, 0, 0);
          await useTaskStore.getState().refresh();
        })
        .catch((error) => {
          console.error(`读取任务目录失败：${path}`, error);
        });
    }
  },

  /** 根据 id 删除同步任务。 */
  async remove(id: number): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM task WHERE id = $1", [id]);
  },

  /** 使用当前时间戳将指定任务置顶。 */
  async pin(id: number): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE task SET sort_at = $1 WHERE id = $2", [
      Date.now(),
      id,
    ]);
  },

  /** 更新任务的项目总量和当前完成进度。 */
  async updateProgress(
    id: number,
    itemCount: number,
    itemSize: number,
    completedCount: number,
    completedSize: number,
  ): Promise<void> {
    const db = await getDb();
    await db.execute(
      `UPDATE task
     SET item_count = $1,
         item_size = $2,
         completed_count = $3,
         completed_size = $4
     WHERE id = $5`,
      [itemCount, itemSize, completedCount, completedSize, id],
    );
  },

  /** 单个文件同步成功后递增任务完成数量和大小。 */
  async increaseProgress(id: number, size: number): Promise<void> {
    const db = await getDb();
    await db.execute(
      `UPDATE task
     SET completed_count = completed_count + 1,
         completed_size = completed_size + $1
     WHERE id = $2`,
      [size, id],
    );
  },

  /** 更新单个同步任务的运行状态。 */
  async updateTaskStatus(
    id: number,
    status: TaskStatus,
  ): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE task SET task_status = $1 WHERE id = $2", [
      status,
      id,
    ]);
  },

  /** 将全部同步任务更新为指定状态。 */
  async updateAllTaskStatus(status: TaskStatus): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE task SET task_status = $1", [status]);
  },

  /** 记录指定任务最近一次完整同步的完成时间。 */
  async updateLastSyncAt(id: number): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE task SET last_sync_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = $1",
      [id],
    );
  },

  /** 判断是否存在正在同步的任务。 */
  async hasRunningTask(): Promise<boolean> {
    const db = await getDb();
    const rows = await db.select<Array<{ total: number }>>(
      "SELECT COUNT(*) AS total FROM task WHERE task_status = $1",
      [TaskStatusEnum.SYNCING],
    );
    return (rows[0]?.total ?? 0) > 0;
  },
};

export { taskService };

/** 从任务路径末尾提取默认任务名称。 */
function getTaskName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  return normalized.split(/[\\/]/).pop() || normalized;
}
