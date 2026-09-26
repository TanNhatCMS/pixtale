import { invoke } from "@tauri-apps/api/core";
import { TaskStatusEnum } from "../enum/task";
import { LogStatusEnum } from "../enum/log";
import { SyncTaskStatusEnum } from "../enum/settings";
import { add as addPhoto } from "../request/photo";
import { check, getConfig, type SyncConfig, type SyncFile } from "../request/sync";
import { useTaskStore } from "../store/task";
import { taskService } from "./task";
import { fileService, type DirectoryFile } from "./file";
import { logService } from "./log";
import { settingsService } from "./settings";
import { userService } from "./user";
import { storageService } from "./storage";

// 同步业务：按数据库中的目录顺序扫描并输出文件元数据。

type SyncConfigIds = {
  storageId: string;
  albumIds: Map<string, string>;
};

type UploadFile = {
  path: string;
  albumName: string;
  file: DirectoryFile;
};

const syncRequestRetryCount = 2;
const maxUploadConcurrency = 20;
const uploadConcurrencyPollInterval = 2000;
const imageMimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  tif: "image/tiff",
  tiff: "image/tiff",
};
let syncController: AbortController | null = null;
let syncPromise: Promise<void> | null = null;

const syncService = {
  /** 开始一次同步，同一时间只允许一个同步流程运行。 */
  sync(): Promise<void> {
    if (syncPromise) {
      return syncPromise;
    }

    const controller = new AbortController();
    syncController = controller;
    const operation = runSync(controller.signal).finally(() => {
      if (syncPromise === operation) {
        syncPromise = null;
        syncController = null;
      }
    });
    syncPromise = operation;
    return operation;
  },

  /** 停止当前循环和上传请求，完成退出后再恢复关闭状态。 */
  async stopSync(): Promise<void> {
    const operation = syncPromise;
    syncController?.abort();

    if (operation) {
      await operation;
      return;
    }

    await taskService.updateAllTaskStatus(TaskStatusEnum.WAITING);
    await settingsService.updateTaskStatus(SyncTaskStatusEnum.DISABLED);
    await useTaskStore.getState().refresh();
  },
};

export { syncService };

/** 校验任务存储和远端相册配置并提取对应 id。 */
function getConfigIds(
  config: SyncConfig,
  albumNames: string[],
  storageId: string,
): SyncConfigIds {
  if (!storageId) {
    throw new Error("Storage configuration not found");
  }

  const albumIds = new Map(
    config.album.map((album) => [album.name, album.albumId]),
  );

  if (albumNames.some((name) => !albumIds.has(name))) {
    throw new Error("Album configuration not found");
  }

  return {
    storageId,
    albumIds,
  };
}

/** 计算文件列表的总字节数。 */
function getTotalSize(files: SyncFile[]): number {
  return files.reduce((total, file) => total + file.size, 0);
}

/** 将未知异常转换为可写入日志的消息。 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 根据文件扩展名取得上传时使用的 MIME 类型。 */
function getImageMimeType(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return imageMimeTypes[extension] ?? "application/octet-stream";
}

/** 请求失败时最多额外重试两次，主动停止时不重试。 */
async function retryRequest<T>(
  action: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  let retryCount = 0;

  while (true) {
    try {
      return await action();
    } catch (error) {
      if (signal?.aborted || retryCount >= syncRequestRetryCount) {
        throw error;
      }
      retryCount += 1;
    }
  }
}

/** 执行同步事件并记录失败日志，可按需记录成功日志。 */
async function runLoggedEvent<T>(
  taskName: string,
  eventName: string,
  path: string,
  action: () => Promise<T>,
  logSuccess = true,
): Promise<T> {
  try {
    const result = await action();
    if (logSuccess) {
      await logService.add(taskName, eventName, path, LogStatusEnum.SUCCESS);
    }
    return result;
  } catch (error) {
    await logService.add(
      taskName,
      eventName,
      path,
      LogStatusEnum.FAILURE,
      getErrorMessage(error),
    );
    throw error;
  }
}

