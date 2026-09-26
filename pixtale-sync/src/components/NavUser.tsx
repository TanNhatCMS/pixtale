import { useEffect, useRef, useState } from "react";
import {
  ChevronsUpDown,
  Loader2,
  LogOut,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar";
import { getUserAvatar, getUserInfo, login } from "../request/user";
import { storageService } from "../service/storage";
import { syncService } from "../service/sync";
import { userService, type User } from "../service/user";
import { useTaskStore } from "../store/task";
import { useUserStore } from "../store/user";

// 侧栏用户区域：处理本地用户展示、登录和退出登录。

type Props = {
  // 登录弹框是否打开。
  loginOpen: boolean;
  // 更新登录弹框的打开状态。
  onLoginOpenChange: (open: boolean) => void;
  // 退出登录后通知应用同步状态已关闭。
  onLogout: () => void;
};

/** 获取用户名的首个字符作为头像占位。 */
function getAvatarFallback(name: string): string {
  return Array.from(name.trim()).slice(0, 1).join("").toUpperCase() || "U";
}

/** 将头像二进制转换为可持久化显示的 data URL。 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("头像读取失败"));
    reader.readAsDataURL(blob);
  });
}

/** 渲染侧栏底部的用户信息和登录弹窗。 */
export default function NavUser({
  loginOpen,
  onLoginOpenChange,
  onLogout,
}: Props) {
  const { isMobile } = useSidebar();
  const refreshDirectories = useTaskStore((state) => state.refresh);
  const setUserEndpoint = useUserStore((state) => state.setEndpoint);
  // 登录失效的退出通知，用于触发退出流程。
  const logoutVersion = useUserStore((state) => state.logoutVersion);
  const [loggingIn, setLoggingIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [endpointError, setEndpointError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  // 防止多个请求同时失效时重复退出登录。
  const loggingOut = useRef(false);

  useEffect(() => {
    let cancelled = false;
    userService.get().then((localUser) => {
      if (!cancelled) {
        setUser(localUser);
        setUserEndpoint(localUser?.endpoint ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [setUserEndpoint]);

  useEffect(() => {
    if (logoutVersion > 0) {
      void handleLogout().catch((error) => console.error("退出登录失败", error));
    }
  }, [logoutVersion]);

  /** 删除本地用户信息并恢复未登录状态。 */
  async function handleLogout() {
    if (!user || loggingOut.current) {
      return;
    }
    loggingOut.current = true;
    try {
      await syncService.stopSync();
      await userService.remove(user.userId);
      setUser(null);
      setUserEndpoint("");
      await refreshDirectories();
      onLogout();
    } finally {
      loggingOut.current = false;
    }
  }

  /** 关闭登录弹窗并清空密码。 */
  function closeLogin() {
    onLoginOpenChange(false);
    setPassword("");
    setEndpointError("");
    setUsernameError("");
    setPasswordError("");
  }

  /** 校验表单并登录远端服务。 */
  async function handleLogin() {
    const nextEndpoint = endpoint.trim().replace(/\/+$/, "");
    const nextEndpointError = nextEndpoint ? "" : "请输入端点";
    const nextUsernameError = username.trim() ? "" : "请输入用户名";
    const nextPasswordError = password ? "" : "请输入密码";
    setEndpointError(nextEndpointError);
    setUsernameError(nextUsernameError);
    setPasswordError(nextPasswordError);
    if (nextEndpointError || nextUsernameError || nextPasswordError) {
      return;
    }
    if (!/^https?:\/\//i.test(nextEndpoint)) {
      setEndpointError("请输入有效的端点地址");
      return;
    }

    try {
      new URL(nextEndpoint);
    } catch {
      setEndpointError("请输入有效的端点地址");
      return;
    }

    setLoggingIn(true);
    try {
      const token = await login(nextEndpoint, {
        username: username.trim(),
        password,
      });
      const info = await getUserInfo(nextEndpoint, token);
      if (!info) {
        toast.error("未获取到用户信息");
        return;
      }

      const avatar = info.avatar
        ? await blobToDataUrl(
            await getUserAvatar(info.avatar, nextEndpoint, token),
          )
        : "";
      const localUser: User = {
        userId: info.userId,
        username: info.username,
        avatar,
        type: info.type,
        token,
        endpoint: nextEndpoint,
      };

      await userService.add(localUser);
      setUser(localUser);
      setUserEndpoint(nextEndpoint);
      await refreshDirectories();
      onLoginOpenChange(false);
      setEndpoint("");
      setUsername("");
      setPassword("");

      // 存储缓存刷新失败不回滚已经完成的登录。
      try {
        await storageService.refresh();
      } catch {
        // 请求层已经显示错误信息，后续打开任务弹框时会再次刷新。
      }
    } finally {
      setLoggingIn(false);
    }
  }

  const displayName = user?.username ?? "未登录";
  const avatar = (
    <Avatar className="size-8 rounded-lg after:rounded-lg">
      <AvatarImage
        className="rounded-lg"
        src={user?.avatar || undefined}
        alt={displayName}
      />
      <AvatarFallback className="rounded-lg">
        {user ? getAvatarFallback(user.username) : <UserRound className="size-4" />}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  {avatar}
                  <div className="grid min-w-0 flex-1 text-left text-sm">
                    <span className="truncate font-medium">{displayName}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    {avatar}
                    <div className="grid min-w-0 flex-1 text-left text-sm">
                      <span className="truncate font-medium">{displayName}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleLogout()}>
                  <LogOut />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <SidebarMenuButton
              size="lg"
              tooltip="登录"
              onClick={() => onLoginOpenChange(true)}
            >
              {avatar}
              <div className="grid min-w-0 flex-1 text-left text-sm">
                <span className="truncate font-medium">{displayName}</span>
              </div>
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog
        open={loginOpen}
        onOpenChange={(nextOpen) => !nextOpen && closeLogin()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>登录</DialogTitle>
            <DialogDescription className="sr-only">
              输入服务端点和用户凭据
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="endpoint">端点</Label>
              <Input
                id="endpoint"
                value={endpoint}
                placeholder="https://example.com"
                autoComplete="url"
                aria-invalid={Boolean(endpointError)}
                onChange={(event) => {
                  setEndpoint(event.target.value);
                  setEndpointError("");
                }}
              />
              {endpointError ? (
                <p className="text-xs text-destructive">{endpointError}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                autoComplete="username"
                aria-invalid={Boolean(usernameError)}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setUsernameError("");
                }}
              />
              {usernameError ? (
                <p className="text-xs text-destructive">{usernameError}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                autoComplete="current-password"
                aria-invalid={Boolean(passwordError)}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError("");
                }}
              />
              {passwordError ? (
                <p className="text-xs text-destructive">{passwordError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeLogin}>
                取消
              </Button>
              <Button type="submit" disabled={loggingIn}>
                {loggingIn ? <Loader2 className="animate-spin" /> : null}
                登录
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
