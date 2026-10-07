"use client";

import { clearPickedQuestions, removePickedQuestion, usePastExamSelection } from "./selectionState";

export function QuestionBasket({ onCompose }: { onCompose: () => void }) {
  const { questions } = usePastExamSelection();
  return <section className="surface-card rounded-xl p-3" aria-label="本次已選題目">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className="text-sm">已選 {questions.length} 題</strong>
      <button type="button" className="btn btn-primary btn-sm" disabled={!questions.length} onClick={onCompose}>用這些題目組卷</button>
    </div>
    {questions.length > 0 && <details className="mt-2 text-sm"><summary className="cursor-pointer">查看本次選題</summary>
      <ol className="mt-2 max-h-44 space-y-2 overflow-auto">{questions.map(({ question, title }, index) => <li key={question.id} className="flex items-center gap-2">
        <span className="min-w-0 flex-1">{index + 1}. {title} · 第 {question.regions[0].pageIndex + 1} 頁</span>
        <button className="btn btn-ghost btn-xs shrink-0" aria-label={`移除第 ${index + 1} 個選題`} onClick={() => removePickedQuestion(question.id)}>移除</button>
      </li>)}</ol>
      <button className="btn btn-ghost btn-xs mt-2" onClick={clearPickedQuestions}>清空本次選題</button>
      <p className="mt-1 text-xs text-base-content/60">移除選題不會刪除題庫中的框題。</p>
    </details>}
    <p className="mt-2 text-xs text-base-content/60">題庫、框題與考卷僅保留於此分頁，重新整理即清除。</p>
  </section>;
}
