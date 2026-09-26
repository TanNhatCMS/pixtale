// 这个模块定义存储配置相关枚举值。

/** 存储类型：本地存储 / 对象存储。 */
const StorageTypeEnum = {
  LOCAL: 1,
  OBJECT_STORAGE: 2,
} as const;

type StorageType = (typeof StorageTypeEnum)[keyof typeof StorageTypeEnum];

export { StorageTypeEnum };
export type { StorageType };
