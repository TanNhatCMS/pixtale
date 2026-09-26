import { useEffect } from "react";
import {
  createColumnHelper,
  FlexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { LogStatusEnum } from "../enum/log";
import type { SyncLog } from "../service/log";
import { useLogStore } from "../store/log";

// 同步日志页：使用 Data Table 分页展示文件同步结果。

type LogFilter = "all" | "1" | "2";

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, SyncLog>();

/** 将 SQLite UTC 时间转换为本地显示时间。 */
function formatTime(value: string): string {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("zh-CN", { hour12: false });
}

/** 返回指定 Data Table 列的固定宽度。 */
function getColumnClass(columnId: string): string {
  switch (columnId) {
    case "eventName":
      return "pl-4";
    case "taskName":
      return "w-[19%]";
    case "createdAt":
      return "w-43";
    case "status":
      return "w-23";
    case "message":
      return "pr-4";
    default:
      return "";
  }
}

const columns = columnHelper.columns([
  columnHelper.accessor("eventName", {
    header: "事件",
    cell: ({ row }) => (
      <div className="truncate" title={row.original.eventName || "-"}>
        {row.original.eventName || "-"}
      </div>
    ),
  }),
  columnHelper.accessor("taskName", {
    header: "任务",
    cell: ({ row }) => (
      <div className="truncate" title={row.original.taskName || "-"}>
        {row.original.taskName || "-"}
      </div>
    ),
  }),
  columnHelper.accessor("createdAt", {
    header: "时间",
    cell: ({ row }) => formatTime(row.original.createdAt),
  }),
  columnHelper.accessor("status", {
    header: "状态",
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === LogStatusEnum.SUCCESS ? "secondary" : "destructive"}
        className={
          row.original.status === LogStatusEnum.SUCCESS
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : undefined
        }
      >
        {row.original.status === LogStatusEnum.SUCCESS ? "成功" : "失败"}
      </Badge>
    ),
  }),
  columnHelper.accessor("message", {
    header: "消息",
    cell: ({ row }) => {
      const message =
        row.original.message ||
        (row.original.status === LogStatusEnum.SUCCESS ? "Success" : "-");
      return (
        <div className="truncate" title={message}>
          {message}
        </div>
      );
    },
  }),
]);

/** 展示支持数据库分页的同步日志 Data Table。 */
export default function SyncLogs() {
  const rows = useLogStore((state) => state.rows);
  const total = useLogStore((state) => state.total);
  const pageIndex = useLogStore((state) => state.pageIndex);
  const pageSize = useLogStore((state) => state.pageSize);
  const filter = useLogStore((state) => state.filter);
  const search = useLogStore((state) => state.search);
  const refresh = useLogStore((state) => state.refresh);
  const setPageIndex = useLogStore((state) => state.setPageIndex);
  const setPageSize = useLogStore((state) => state.setPageSize);
  const setFilter = useLogStore((state) => state.setFilter);
  const setSearch = useLogStore((state) => state.setSearch);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const table = useTable({
    features,
    data: rows,
    columns,
    getRowId: (row) => String(row.id),
  });

  useEffect(() => {
    /** 后台刷新当前条件下的同步日志。 */
    async function loadLogs() {
      try {
        await refresh();
      } catch (error) {
        console.error("读取同步日志失败", error);
      }
    }

    void loadLogs();
  }, [filter, pageIndex, pageSize, search, refresh]);

  /** 修改每页条数并返回第一页。 */
  function changePageSize(value: string) {
    setPageSize(Number(value));
  }

  /** 修改日志状态筛选并返回第一页。 */
  function changeFilter(value: string) {
    setFilter(value as LogFilter);
  }

  /** 修改文件名搜索条件并返回第一页。 */
  function changeSearch(value: string) {
    setSearch(value);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Tabs value={filter} onValueChange={changeFilter}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="1">成功</TabsTrigger>
            <TabsTrigger value="2">失败</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            className="pl-8"
            placeholder="按事件搜索"
            onChange={(event) => changeSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table className="table-fixed">
          <TableHeader className="bg-[#f5f5f5]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={getColumnClass(header.column.id)}
                  >
                    {header.isPlaceholder ? null : (
                      <FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={getColumnClass(cell.column.id)}
                    >
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  暂无同步日志
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">共 {total} 条日志</div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="text-sm">每页行数</span>
            <Select value={String(pageSize)} onValueChange={changePageSize}>
              <SelectTrigger size="sm" className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {[10, 20, 30, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm font-medium">
            第 {pageIndex + 1} / {pageCount} 页
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="hidden size-8 sm:flex"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex(0)}
            >
              <ChevronsLeft />
              <span className="sr-only">第一页</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
            >
              <ChevronLeft />
              <span className="sr-only">上一页</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={pageIndex >= pageCount - 1}
              onClick={() => setPageIndex(Math.min(pageCount - 1, pageIndex + 1))}
            >
              <ChevronRight />
              <span className="sr-only">下一页</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden size-8 sm:flex"
              disabled={pageIndex >= pageCount - 1}
              onClick={() => setPageIndex(pageCount - 1)}
            >
              <ChevronsRight />
              <span className="sr-only">最后一页</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
