import { create } from "zustand";

// 用户状态：保存退出通知，不保存认证信息。

type UserStore = {
  // 退出通知的版本号，每次收到登录失效响应时递增。
  logoutVersion: number;
  requestLogout: () => void;
};

export const useUserStore = create<UserStore>((set) => ({
  logoutVersion: 0,

  /** 通知登录组件执行现有退出流程。 */
  requestLogout() {
    set((state) => ({ logoutVersion: state.logoutVersion + 1 }));
  },
}));
