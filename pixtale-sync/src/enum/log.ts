// 这个模块定义同步日志相关枚举值。

/** 日志执行状态：成功 / 失败。 */
const LogStatusEnum = {
  SUCCESS: 1,
  FAILURE: 2,
} as const;

type LogStatus = (typeof LogStatusEnum)[keyof typeof LogStatusEnum];

export { LogStatusEnum };
export type { LogStatus };
