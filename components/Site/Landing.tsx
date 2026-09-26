import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Crop,
  FilePen,
  Gift,
  Library,
  LockKeyhole,
  Printer,
  Upload,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import type { CatalogStats } from "../../lib/pastExams/stats";
import { CONTACT_EMAIL } from "../../lib/site";
import { HeroIllustration } from "./HeroIllustration";

const primaryButton = "btn btn-primary rounded-full px-6 shadow-elevated";
const secondaryButton = "btn rounded-full border-border-hairline bg-card px-6 shadow-soft hover:bg-accent-tint";

/** 首頁：說明泡泡考卷能做什麼，帶人進考古題或自製考卷。全部免費，所以沒有收費區塊。 */
export function Landing({ stats }: { stats: CatalogStats }) {
  const terms = stats.terms.join("、") || "尚未收錄";
  return (
    <>
      <Hero stats={stats} terms={terms} />
      <Features />
      <Steps />
      <Subjects stats={stats} terms={terms} />
      <Promises />
      <Faq terms={terms} />
      <ClosingCall />
    </>
  );
}

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="text-sm font-semibold tracking-wide text-accent">{eyebrow}</p>
        <h2 id={id} className="mt-2 text-3xl sm:text-4xl">
          {title}
        </h2>
        {intro && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

function Hero({ stats, terms }: { stats: CatalogStats; terms: string }) {
  const numbers = [
    { value: stats.exams, label: "份考古題" },
    { value: stats.subjects.length, label: "個科目" },
    { value: stats.answers, label: "份附解答" },
  ];
  return (
    <section className="relative overflow-hidden">
      {/* 背景的淡色泡泡 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 size-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-40 -right-20 size-72 rounded-full bg-secondary/15 blur-3xl" />
      </div>
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 sm:pt-16 md:grid-cols-[1.1fr_1fr] md:pb-24">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-tint px-3 py-1 text-sm font-medium text-accent">
            <Gift className="size-4" aria-hidden="true" />
            免費・不用註冊・打開就能用
          </p>
          {/* 每個詞組不拆行，窄螢幕才不會把「找齊」拆開 */}
          <h1 className="mt-5 text-3xl leading-tight sm:text-5xl sm:leading-tight">
            <span className="whitespace-nowrap">國小考古題</span>
            <span className="whitespace-nowrap">一次找齊，</span>
            <br />
            <span className="whitespace-nowrap">
              <span className="text-accent">考卷</span>也能自己組
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            泡泡考卷依年級、科目與出版社整理各校的段考考卷，在網頁上就能預覽、看解答、下載。
            手邊的考卷拍照上傳、框出題目，還能隨機組成一份新考卷印出來。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/past-exams" className={primaryButton}>
              開始找考古題
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/my-exams" className={secondaryButton}>
              自製考卷
            </Link>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
            {numbers.map(({ value, label }) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block font-display text-3xl text-foreground">{value.toLocaleString("zh-TW")}</span>
                  <span className="text-sm text-muted-foreground">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">目前收錄：{terms}</p>
        </div>
        <HeroIllustration className="mx-auto w-full max-w-md md:max-w-none" />
      </div>
    </section>
  );
}

const FEATURES: { icon: LucideIcon; title: string; lead: string; points: string[]; href: string; action: string; tint: string }[] = [
  {
    icon: Library,
    title: "考古題",
    lead: "各校段考考卷，整理好了等你來看。",
    points: [
      "依年級、學期、科目與出版社挑選，再用縣市、學年度、期中／期末或學校名稱篩選",
      "PDF 直接在頁面上預覽，可縮放、旋轉，← → 切換上一份、下一份",
      "有解答卷的考卷，一鍵切換「題目｜解答」",
      "下載原始檔，或把喜歡的考卷匯入自製考卷",
    ],
    href: "/past-exams",
    action: "瀏覽考古題",
    tint: "bg-primary/12 text-primary",
  },
  {
    icon: FilePen,
    title: "自製考卷",
    lead: "把手邊的考卷和講義，變成自己的題庫。",
    points: [
      "上傳考卷或講義的照片、PDF，也能直接匯入考古題",
      "框出每一題，跨欄、跨頁的題目也能拼在一起；寫過的答案可以遮掉",
      "依科目設定題數隨機抽題，可換題、排序、加入指定題目",
      "印成 A4 考卷，可選字級、附答案頁",
    ],
    href: "/my-exams",
    action: "開始自製考卷",
    tint: "bg-secondary/20 text-secondary-content",
  },
];

function Features() {
  return (
    <Section id="features" eyebrow="兩種用法" title="找考卷、組考卷，都在這裡" intro="不管是想讓孩子多練習，還是要為班上準備複習卷，都能很快完成。">
      <div className="grid gap-6 md:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, lead, points, href, action, tint }) => (
          <article key={title} className="surface-card flex flex-col rounded-2xl p-6 sm:p-8">
            <div className={`mb-5 inline-flex size-12 items-center justify-center rounded-2xl ${tint}`}>
              <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h3 className="text-2xl">{title}</h3>
            <p className="mt-2 text-muted-foreground">{lead}</p>
            <ul className="mt-5 flex-1 space-y-3">
              {points.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-relaxed">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {point}
                </li>
              ))}
            </ul>
            <Link href={href} className="mt-6 inline-flex items-center gap-1.5 self-start font-medium text-accent hover:underline">
              {action}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </Section>
  );
}

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Upload, title: "上傳", text: "拍照或選 PDF（一次最多 30 頁），也可以從考古題直接匯入。" },
  { icon: Crop, title: "框題", text: "在頁面上拉出每一題的範圍，設定答案與作答留白，存進題庫。" },
  { icon: Printer, title: "組卷列印", text: "選科目與題數隨機抽題，調整後印成 A4，可以附答案頁。" },
];

