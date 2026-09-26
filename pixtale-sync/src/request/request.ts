import axios, { type AxiosRequestConfig } from "axios";
import { toast } from "sonner";
import { userService } from "../service/user";
import { useUserStore } from "../store/user";

// HTTP 请求客户端：统一配置端点、请求头和业务响应处理。

type ApiResponse<T> = {
  code: number;
  message: string;
  data?: T | null;
};

export type RequestConfig = AxiosRequestConfig & {
  showError?: boolean;
};

const request = axios.create({
  timeout: 15_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

request.interceptors.request.use(async (config) => {
  if (config.url === "/api/login") {
    return config;
  }

  // 登录后的首次请求可显式传入认证信息，其他请求统一从 SQLite 恢复。
  if (config.baseURL && config.headers.Authorization) {
    return config;
  }

  const user = await userService.get();
  if (!user?.endpoint || !user.token) {
    throw new Error("未登录");
  }

  config.baseURL = user.endpoint.trim().replace(/\/+$/, "");
  config.headers.Authorization = user.token;
  return config;
});

request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const errorMessage = error.response?.data?.message ?? error.message;
    const detail = errorMessage === "Network Error" ? "网络异常" : errorMessage || "请求失败";
    const config = error.config as RequestConfig | undefined;
    if (config?.showError !== false) {
      toast.error(detail);
    }
    return Promise.reject(new Error(detail));
  },
);

/** 发送业务请求并返回统一响应中的 data。 */
export async function post<T>(
  url: string,
  data?: unknown,
  config?: RequestConfig,
): Promise<T> {
  const response = await request.post<ApiResponse<T>>(url, data, config);
  if (response.data.code === 401) {
    useUserStore.getState().requestLogout();
  }
  if (response.data.code !== 200) {
    const detail = response.data.message || "请求失败";
    if (config?.showError !== false) {
      toast.error(detail);
    }
    throw new Error(detail);
  }
  return response.data.data as T;
}

/** 下载需要鉴权的二进制内容。 */
export async function getBlob(
  url: string,
  config?: AxiosRequestConfig,
): Promise<Blob> {
  const response = await request.get<Blob>(url, {
    ...config,
    responseType: "blob",
  });
  return response.data;
}
