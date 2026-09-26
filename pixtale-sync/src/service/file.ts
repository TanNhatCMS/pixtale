import { invoke } from "@tauri-apps/api/core";
import { TaskTypeEnum, type TaskType } from "../enum/task";

// 文件扫描业务：按任务类型读取主路径或第一层子目录中的图片。

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
  ): Promise<ScannedDirectory[]> {
    if (taskType !== TaskTypeEnum.SUBDIRECTORY) {
      return [{ name, path, files: await readFiles(path) }];
    }

    const directories = await invoke<Subdirectory[]>("read_subdirectories", {
      path,
    });
    return Promise.all(
      directories.map(async (directory) => ({
        ...directory,
        files: await readFiles(directory.path),
      })),
    );
  },
};

export { fileService };

/** 读取一个目录当前层的图片元数据。 */
async function readFiles(path: string): Promise<DirectoryFile[]> {
  return invoke<DirectoryFile[]>("read_directory_files", { path });
}
