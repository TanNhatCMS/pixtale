import { create } from "zustand";
import { persist } from "zustand/middleware";
import { logService, type SyncLog, type SyncLogStatus } from "../service/log";

// 同步日志状态：持久化当前数据、筛选条件和分页位置，进入页面先展示缓存。

type LogFilter = "all" | "1" | "2";

type LogStore = {
  rows: SyncLog[];
  total: number;
  pageIndex: number;
  pageSize: number;
  filter: LogFilter;
  search: string;
  refresh: () => Promise<void>;
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilter: (filter: LogFilter) => void;
  setSearch: (search: string) => void;
};

/** 将页面筛选值转换为数据库日志状态。 */
function getFilterStatus(filter: LogFilter): SyncLogStatus | undefined {
  return filter === "all" ? undefined : Number(filter) as SyncLogStatus;
}

export const useLogStore = create<LogStore>()(
  persist(
    (set, get) => ({
      rows: [],
      total: 0,
      pageIndex: 0,
      pageSize: 10,
      filter: "all",
      search: "",
      /** 按当前筛选和分页条件读取最新日志数据。 */
      async refresh() {
        const { pageIndex, pageSize, filter, search } = get();
        const result = await logService.list(pageIndex, pageSize, getFilterStatus(filter), search);
        set({ rows: result.items, total: result.total });
      },
      /** 修改当前页码。 */
      setPageIndex(pageIndex) {
        set({ pageIndex });
      },
      /** 修改每页数量并回到第一页。 */
      setPageSize(pageSize) {
        set({ pageSize, pageIndex: 0 });
      },
      /** 修改状态筛选并回到第一页。 */
      setFilter(filter) {
        set({ filter, pageIndex: 0 });
      },
      /** 修改事件搜索并回到第一页。 */
      setSearch(search) {
        set({ search, pageIndex: 0 });
      },
    }),
    {
      name: "pixtale-sync-log-state",
      partialize: (state) => ({
        rows: state.rows,
        total: state.total,
        pageIndex: state.pageIndex,
        pageSize: state.pageSize,
        filter: state.filter,
        search: state.search,
      }),
    },
  ),
);
