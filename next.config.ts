import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { checkExamsDeployConfig } from "./lib/pastExams/deployConfig";

export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const { error, warning } = checkExamsDeployConfig(process.env);
    if (error) throw new Error(error);
    if (warning) console.warn(`⚠ ${warning}`);
  }
  return {
    // 線上考卷檔從私有 Blob 讀：不要把本機 output/ 的檔案打包進 /exams 路由的函式。
    outputFileTracingExcludes: { "/exams/**": ["./output/**"] },
  };
}