/** 读取本地文件并构造照片上传表单。 */
async function createPhotoForm(
  path: string,
  file: DirectoryFile,
  storageId: string,
  albumId: string,
): Promise<FormData> {
  const content = await invoke<ArrayBuffer>("read_file", {
    path,
    name: file.name,
  });
  const photo = new File([content], file.name, {
    lastModified: file.modifiedAt,
    type: getImageMimeType(file.name),
  });
  const form = new FormData();
  form.append("file", photo);
  form.append("albumId", albumId);
  form.append("storageId", storageId);
  form.append("lastModified", String(photo.lastModified));
  return form;
}

/** 上传文件失败时复用通用重试逻辑。 */
async function uploadPhoto(
  form: FormData,
  signal: AbortSignal,
): Promise<void> {
  await retryRequest(() => addPhoto(form, signal), signal);
}

/** 按当前设置动态并发上传缺失文件。 */
async function uploadFiles(
  taskId: number,
  taskName: string,
  files: UploadFile[],
  config: SyncConfigIds,
  signal: AbortSignal,
): Promise<void> {
  const refresh = useTaskStore.getState().refresh;
  let activeUploads = 0;
  let nextIndex = 0;

  /** 等待下一次并发设置检查。 */
  function waitForConcurrencyUpdate(): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, uploadConcurrencyPollInterval);
    });
  }

  /** 上传队列中的一个文件并记录结果。 */
  async function uploadItem(item: UploadFile): Promise<void> {
    try {
      const albumId = config.albumIds.get(item.albumName);
      if (!albumId) {
        throw new Error(`未找到相册配置：${item.albumName}`);
      }
      const form = await createPhotoForm(
        item.path,
        item.file,
        config.storageId,
        albumId,
      );
      await uploadPhoto(form, signal);
      await taskService.increaseProgress(taskId, item.file.size);
      await refresh();
      await logService.add(
        taskName,
        item.file.name,
        item.file.path,
        LogStatusEnum.SUCCESS,
      );
    } catch (error) {
      if (signal.aborted) {
        return;
      }

      // 单个文件失败时跳过，当前调度器继续领取下一个文件。
      await logService.add(
        taskName,
        item.file.name,
        item.file.path,
        LogStatusEnum.FAILURE,
        getErrorMessage(error),
      );
      console.error(`同步文件失败：${item.file.name}`, error);
    }
  }

  /** 持续领取文件，并在领取前读取最新并发设置。 */
  async function worker() {
    while (!signal.aborted && nextIndex < files.length) {
      const settings = await settingsService.get();
      const uploadConcurrency = Math.min(
        maxUploadConcurrency,
        settings.uploadConcurrency,
      );

      if (activeUploads >= uploadConcurrency) {
        await waitForConcurrencyUpdate();
        continue;
      }

      const item = files[nextIndex];
      nextIndex += 1;
      activeUploads += 1;

      try {
        await uploadItem(item);
      } finally {
        activeUploads -= 1;
      }
    }
  }

  // 预先创建最多 20 个 worker；实际领取数量由最新设置控制。
  const workerCount = Math.min(maxUploadConcurrency, files.length);
  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );
}

