import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { TaskTypeEnum, type TaskType } from "../enum/task";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { taskService } from "../service/task";
import { storageService, type Storage } from "../service/storage";
import { userService } from "../service/user";
import { useTaskStore } from "../store/task";

// 添加任务弹窗：选择同步路径、存储和任务类型。

type Props = {
  open: boolean;
  onClose: () => void;
};

/** 添加同步任务弹窗。 */
export default function AddTaskModal({ open, onClose }: Props) {
  const [path, setPath] = useState("");
  const [storageId, setStorageId] = useState("");
  const [storages, setStorages] = useState<Storage[]>([]);
  const [taskType, setTaskType] = useState("1");
  const refresh = useTaskStore((state) => state.refresh);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setPath("");
    setStorageId("");
    setTaskType(String(TaskTypeEnum.MAIN));

    /** 先展示本地缓存，再使用服务端数据刷新存储选项。 */
    async function loadStorages() {
      const cached = await storageService.list();
      if (!cancelled) {
        setStorages(cached);
      }

      try {
        const latest = await storageService.refresh();
        if (!cancelled) {
          setStorages(latest);
        }
      } catch {
        // 请求层已经提示错误，继续保留本地缓存数据。
      }
    }

    void loadStorages();
    return () => {
      cancelled = true;
    };
  }, [open]);

  /** 打开系统目录选择框，选中后写入路径。 */
  async function pickDirectory() {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "选择文件夹",
      });
      if (typeof selected === "string") {
        setPath(selected);
      }
    } catch {
      // 纯网页预览没有 Tauri 插件，忽略。
    }
  }

  /** 确认后立即关闭弹框，再写入 SQLite 并刷新列表。 */
  async function handleOk() {
    const nextPath = path.trim();
    const storage = storages.find((item) => item.storageId === storageId);
    if (!nextPath || !storage) {
      return;
    }

    const user = await userService.get();
    const userId = user?.userId ?? "";
    if (await taskService.exists(nextPath, userId)) {
      toast.error("路径已被其他任务使用");
      return;
    }

    onClose();
    await taskService.add(
      nextPath,
      storage.storageId,
      userId,
      Number(taskType) as TaskType,
    );
    await refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加目录</DialogTitle>
          <DialogDescription className="sr-only">
            选择需要同步的本地目录和同步方式
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              value={path}
              placeholder="目录路径"
              onChange={(event) => setPath(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={pickDirectory}>
              选择
            </Button>
          </div>
          <Select value={storageId} onValueChange={setStorageId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="请选择存储空间" />
            </SelectTrigger>
            <SelectContent>
              {storages.map((storage) => (
                <SelectItem key={storage.storageId} value={storage.storageId}>
                  {storage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <RadioGroup
            className="flex gap-5"
            value={taskType}
            onValueChange={setTaskType}
          >
            <Label className="flex cursor-pointer items-center gap-2">
            <RadioGroupItem value={String(TaskTypeEnum.MAIN)} />
              主目录
            </Label>
            <Label className="flex cursor-pointer items-center gap-2">
            <RadioGroupItem value={String(TaskTypeEnum.SUBDIRECTORY)} />
              子目录
            </Label>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!path.trim() || !storageId}
            onClick={handleOk}
          >
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
