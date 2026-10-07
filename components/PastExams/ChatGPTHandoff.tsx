"use client";

import { useEffect, useRef, useState } from "react";
import type { PastExam, PastExamCollection } from "../../lib/pastExams/types";
import { examFileUrl } from "../../lib/pastExams/fileUrl";
import { downloadFileName } from "../../lib/pastExams/fileResponse";
import { SITE_URL } from "../../lib/site";
import { DEFAULT_HANDOFF_TASK, handoffSources } from "./handoffPrompt";

export function ChatGPTHandoff({ exams, collections, onClose }: {
  exams: readonly PastExam[]; collections: readonly PastExamCollection[]; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [includeAnswers, setIncludeAnswers] = useState(false);
  const [task, setTask] = useState(DEFAULT_HANDOFF_TASK);
  const [copyStatus, setCopyStatus] = useState("");
  const prompt = `${task}\n\n${handoffSources(exams, collections, includeAnswers)}`;
  useEffect(() => { dialog.current?.showModal(); }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus("已複製，請開啟 ChatGPT 貼上後送出。");
    } catch {
      textarea.current?.focus();
      textarea.current?.select();
      setCopyStatus("無法自動複製，請從下方完整提示詞手動複製。");
    }
  };
  return <dialog ref={dialog} className="modal" aria-label="交給 ChatGPT" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="modal-box max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">交給 ChatGPT（{exams.length} 份）</h2><button className="btn btn-sm" onClick={onClose}>關閉</button></div>
      <p className="text-sm text-base-content/70">複製提示詞後，到 ChatGPT 貼上並送出。連結不代表附件已上傳；若無法讀取，請下載後手動上傳。</p>
      {typeof window !== "undefined" && (window.location.origin !== SITE_URL.origin || /localhost|127\.0\.0\.1|\[::1\]/.test(SITE_URL.hostname)) &&
        <p className="text-sm text-warning">連結使用正式網址 {SITE_URL.origin}。本機或尚未部署的考卷無法由 ChatGPT 讀取。</p>}
      <label className="flex items-center gap-2"><input type="checkbox" className="checkbox checkbox-sm" checked={includeAnswers} onChange={(event) => { setIncludeAnswers(event.target.checked); setCopyStatus(""); }} />包含解答</label>
      <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">{exams.map((exam) => <li key={exam.id}>
        <span>{exam.title}</span>{" "}<a className="link" href={examFileUrl(exam.file, { download: true })} download={downloadFileName(exam)}>下載題目</a>
        {includeAnswers && exam.answer && <> · <a className="link" href={examFileUrl(exam.answer.file, { download: true })} download={downloadFileName(exam, "answer")}>下載解答</a></>}
      </li>)}</ul>
      <label className="block text-sm">想請 ChatGPT 做什麼？<textarea className="textarea mt-1 w-full" rows={4} value={task} onChange={(event) => { setTask(event.target.value); setCopyStatus(""); }} /></label>
      <label className="block text-sm">完整提示詞（含考卷連結）<textarea ref={textarea} className="textarea mt-1 w-full" rows={7} value={prompt} readOnly /></label>
      <p role="status" className="text-sm">{copyStatus}</p>
      <div className="flex flex-wrap gap-2"><button className="btn btn-primary" onClick={() => void copy()}>複製提示詞</button><a className="btn" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">開啟 ChatGPT</a></div>
    </div>
  </dialog>;
}
