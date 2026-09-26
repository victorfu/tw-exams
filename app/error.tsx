"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { logger } from "@/utils/logger";

/**
 * 畫面出錯時的備援。題庫只存在記憶體裡（services/mockStore），所以只提供不重新
 * 載入整頁的復原方式：retry() 在原地重畫這一段，連結走 client 端導覽。
 */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    logger.error("[RouteError] render failed", error);
  }, [error]);

  return (
    <div role="alert" className="px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">發生錯誤</h1>
      <p className="mt-2 text-base-content/70">
        畫面出了點問題，按「重試」重新顯示。題目和考卷只存在這個分頁裡，重新整理頁面會全部清空。
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => retry()}>
          重試
        </button>
        {/* 已經在 /my-exams 時，連回同一頁不會清掉錯誤，只留「重試」。 */}
        {pathname !== "/my-exams" && (
          <Link href="/my-exams" className="btn btn-sm">
            返回自製考卷
          </Link>
        )}
      </div>
    </div>
  );
}
