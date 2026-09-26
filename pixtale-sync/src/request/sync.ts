import { post } from "./request";
import type { RequestConfig } from "./request";

// 同步请求：检查远端照片库中尚不存在的文件。

export type SyncFile = {
  name: string;
  size: number;
};

type SyncConfigParams = {
  albumName: string[];
  storageId: string;
};

export type SyncConfig = {
  storageExists: boolean;
  album: Array<{
    albumId: string;
    name: string;
  }>;
};

/** 查询同步所需的相册配置并校验指定存储是否存在。 */
export function getConfig(
  params: SyncConfigParams,
  config?: RequestConfig,
): Promise<SyncConfig> {
  return post<SyncConfig>("/api/sync/getConfig", params, config);
}

/** 返回远端照片库中不存在的文件。 */
export function check(
  files: SyncFile[],
  config?: RequestConfig,
): Promise<SyncFile[]> {
  return post<SyncFile[]>("/api/sync/check", files, config);
}
