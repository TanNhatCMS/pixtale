import { post } from "./request";

// 照片请求：上传单张照片到远端照片库。

const uploadTimeout = 3 * 60 * 1000;

export type PhotoAddResult = {
  duplicate: boolean;
  photo: unknown | null;
};

/** 上传一张照片，并允许同步任务取消请求。 */
export function add(
  form: FormData,
  signal?: AbortSignal,
): Promise<PhotoAddResult> {
  return post<PhotoAddResult>("/api/photo/add", form, {
    headers: { "Content-Type": undefined },
    signal,
    timeout: uploadTimeout,
    showError: false,
  });
}
