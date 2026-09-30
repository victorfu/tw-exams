import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import {
  collectionPath,
  collectionShortLabel,
  pastExamsToolHref,
  type CollectionSummary,
} from "../../lib/pastExams/collectionPage";
import { UNKNOWN } from "../../lib/pastExams/filters";

/**
 * 資料集落地頁：整份清單直接畫成 HTML（搜尋引擎、AI 摘要讀得到），
 * 點考卷才進 `/past-exams` 的預覽工具。
 */
export function CollectionLanding({ summary }: { summary: CollectionSummary }) {
  const { collection, heading, exams, groups, answers, schools, cities, academicYears, related } = summary;
  const facts = [
    { value: exams.length, label: "份考卷" },
    { value: answers, label: "份附解答" },
    { value: cities.length, label: "個縣市" },
    { value: schools, label: "所國小" },
  ];
  return (
    <article className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <nav aria-label="頁面位置" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {[
            { href: "/", label: "首頁" },
            { href: "/past-exams", label: "考古題" },
          ].map(({ href, label }) => (
            <li key={href} className="flex items-center gap-1">
              <Link href={href} className="hover:text-accent">
                {label}
              </Link>
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </li>
          ))}
          <li aria-current="page" className="text-foreground">
            {collectionShortLabel(collection)}
          </li>
        </ol>
      </nav>

      <header className="mt-6">
        <h1 className="text-3xl leading-tight sm:text-4xl">{heading}</h1>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
          整理 {academicYears.join("、") || "歷年"} 學年度各縣市國小的{collection.subjectLabel}段考考卷，
          使用{collection.publisherLabel}版教材的班級都適用。點考卷就能在網頁上預覽 PDF、切換解答、下載，
          或匯入自製考卷重新組一份練習卷。
        </p>
        <dl className="mt-6 grid max-w-xl grid-cols-4 gap-4">
          {facts.map(({ value, label }) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="block font-display text-2xl text-foreground">{value.toLocaleString("zh-TW")}</span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </dd>
            </div>
          ))}
        </dl>
        <Link href={pastExamsToolHref(collection)} className="btn btn-primary mt-8 rounded-full px-6 shadow-elevated">
          線上預覽這些考卷
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </header>

      {cities.length > 0 && (
        <section aria-labelledby="by-city" className="mt-12">
          <h2 id="by-city" className="text-2xl">
            依縣市找
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {cities.map(({ city, count }) => (
              <li key={city}>
                <Link
                  href={pastExamsToolHref(collection, { city })}
                  className="inline-flex items-baseline gap-1.5 rounded-full border border-border-hairline bg-card px-3 py-1.5 text-sm hover:bg-accent-tint hover:text-accent"
                >
                  {city}
                  <span className="text-xs text-muted-foreground">{count} 份</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.map((group) => (
        <section key={group.academicYear} aria-labelledby={`year-${group.academicYear}`} className="mt-12">
          <h2 id={`year-${group.academicYear}`} className="text-2xl">
            {group.label}學年度（{group.exams.length} 份）
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.exams.map((exam) => (
              <li key={exam.id}>
                <Link
                  href={pastExamsToolHref(collection, { examId: exam.id })}
                  className="surface-card flex h-full flex-col gap-1 rounded-xl px-4 py-3 transition-colors duration-200 hover:bg-accent-tint"
                >
                  <span className="font-medium">
                    {exam.city ?? UNKNOWN} {exam.school ?? ""}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {exam.periodLabel}
                    {exam.pages ? `・${exam.pages} 頁` : ""}
                    {exam.format === "word" ? "・Word" : ""}
                    {exam.answer ? "・附解答" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-14 border-t border-border-hairline pt-8">
          <h2 id="related" className="text-2xl">
            同年級的其他考古題
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {related.map((dataset) => (
              <li key={dataset.id}>
                <Link
                  href={collectionPath(dataset)}
                  className="inline-flex items-baseline gap-1.5 rounded-full bg-accent-tint px-4 py-2 text-sm text-accent hover:underline"
                >
                  {collectionShortLabel(dataset)}
                  <span className="text-xs">{dataset.examCount} 份</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 text-xs leading-relaxed text-muted-foreground">
        考卷整理自網路上公開的各校段考考卷，著作權屬於原學校與出題老師，僅供個人學習與教學使用。
      </p>
    </article>
  );
}
