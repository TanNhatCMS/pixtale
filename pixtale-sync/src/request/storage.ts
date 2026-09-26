import { post } from "./request";
import type { StorageType } from "../enum/storage";

// 存储请求：查询服务端可用于同步的存储配置。

export type StorageOption = {
  storageId: string;
  name: string;
  type: StorageType;
};

/** 查询全部正常状态的存储选项。 */
export function select(): Promise<StorageOption[]> {
  return post<StorageOption[]>("/api/storage/select", undefined, {
    showError: false,
  });
}
