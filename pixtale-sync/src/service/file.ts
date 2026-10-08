import { invoke } from "@tauri-apps/api/core";
import { TaskTypeEnum, type TaskType } from "../enum/task";
import { StorageTypeEnum } from "../enum/storage";
import { storageService } from "./storage";

// 文件扫描业务：按任务类型读取主路径或第一层子目录中的图片。

const telegramMaxFileSize = 19_900_000;

export type DirectoryFile = {
  name: string;
  path: string;
  type: string;
  size: number;
  modifiedAt: number;
};

export type ScannedDirectory = {
  name: string;
  path: string;
  files: DirectoryFile[];
};

type Subdirectory = {
  name: string;
  path: string;
};

const fileService = {
  /** 按任务类型扫描主目录或其第一层子目录。 */
  async scan(
    path: string,
    name: string,
    taskType: TaskType,
    storageId: string,
  ): Promise<ScannedDirectory[]> {
    const storages = await storageService.list();
    const storage = storages.find((item) => item.storageId === storageId);
    const maxFileSize =
      storage?.type === StorageTypeEnum.TELEGRAM
        ? telegramMaxFileSize
        : undefined;

    if (taskType !== TaskTypeEnum.SUBDIRECTORY) {
      return [{ name, path, files: await readFiles(path, maxFileSize) }];
    }

    const directories = await invoke<Subdirectory[]>("read_subdirectories", {
      path,
    });
    return Promise.all(
      directories.map(async (directory) => ({
        ...directory,
        files: await readFiles(directory.path, maxFileSize),
      })),
    );
  },
};

export { fileService };

/** 读取当前层图片元数据并按目标存储过滤超限文件。 */
async function readFiles(
  path: string,
  maxFileSize?: number,
): Promise<DirectoryFile[]> {
  const files = await invoke<DirectoryFile[]>("read_directory_files", { path });
  return maxFileSize === undefined
    ? files
    : files.filter((file) => file.size < maxFileSize);
}
