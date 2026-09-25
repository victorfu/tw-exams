import { useCallback, useEffect, useState } from "react";
import { pageImageUrl } from "../services/mockStore";
import { logger } from "../utils/logger";

/**
 * 原本向 Supabase 批次簽 URL；現在頁圖存在記憶體，直接給 object URL。
 * 還沒存好（或已刪除）的路徑不放進結果，呼叫端視為「尚未取得」。
 * `force` 保留給重試用，object URL 不會過期所以不影響結果。
 */
export async function fetchSignedUrls(
  paths: readonly string[],
  force = false,
): Promise<Record<string, string>> {
  void force;
  const urls: Record<string, string> = {};
  for (const path of paths) {
    const url = pageImageUrl(path);
    if (url) urls[path] = url;
  }
  return urls;
}

export function useSignedPageUrls(paths: readonly string[]) {
  // 用內容當 key：呼叫端每次 render 產生新陣列也不會重抓。
  const key = [...new Set(paths)].sort().join("\n");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (key === "") return;
    let cancelled = false;
    fetchSignedUrls(key.split("\n"))
      .then((result) => {
        if (cancelled) return;
        setUrls((previous) => ({ ...previous, ...result }));
        setFailed(false);
      })
      .catch((error: unknown) => {
        logger.warn("[useSignedPageUrls] failed to sign page urls", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const refresh = useCallback(async (path: string) => {
    try {
      const result = await fetchSignedUrls([path], true);
      setUrls((previous) => ({ ...previous, ...result }));
    } catch (error) {
      logger.warn("[useSignedPageUrls] refresh failed", error);
    }
  }, []);

  return { urls, failed, refresh };
}
