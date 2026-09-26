import { getBlob, post } from "./request";

// 用户请求：封装登录、当前用户信息和头像接口。

export type LoginParams = {
  username: string;
  password: string;
};

export type UserInfo = {
  userId: string;
  username: string;
  avatar: string;
  type: number;
};

type LoginResult = {
  token: string;
};

/** 使用指定端点登录并返回 JWT。 */
export async function login(
  endpoint: string,
  params: LoginParams,
): Promise<string> {
  const baseURL = endpoint.trim().replace(/\/+$/, "");
  const result = await post<LoginResult>("/api/login", params, { baseURL });
  return result.token;
}

/** 查询当前登录用户信息。 */
export function getUserInfo(
  endpoint: string,
  token: string,
): Promise<UserInfo | null> {
  return post<UserInfo | null>("/api/user/info", undefined, {
    baseURL: endpoint,
    headers: { Authorization: token },
  });
}

/** 下载当前用户的头像文件。 */
export function getUserAvatar(
  key: string,
  endpoint: string,
  token: string,
): Promise<Blob> {
  return getBlob(`/api/user/avatar/${encodeURIComponent(key)}`, {
    baseURL: endpoint,
    headers: { Authorization: token },
  });
}
