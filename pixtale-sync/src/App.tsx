import { useEffect, useState } from "react";
import {
  CirclePlus,
  FileText,
  List,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  Square,
  Trash2,
} from "lucide-react";
import AddTaskModal from "./components/AddTaskModal";
import NavUser from "./components/NavUser";
import SiteHeader from "./components/SiteHeader";
import TitleBar from "./components/TitleBar";
import { Button } from "./components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "./components/ui/sidebar";
import Settings from "./pages/Settings";
import SyncLogs from "./pages/SyncLogs";
import Tasks from "./pages/Tasks";
import { taskService } from "./service/task";
import { logService } from "./service/log";
import { TaskStatusEnum } from "./enum/task";
import { SyncTaskStatusEnum } from "./enum/settings";
import { schedulerService } from "./service/scheduler";
import { settingsService } from "./service/settings";
import { syncService } from "./service/sync";
import { userService } from "./service/user";
import { useTaskStore } from "./store/task";
import { useLogStore } from "./store/log";

// 应用壳：管理侧栏切页与同步任务操作。

type PageKey = "tasks" | "logs" | "settings";

const items = [
  { key: "tasks" as const, icon: List, label: "同步任务" },
  { key: "logs" as const, icon: FileText, label: "同步日志" },
  { key: "settings" as const, icon: SettingsIcon, label: "设置" },
];

const titles: Record<PageKey, string> = {
  tasks: "同步任务",
  logs: "同步日志",
  settings: "设置",
};

/** 按当前菜单渲染对应页面。 */
function renderPage(
  page: PageKey,
  logVersion: number,
  syncEnabled: boolean,
) {
  switch (page) {
    case "tasks":
      return <Tasks syncEnabled={syncEnabled} />;
    case "logs":
      return <SyncLogs key={logVersion} />;
    case "settings":
      return <Settings />;
  }
}

/** 带侧栏的应用壳。 */
function App() {
  const [page, setPage] = useState<PageKey>("tasks");
  const [addOpen, setAddOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [logVersion, setLogVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    /** 重置遗留任务状态并恢复数据库中的同步开关。 */
    async function initializeSync() {
      await taskService.updateAllTaskStatus(TaskStatusEnum.WAITING);
      await useTaskStore.getState().refresh();
      const settings = await settingsService.get();
      const syncEnabled =
        settings.taskInterval !== 0 &&
        settings.taskStatus === SyncTaskStatusEnum.ENABLED;
      if (settings.taskInterval === 0) {
        await settingsService.updateTaskStatus(SyncTaskStatusEnum.DISABLED);
      }
      if (!cancelled) {
        setSyncEnabled(syncEnabled);
        schedulerService.startScheduler();
      }
    }

    void initializeSync();
    return () => {
      cancelled = true;
      schedulerService.stopScheduler();
    };
  }, []);

  /** 根据当前状态开始或停止全部同步任务。 */
  async function handleSync() {
    if (syncEnabled) {
      setStopping(true);
      try {
        await syncService.stopSync();
      } finally {
        setStopping(false);
        setSyncEnabled(false);
      }
      return;
    }

    const user = await userService.get();
    if (!user?.endpoint || !user.token) {
      setLoginOpen(true);
      return;
    }

    setSyncEnabled(true);
    try {
      await syncService.sync();
    } catch (error) {
      console.error("同步失败", error);
    } finally {
      const settings = await settingsService.get();
      setSyncEnabled(settings.taskStatus === SyncTaskStatusEnum.ENABLED);
    }
  }

  /** 登录有效时打开新建任务弹框，否则先打开登录弹框。 */
  async function handleAddTask() {
    const user = await userService.get();
    if (!user?.endpoint || !user.token) {
      setLoginOpen(true);
      return;
    }

    setAddOpen(true);
  }

  /** 清空全部同步日志并刷新日志页面。 */
  async function handleClearLogs() {
    await logService.clear();
    setLogVersion((version) => version + 1);
  }

  /** 清空搜索并返回第一页，保留状态筛选后重新加载日志。 */
  function handleRefreshLogs() {
    useLogStore.getState().setSearch("");
    setLogVersion((version) => version + 1);
  }

  return (
    <SidebarProvider className="h-svh min-h-0 pt-8">
      <TitleBar />
      <Sidebar
        collapsible="icon"
        className="top-8 h-[calc(100svh-2rem)]"
      >
        <SidebarContent className="pt-2">
          <SidebarGroup>
            <SidebarGroupContent className="flex flex-col gap-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    tooltip="新建任务"
                    className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                    onClick={() => void handleAddTask()}
                  >
                    <CirclePlus />
                    <span>新建任务</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.key} className="pb-1">
                    <SidebarMenuButton
                      type="button"
                      isActive={page === item.key}
                      tooltip={item.label}
                      onClick={() => setPage(item.key)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser
            loginOpen={loginOpen}
            onLoginOpenChange={setLoginOpen}
            onLogout={() => setSyncEnabled(false)}
          />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="h-[calc(100svh-2rem)] min-w-0 overflow-hidden bg-background">
        <SiteHeader
          title={titles[page]}
          actions={page === "tasks" ? (
            <div key="tasks" className="flex items-center gap-2">
              <Button onClick={handleSync} disabled={stopping}>
                {syncEnabled ? <Square /> : <Play />}
                {syncEnabled ? "停止同步" : "开始同步"}
              </Button>
            </div>
          ) : page === "logs" ? (
            <div key="logs" className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void handleClearLogs()}>
                <Trash2 />
                清空
              </Button>
              <Button onClick={handleRefreshLogs}>
                <RefreshCw />
                刷新
              </Button>
            </div>
          ) : undefined}
        />
        <main className="min-h-0 flex-1 overflow-auto p-4">
          {renderPage(page, logVersion, syncEnabled)}
        </main>
      </SidebarInset>
      <AddTaskModal open={addOpen} onClose={() => setAddOpen(false)} />
    </SidebarProvider>
  );
}

export default App;
