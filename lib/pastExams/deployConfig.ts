export interface DeployConfigCheck {
  error?: string;
  warning?: string;
}

/** production build 前檢查考卷檔的來源：在 Vercel 上設定不對就讓 build 失敗，本機只警告。 */
export function checkExamsDeployConfig(env: Readonly<Record<string, string | undefined>>): DeployConfigCheck {
  let problem: string | null = null;
  if (env.EXAMS_FILE_SOURCE !== "blob") {
    problem = `EXAMS_FILE_SOURCE 是 ${JSON.stringify(env.EXAMS_FILE_SOURCE ?? "")}，線上必須是 "blob"（見 .env.production）。`;
  } else if (!env.BLOB_STORE_ID) {
    problem = "找不到 BLOB_STORE_ID：請在 Vercel 後台把私有 Blob store 連到這個專案（Production、Preview）。";
  }
  if (problem === null) return {};
  return env.VERCEL ? { error: problem } : { warning: problem };
}
