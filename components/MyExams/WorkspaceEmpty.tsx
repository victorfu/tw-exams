import Link from "next/link";
import type { QuestionSource } from "../../types/questionBank";
import { latestSource, sourceEditorHref } from "./workspaceState";

export function WorkspaceEmpty({ sources, onUpload, returnTo = "/my-exams" }: {
  sources: readonly QuestionSource[];
  onUpload: () => void;
  returnTo?: string;
}) {
  const source = latestSource(sources);
  return (
    <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 p-6 text-center sm:p-10">
      <h2 className="text-lg font-semibold">{source ? "檔案準備好了，開始框選題目" : "從一份考卷，開始建立你的題庫"}</h2>
      <p className="mt-2 text-sm text-base-content/65">{source ? "題庫還是空的。框出想練習的題目，就能挑題組卷。" : "題庫還是空的。匯入照片或 PDF，將想練習的題目整理在一起。"}</p>
      <ol className="mx-auto my-6 flex max-w-md flex-wrap justify-center gap-4 text-sm text-base-content/70">
        <li>1. 匯入檔案</li><li>2. 框選題目</li><li>3. 組卷列印</li>
      </ol>
      {source ? (
        <div className="space-y-3">
          <p className="break-words text-sm">{source.title}</p>
          <Link href={sourceEditorHref(source.id, returnTo)} className="btn btn-primary">開始框題</Link>
        </div>
      ) : <button type="button" className="btn btn-primary" onClick={onUpload}>匯入照片／PDF</button>}
    </div>
  );
}
