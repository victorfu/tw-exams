/** 考卷檔的網址：一律經過本站的 /exams 路由（開發讀 output/，線上讀私有 Blob）。 */
export function examFileUrl(file: string, { download = false }: { download?: boolean } = {}): string {
  const path = `/exams/${file.split("/").map(encodeURIComponent).join("/")}`;
  return download ? `${path}?download=1` : path;
}
