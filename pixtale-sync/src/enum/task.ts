// 这个模块定义同步目录相关枚举值。

/** 目录扫描范围：主目录扫描自身，子目录扫描第一层子目录。 */
const TaskTypeEnum = {
  MAIN: 1,
  SUBDIRECTORY: 2,
} as const;

/** 目录任务运行状态：等待同步 / 正在同步。 */
const TaskStatusEnum = {
  WAITING: 1,
  SYNCING: 2,
} as const;

type TaskType = (typeof TaskTypeEnum)[keyof typeof TaskTypeEnum];
type TaskStatus =
  (typeof TaskStatusEnum)[keyof typeof TaskStatusEnum];

export { TaskTypeEnum, TaskStatusEnum };
export type { TaskType, TaskStatus };
