import Database from "@tauri-apps/plugin-sql";

// 数据库连接：所有业务 service 复用同一个 SQLite 连接。

let database: Database | null = null;

/** 延迟加载并缓存应用 SQLite 数据库连接。 */
export async function getDb(): Promise<Database> {
  if (!database) {
    database = await Database.load("sqlite:pixtale.db");
  }
  return database;
}
