// 这个模块定义应用设置相关枚举值。

/** 全局同步任务状态：开启 / 关闭。 */
const SyncTaskStatusEnum = {
  ENABLED: 1,
  DISABLED: 2,
} as const;

type SyncTaskStatus = (typeof SyncTaskStatusEnum)[keyof typeof SyncTaskStatusEnum];

export { SyncTaskStatusEnum };
export type { SyncTaskStatus };
