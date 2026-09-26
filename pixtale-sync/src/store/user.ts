import { create } from "zustand";

// 用户状态：保存登录端点的主机名和退出通知，不保存认证信息。

type UserStore = {
  // 顶部栏显示的主机名，不包含端口。
  hostname: string;
  // 退出通知的版本号，每次收到登录失效响应时递增。
  logoutVersion: number;
  setEndpoint: (endpoint: string) => void;
  requestLogout: () => void;
};

export const useUserStore = create<UserStore>((set) => ({
  hostname: "",
  logoutVersion: 0,

  /** 从登录端点提取主机名，空端点用于清空显示。 */
  setEndpoint(endpoint) {
    set({ hostname: endpoint ? new URL(endpoint).hostname : "" });
  },

  /** 通知登录组件执行现有退出流程。 */
  requestLogout() {
    set((state) => ({ logoutVersion: state.logoutVersion + 1 }));
  },
}));
