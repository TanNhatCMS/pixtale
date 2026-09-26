import { create } from "zustand";
import { persist } from "zustand/middleware";
import { taskService, type Task } from "../service/task";
import { userService } from "../service/user";

// 同步任务状态：缓存任务列表，并提供统一刷新入口。

type TaskStore = {
  items: Task[];
  refresh: () => Promise<void>;
};

export const useTaskStore = create<TaskStore>()(
  persist(
    (set) => ({
      items: [],

      /** 从 SQLite 重新查询全部同步任务。 */
      async refresh() {
        const user = await userService.get();
        set({ items: await taskService.list(user?.userId ?? "") });
      },
    }),
    {
      name: "pixtale-sync-task-state",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
