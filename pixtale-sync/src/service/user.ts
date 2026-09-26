import { getDb } from "../lib/db";

// 用户业务：持久化并读取最近使用的登录用户。

export type User = {
  userId: string;
  username: string;
  avatar: string;
  type: number;
  token: string;
  endpoint: string;
};

const userService = {
  /** 查询最近添加的本地用户。 */
  async get(): Promise<User | null> {
    const db = await getDb();
    const rows = await db.select<User[]>(
      "SELECT user_id AS userId, username, avatar, type, token, endpoint FROM user ORDER BY rowid DESC LIMIT 1",
    );
    return rows[0] ?? null;
  },

  /** 按用户 id 新增或更新本地用户。 */
  async add(user: User): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO user (user_id, username, avatar, type, token, endpoint)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       avatar = excluded.avatar,
       type = excluded.type,
       token = excluded.token,
       endpoint = excluded.endpoint`,
      [
        user.userId,
        user.username,
        user.avatar,
        user.type,
        user.token,
        user.endpoint,
      ],
    );
  },

  /** 删除本地保存的用户信息。 */
  async remove(userId: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM user WHERE user_id = $1", [userId]);
  },
};

export { userService };
