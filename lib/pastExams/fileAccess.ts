/**
 * 嚴格來源檢查：只接受本站頁面發出的請求。
 * 有 Sec-Fetch-Site 時必須是 same-origin（直接輸入網址是 none，其他網站是 cross-site）；
 * 較舊的瀏覽器沒有這個 header，就改看 Referer 是不是同源。
 */
export function isSameOriginRequest(headers: Headers, requestUrl: string): boolean {
  const site = headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const referer = headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}
