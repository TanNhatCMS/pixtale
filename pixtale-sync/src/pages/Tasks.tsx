import { useEffect } from "react";
import { RiFolderFill } from "@remixicon/react";
import { invoke } from "@tauri-apps/api/core";
import { MoreHorizontal, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { TaskStatusEnum, TaskTypeEnum } from "../enum/task";
import { Button } from "../components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { taskService, type Task } from "../service/task";
import { useTaskStore } from "../store/task";

// 同步任务页：展示任务进度和目录配置。

type Props = {
  // 全局同步是否处于开启状态。
  syncEnabled: boolean;
};

/** 将字节数格式化为易读的存储大小。 */
function formatSize(size: number): string {
  if (size <= 0) {
    return "0B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  );
  const value = size / 1024 ** unitIndex;
  return `${unitIndex === 0 ? Math.round(value) : value.toFixed(2)}${units[unitIndex]}`;
}

/** 根据完成大小计算整数同步百分比。 */
function getProgress(item: Task): number {
  if (item.itemSize <= 0) {
    return 0;
  }
  return Math.min(100, Math.floor((item.completedSize / item.itemSize) * 100));
}

/** 将任务最近同步时间格式化为月/日 时:分。 */
function formatSyncTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

/** 同步任务页。 */
export default function Tasks({ syncEnabled }: Props) {
  const items = useTaskStore((state) => state.items);
  const refresh = useTaskStore((state) => state.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 删除指定同步目录并刷新列表。 */
  async function deleteItem(id: number) {
    await taskService.remove(id);
    await refresh();
  }

  /** 将指定同步目录更新为最近置顶并刷新列表。 */
  async function pinItem(id: number) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await taskService.pin(id);
    await refresh();
  }

  /** 使用系统文件管理器打开任务目录。 */
  async function openDirectory(path: string) {
    try {
      await invoke("open_directory", { path });
    } catch (error) {
      console.error(`打开目录失败：${path}`, error);
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <Card key={item.id} className="gap-0 rounded-md py-0">
          <CardHeader className="border-b bg-[#fafafa] pt-3 !pb-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-sm text-[#fbc02d] outline-none transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => void openDirectory(item.path)}
              >
                <RiFolderFill className="size-9" />
                {item.taskStatus === TaskStatusEnum.SYNCING ? (
                  <span className="absolute right-[-3px] bottom-[-3px] flex size-5 items-center justify-center rounded-full bg-background text-primary shadow-sm">
                    <RefreshCw className="size-3.5 animate-spin" />
                  </span>
                ) : null}
              </button>
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate">
                  {item.name || item.path}
                </CardTitle>
                <CardDescription className="truncate">
                  <span className="truncate">
                    {item.taskStatus === TaskStatusEnum.SYNCING
                      ? "正在同步"
                      : syncEnabled
                        ? "等待同步"
                        : "同步暂停"}{" "}
                    <span
                      className={
                        getProgress(item) === 100
                          ? "text-emerald-600"
                          : "text-blue-600"
                      }
                    >
                      {getProgress(item)}%
                    </span>
                    <span className="pr-3"></span>
                    　共{item.itemCount}项目（
                    {formatSize(item.itemSize)}）　传输完成
                    {item.completedCount}项（{formatSize(item.completedSize)}）
                  </span>
                </CardDescription>
              </div>
            </div>
            <CardAction>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="任务操作"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void pinItem(item.id)}>
                    置顶
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => void deleteItem(item.id)}
                  >
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardAction>
          </CardHeader>
          <CardContent className="py-4">
            <div className="grid grid-cols-[minmax(0,8fr)_minmax(0,4fr)_minmax(0,2fr)] gap-x-10 gap-y-2">
              <div className="font-medium">
                本地路径（{item.taskType === TaskTypeEnum.SUBDIRECTORY ? "子目录" : "主目录"}）
              </div>
              <div className="font-medium">存储空间</div>
              <div className="font-medium">上次同步</div>
              <div
                className="truncate text-muted-foreground/60"
                title={item.path}
              >
                {item.path}
              </div>
              <div
                className="truncate text-muted-foreground/60"
                style={{ color: item.storageName ? undefined : "#dc2626" }}
                title={item.storageName || "不可用"}
              >
                {item.storageName || "不可用"}
              </div>
              <div className="truncate text-muted-foreground/60">
                {formatSyncTime(item.lastSyncAt)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
