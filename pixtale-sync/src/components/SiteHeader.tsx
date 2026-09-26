import type { ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "./ui/breadcrumb";

// 页面头部：展示当前页面标题和右侧操作区。

type Props = {
  title: string;
  actions?: ReactNode;
};

/** 渲染 sidebar-07 风格的内容区头部。 */
export default function SiteHeader({ title, actions }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex min-w-0 flex-1 items-center px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {actions ? <div className="flex items-center gap-2 px-4">{actions}</div> : null}
    </header>
  );
}
