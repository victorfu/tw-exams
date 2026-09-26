import { join } from "node:path";
import { get } from "@vercel/blob";
import { findAvailableExamByFile } from "@/lib/pastExams/catalog";
import { handleExamFileRequest } from "@/lib/pastExams/examFileHandler";
import { examFileSourceFromEnv } from "@/lib/pastExams/fileSources";

// 考卷檔：開發讀 repo 內的 output/，線上讀私有 Blob（見 .env.development／.env.production）。
const source = examFileSourceFromEnv(process.env, { outputDir: join(process.cwd(), "output"), getBlob: get });

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await params;
  return handleExamFileRequest(request, path, { findExam: findAvailableExamByFile, source });
}