/** 按顺序检查全部目录，并发上传远端不存在的照片。 */
async function runDirectories(signal: AbortSignal): Promise<void> {
  const user = await userService.get();
  const directories = await taskService.list(user?.userId ?? "");
  const refresh = useTaskStore.getState().refresh;

  for (const directory of directories) {
    if (signal.aborted) {
      break;
    }

    await taskService.updateTaskStatus(directory.id, TaskStatusEnum.SYNCING);
    await refresh();

    try {
      const scannedDirectories = await fileService.scan(
        directory.path,
        directory.name,
        directory.taskType,
      ).catch(
        /** 目录读取失败时清零总量和完成进度并记录日志，随后跳过当前任务。 */
        async (error: unknown) => {
          if (!signal.aborted) {
            await taskService.updateProgress(
              directory.id,
              0,
              0,
              0,
              0,
            );
            await logService.add(
              directory.name,
              "读取目录",
              directory.path,
              LogStatusEnum.FAILURE,
              getErrorMessage(error),
            );
          }
          throw error;
        },
      );

      const files = scannedDirectories.flatMap((item) => item.files);
      const missingFiles = await runLoggedEvent(
        directory.name,
        "检查文件差异",
        directory.path,
        () =>
          retryRequest(() =>
            check(
              files.map(({ name, size }) => ({ name, size })),
              { showError: false },
            ),
          ),
      );
      const itemSize = getTotalSize(files);
      const missingSize = getTotalSize(missingFiles);
      const completedCount = Math.max(0, files.length - missingFiles.length);
      const completedSize = Math.max(0, itemSize - missingSize);

      await taskService.updateProgress(
        directory.id,
        files.length,
        itemSize,
        completedCount,
        completedSize,
      );
      await refresh();

      // 文件全部同步后无需读取配置，直接完成当前任务。
      if (missingFiles.length === 0) {
        if (!signal.aborted) {
          await taskService.updateLastSyncAt(directory.id);
        }
        continue;
      }

      const albumNames = scannedDirectories
        .filter((item) => item.files.length > 0)
        .map((item) => item.name);
      const remoteConfig = await runLoggedEvent(
        directory.name,
        "读取系统配置",
        directory.path,
        () =>
          retryRequest(() =>
            getConfig(
              { albumName: albumNames, storageId: directory.storageId },
              { showError: false },
            ),
          ),
        false,
      );

      if (!remoteConfig.storageExists) {
        await logService.add(
          directory.name,
          "读取储存",
          directory.path,
          LogStatusEnum.FAILURE,
          "储存不可用",
        );
        try {
          await storageService.refresh();
        } catch (error) {
          console.error("刷新存储缓存失败", error);
        }
        continue;
      }

      const storages = await storageService.list();
      if (!storages.some((storage) => storage.storageId === directory.storageId)) {
        try {
          await storageService.refresh();
        } catch (error) {
          console.error("刷新存储缓存失败", error);
        }
      }

      const config = await runLoggedEvent(
        directory.name,
        "读取相册",
        directory.path,
        async () => getConfigIds(remoteConfig, albumNames, directory.storageId),
        false,
      );

      // 用接口返回的缺失文件数量逐项匹配扫描结果，保留其目录和目标相册。
      const missingCounts = new Map<string, number>();
      for (const file of missingFiles) {
        const key = `${file.name}\0${file.size}`;
        missingCounts.set(key, (missingCounts.get(key) ?? 0) + 1);
      }
      const uploadQueue = scannedDirectories.flatMap((item) =>
        item.files.flatMap((file) => {
          const key = `${file.name}\0${file.size}`;
          const count = missingCounts.get(key) ?? 0;
          if (count === 0) {
            return [];
          }
          missingCounts.set(key, count - 1);
          return [{ path: item.path, albumName: item.name, file }];
        }),
      );
      await uploadFiles(
        directory.id,
        directory.name,
        uploadQueue,
        config,
        signal,
      );
      if (!signal.aborted) {
        await taskService.updateLastSyncAt(directory.id);
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error(`同步任务失败，跳过任务：${directory.name}`, error);
      }
    } finally {
      await taskService.updateTaskStatus(directory.id, TaskStatusEnum.WAITING);
      await refresh();
    }
  }
}

/** 执行一次完整同步，并按定时设置决定结束后的开关状态。 */
async function runSync(signal: AbortSignal): Promise<void> {
  const refresh = useTaskStore.getState().refresh;
  await settingsService.updateTaskStatus(SyncTaskStatusEnum.ENABLED);

  try {
    await taskService.updateAllTaskStatus(TaskStatusEnum.WAITING);
    await refresh();
    await runDirectories(signal);
    if (!signal.aborted) {
      await settingsService.updateLastSyncAt();
      const latestSettings = await settingsService.get();
      await logService.trim(latestSettings.logMaxCount);
    }
  } catch (error) {
    if (!signal.aborted) {
      throw error;
    }
  } finally {
    await taskService.updateAllTaskStatus(TaskStatusEnum.WAITING);
    const latestSettings = await settingsService.get();
    const shouldRemainEnabled =
      !signal.aborted && latestSettings.taskInterval !== 0;
    await settingsService.updateTaskStatus(
      shouldRemainEnabled
        ? SyncTaskStatusEnum.ENABLED
        : SyncTaskStatusEnum.DISABLED,
    );
    await refresh();
  }
}
