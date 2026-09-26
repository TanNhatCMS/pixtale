import { select, type StorageOption } from "../request/storage";
import { getDb } from "../lib/db";
import { useTaskStore } from "../store/task";

// 存储业务：缓存并刷新服务端可用的存储配置。

export type Storage = StorageOption;

const storageService = {
  /** 查询本地缓存的全部存储配置。 */
  async list(): Promise<Storage[]> {
    const db = await getDb();
    return db.select<Storage[]>(
      "SELECT storage_id AS storageId, name, type FROM storage ORDER BY rowid ASC",
    );
  },

  /** 从服务端刷新存储缓存并返回最新列表。 */
  async refresh(): Promise<Storage[]> {
    const items = await select();
    await replace(items);
    await useTaskStore.getState().refresh();
    return items;
  },
};

export { storageService };

/** 使用服务端最新数据完整替换本地存储缓存。 */
async function replace(items: Storage[]): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM storage");
  for (const item of items) {
    await db.execute(
      "INSERT INTO storage (storage_id, name, type) VALUES ($1, $2, $3)",
      [item.storageId, item.name, item.type],
    );
  }
}