function Steps() {
  return (
    <div className="bg-card/60">
      <Section id="steps" eyebrow="自製考卷" title="三個步驟，印出一份新考卷">
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="surface-card relative rounded-2xl p-6">
              <span className="absolute top-5 right-5 font-display text-4xl text-accent/20" aria-hidden="true">
                {index + 1}
              </span>
              <Icon className="size-7 text-accent" strokeWidth={1.75} aria-hidden="true" />
              <h3 className="mt-4 text-xl">
                <span className="sr-only">第 {index + 1} 步：</span>
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function Subjects({ stats, terms }: { stats: CatalogStats; terms: string }) {
  return (
    <Section id="subjects" eyebrow="收錄內容" title="各科考古題，持續增加中" intro={`目前收錄${terms}，同一科有多個出版社時可以切換版本。`}>
      <ul className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3">
        {stats.subjects.map(({ id, label, count }) => (
          <li
            key={id}
            className="flex items-baseline gap-2 rounded-full px-5 py-2.5"
            style={{ backgroundColor: `var(--subject-${id}-tint, var(--accent-tint))`, color: `var(--subject-${id}-ink, var(--accent))` }}
          >
            <span className="font-display text-lg">{label}</span>
            <span className="text-sm">{count.toLocaleString("zh-TW")} 份</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const PROMISES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Gift, title: "完全免費", text: "所有功能都免費，也沒有廣告。" },
  { icon: UserRoundCheck, title: "不用註冊", text: "不需要帳號或 email，打開網頁就能用。" },
  { icon: LockKeyhole, title: "檔案不會上傳", text: "照片與 PDF 都在你的瀏覽器裡處理，不會上傳到伺服器。" },
];

function Promises() {
  return (
    <div className="bg-card/60">
      <Section id="promises" eyebrow="安心使用" title="簡單、免費，也尊重隱私">
        <ul className="grid gap-6 sm:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="text-center">
              <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-accent-tint text-accent">
                <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Faq({ terms }: { terms: string }) {
  const items: { question: string; answer: ReactNode }[] = [
    { question: "要付費嗎？", answer: "不用。考古題與自製考卷的所有功能都免費，也沒有廣告。" },
    { question: "需要註冊或登入嗎？", answer: "不需要，打開網頁就能直接使用。" },
    {
      question: "我上傳的照片和 PDF 會存到哪裡？",
      answer:
        "只在你目前這個瀏覽器分頁裡處理，不會上傳到伺服器。也因為這樣，重新整理或關閉分頁後題庫就會清空，組好的考卷記得先印出來。",
    },
    {
      question: "考古題是從哪裡來的？",
      answer: (
        <>
          整理自網路上公開的各校段考考卷，著作權屬於原學校與出題老師，僅供個人學習與教學使用。如果你是權利人、希望下架，或發現分類有誤，請來信{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
            {CONTACT_EMAIL}
          </a>
          。
        </>
      ),
    },
    { question: "會收錄其他年級嗎？", answer: `目前收錄${terms}，其他年級與學期整理好後會陸續加入。` },
  ];
  return (
    <Section id="faq" eyebrow="常見問題" title="還有疑問嗎？">
      <div className="mx-auto max-w-3xl space-y-3">
        {items.map(({ question, answer }) => (
          <details key={question} className="group surface-card rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {question}
              <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function ClosingCall() {
  return (
    <section className="px-4 pb-20">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center text-primary-content sm:py-16">
        <div aria-hidden="true" className="absolute -top-10 -right-10 size-40 rounded-full bg-secondary/40" />
        <div aria-hidden="true" className="absolute -bottom-12 -left-8 size-32 rounded-full bg-white/15" />
        <h2 className="relative text-3xl sm:text-4xl">現在就來找考卷吧</h2>
        <p className="relative mt-3 opacity-90">不用註冊，點一下就開始。</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/past-exams" className="btn rounded-full border-0 bg-white px-6 text-primary hover:bg-white/90">
            開始找考古題
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href="/my-exams" className="btn btn-ghost rounded-full border border-white/50 px-6 text-primary-content hover:bg-white/10">
            開始自製考卷
          </Link>
        </div>
      </div>
    </section>
  );
}
