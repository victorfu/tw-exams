/**
 * 考卷檔的網址。開發時由 `public/exams` 提供；上線後把同樣的目錄結構放到物件儲存，
 * 再設定 NEXT_PUBLIC_EXAMS_BASE_URL（build 時內嵌）。
 */
export function examFileUrl(file: string): string {
  const base = (process.env.NEXT_PUBLIC_EXAMS_BASE_URL || "/exams").replace(/\/+$/, "");
  return `${base}/${file.split("/").map(encodeURIComponent).join("/")}`;
}
