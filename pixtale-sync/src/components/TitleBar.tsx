import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

// Tauri 自定义标题栏：提供窗口拖动和基础窗口操作。

const appWindow = getCurrentWindow();

/** 最小化当前应用窗口。 */
function minimizeWindow() {
  return appWindow.minimize();
}

/** 切换当前应用窗口的最大化状态。 */
function toggleMaximizeWindow() {
  return appWindow.toggleMaximize();
}

/** 隐藏当前窗口并让应用继续在系统托盘运行。 */
function hideWindow() {
  return appWindow.hide();
}

/** 渲染带指定背景色的桌面窗口标题栏。 */
export default function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="fixed inset-x-0 top-0 z-50 flex h-8 select-none items-center border-b border-border bg-white text-slate-800"
      onDoubleClick={() => void toggleMaximizeWindow()}
    >
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-2 px-2 text-xs"
      >
        <img
          src="/logo.png"
          alt=""
          className="pointer-events-none size-[20px] shrink-0 object-contain"
        />
        <span data-tauri-drag-region className="truncate text-sm">
          Pixtale Sync
        </span>
      </div>
      <div className="flex h-full items-stretch">
        <button
          type="button"
          className="flex w-11 items-center justify-center hover:bg-black/10"
          aria-label="最小化"
          onClick={() => void minimizeWindow()}
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          className="flex w-11 items-center justify-center hover:bg-black/10"
          aria-label="最大化"
          onClick={() => void toggleMaximizeWindow()}
        >
          <Square className="size-3" />
        </button>
        <button
          type="button"
          className="flex w-11 items-center justify-center hover:bg-red-600 hover:text-white"
          aria-label="缩小到系统托盘"
          onClick={() => void hideWindow()}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
