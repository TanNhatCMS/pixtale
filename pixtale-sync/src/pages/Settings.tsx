import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { File, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { settingsService, type Settings } from "../service/settings";

// 设置页：管理任务同步、日志保留和上传并发配置。

const intervalOptions = [0, 3, 5, 10, 20, 30, 60, 120];
const logCountOptions = [0, 10000, 50000, 100000, 200000];

/** 返回同步间隔的显示文本。 */
function getIntervalLabel(value: number): string {
  return value === 0 ? "关闭" : `${value}分钟`;
}

/** 返回日志保留数量的显示文本。 */
function getLogCountLabel(value: number): string {
  if (value === 0) {
    return "无限";
  }
  return `${value / 10000}万条`;
}

/** 渲染设置页面。 */
export default function Settings() {
  // 当前持久化设置，未读取完成时不允许修改。
  const [settings, setSettings] = useState<Settings | null>(null);
  const [uploadConcurrency, setUploadConcurrency] = useState("");

  useEffect(() => {
    let cancelled = false;

    /** 从本地数据库加载设置。 */
    async function loadSettings() {
      const current = await settingsService.get();
      if (!cancelled) {
        setSettings(current);
        setUploadConcurrency(String(current.uploadConcurrency));
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 修改并保存任务同步间隔。 */
  async function changeTaskInterval(value: string) {
    const taskInterval = Number(value);
    await settingsService.updateTaskInterval(taskInterval);
    setSettings((current) => current && { ...current, taskInterval });
  }

  /** 修改并保存日志最大保留数量。 */
  async function changeLogMaxCount(value: string) {
    const logMaxCount = Number(value);
    await settingsService.updateLogMaxCount(logMaxCount);
    setSettings((current) => current && { ...current, logMaxCount });
  }

  /** 修改上传并发数并立即保存有效值。 */
  async function changeUploadConcurrency(value: string) {
    if (value === "") {
      setUploadConcurrency(value);
      return;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      return;
    }

    const nextValue = Math.min(20, Math.max(1, parsed));
    setUploadConcurrency(String(nextValue));
    await settingsService.updateUploadConcurrency(nextValue);
    setSettings((current) =>
      current ? { ...current, uploadConcurrency: nextValue } : current,
    );
  }

  /** 输入框失焦时恢复已保存的并发数。 */
  function restoreUploadConcurrency() {
    if (uploadConcurrency === "" && settings) {
      setUploadConcurrency(String(settings.uploadConcurrency));
    }
  }

  /** 使用系统文件管理器打开本地数据库所在目录。 */
  async function openDataDirectory() {
    try {
      await invoke("open_data_directory");
    } catch (error) {
      toast.error(error);
    }
  }

  /** 使用系统默认浏览器打开功能说明文档。 */
  async function openGuide() {
    try {
      await openUrl("https://022335.xyz/guide/sync.html");
    } catch (error) {
      toast.error(error);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl divide-y rounded-md border">
      <div className="flex min-h-16 items-center justify-between gap-6 px-4 py-3">
        <span className="text-sm font-medium">并发上传数量</span>
        <Input
          type="number"
          min={1}
          max={20}
          step={1}
          value={uploadConcurrency}
          className="w-32"
          onChange={(event) =>
            void changeUploadConcurrency(event.target.value)
          }
          onBlur={restoreUploadConcurrency}
        />
      </div>

      <div className="flex min-h-16 items-center justify-between gap-6 px-4 py-3">
        <span className="text-sm font-medium">定时同步间隔</span>
        <Select
          value={settings ? String(settings.taskInterval) : undefined}
          disabled={!settings}
          onValueChange={(value) => void changeTaskInterval(value)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {intervalOptions.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {getIntervalLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-h-16 items-center justify-between gap-6 px-4 py-3">
        <span className="text-sm font-medium">日志保留数量</span>
        <Select
          value={settings ? String(settings.logMaxCount) : undefined}
          disabled={!settings}
          onValueChange={(value) => void changeLogMaxCount(value)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {logCountOptions.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {getLogCountLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-h-16 items-center justify-between gap-6 px-4 py-3">
        <span className="text-sm font-medium">数据存放位置</span>
        <Button onClick={() => void openDataDirectory()}>
          <FolderOpen />
          打开目录
        </Button>
      </div>

      <div className="flex min-h-16 items-center justify-between gap-6 px-4 py-3">
        <span className="text-sm font-medium">功能说明</span>
        <Button onClick={() => void openGuide()}>
          <File />
          查看文档
        </Button>
      </div>
    </div>
  );
}
