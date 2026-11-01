import Link from "next/link";
import { JsonLd } from "@/components/common/JsonLd";
import { pastExamCatalog } from "@/lib/pastExams/catalog";
import { collectionHeading, collectionPath } from "@/lib/pastExams/collectionPage";
import { catalogStats } from "@/lib/pastExams/stats";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

const title = "國小考古題怎麼找？下載、解答與自製練習卷指南";
const description = "依年級、學期與出版社找國小段考考古題，確認解答與來源；從 PDF 框選題目、跨卷選題，組成 A4 練習卷列印。附保存限制與常見問題。";
const path = "/guides/practice-sheets";

export const metadata = pageMetadata({ title, description, path });

export default function Page() {
  const stats = catalogStats(pastExamCatalog);
  return (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-10 leading-relaxed sm:py-14">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", "@id": absoluteUrl(path), url: absoluteUrl(path), name: title, description, inLanguage: "zh-Hant-TW" }} />
      <header>
        <Link href="/" className="text-sm text-accent underline">首頁</Link>
        <h1 className="mt-5 text-3xl leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-4">泡泡考卷是免費、不需註冊的國小考卷工具。目前收錄{stats.terms.join("、")}，共 {stats.exams} 份考古題，其中 {stats.answers} 份附解答。先挑符合學校教材與進度的考卷，再針對需要複習的題目組卷。</p>
      </header>
      <section className="space-y-3" aria-labelledby="find-exams">
        <h2 id="find-exams" className="text-2xl">如何找到適合孩子的考古題？</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>確認年級、上下學期、科目與出版社版本，例如「五年級上學期數學南一版」。同年級的不同版本，課程順序可能不同。</li>
          <li>在下方選擇資料集，查看學年度與學校；也可以進入<Link href="/past-exams" className="text-accent underline">考古題工具</Link>，用縣市、學年度、期中／期末及學校名稱篩選。</li>
          <li>打開考卷詳情核對來源與解答狀態，再對照學校公告的考試範圍。期中、期末及三次段考制的進度不一定相同。</li>
        </ol>
        <ul className="grid gap-2 sm:grid-cols-2">{pastExamCatalog.datasets.map((collection) => <li key={collection.id}><Link href={collectionPath(collection)} className="text-accent underline">{collectionHeading(collection)}</Link></li>)}</ul>
      </section>
      <section className="space-y-3" aria-labelledby="answers">
        <h2 id="answers" className="text-2xl">可以下載嗎？每份都有解答嗎？</h2>
        <p>PDF 可以線上預覽與下載；Word 檔目前提供下載。考卷詳情頁提供「下載題目卷」，有收錄解答時才會出現「下載解答卷」。在預覽工具也能切換「題目｜解答」。</p>
        <p>不是每份考卷都有解答。沒有附解答的考卷會標示「目前未收錄解答卷」，這不代表題目沒有答案。本站未逐題審核原卷或解答；遇到疑義請向老師確認，AI 的推算也不等於原卷解答。</p>
      </section>
      <section className="space-y-3" aria-labelledby="compose">
        <h2 id="compose" className="text-2xl">如何把不同考卷的題目組成練習卷？</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>在考古題工具預覽一份 PDF，按「框選題目」，等待頁面圖片準備完成。</li>
          <li>在原頁框出題目。跨欄或跨頁的題目可用多個區塊組成，寫過的作答痕跡可用遮蓋框蓋住；需要答案頁時請自行設定並核對答案。</li>
          <li>新框出的題目會加入本次選題；可以換另一份考卷繼續選，最後按「用這些題目組卷」。</li>
          <li>在組卷畫面調整題目、順序與作答留白，再選字級與是否附答案頁，印成 A4 或用瀏覽器的列印功能另存 PDF。</li>
        </ol>
        <p>也可到<Link href="/my-exams" className="text-accent underline">自製考卷工作區</Link>上傳手邊的照片或 PDF（一次最多 30 頁），框成題庫後依科目與題數隨機組卷。Word 需先自行轉成 PDF 或圖片。</p>
      </section>
      <section className="space-y-3" aria-labelledby="storage">
        <h2 id="storage" className="text-2xl">題庫與自製考卷會自動保存嗎？</h2>
        <p>編輯期間會自動保存在目前分頁的記憶體，照片與 PDF 在瀏覽器內處理，不會上傳到伺服器。重新整理、關閉分頁或另開分頁後，題庫、選題與自製考卷不會保留，也不會跨裝置同步。</p>
        <p>完成後請先列印或另存 PDF。分享編輯頁或列印頁的網址，無法把暫存考卷交給另一個人；請分享已輸出的檔案。若要分享原始考古題，請分享它的公開考卷詳情頁。</p>
      </section>
      <section className="space-y-3" aria-labelledby="sources">
        <h2 id="sources" className="text-2xl">考卷來源與使用範圍</h2>
        <p>考卷詳情會列出原始目錄提供的來源連結與收錄日期，方便回查。收錄日期不是考試日期或內容更新日期；本站不代表原學校或出版社，考卷著作權屬於原權利人。</p>
        <p>請僅供個人學習與教學使用。詳細規範與下架聯絡方式見<Link href="/terms" className="text-accent underline">服務條款</Link>，檔案處理方式見<Link href="/privacy" className="text-accent underline">隱私權政策</Link>。</p>
      </section>
    </article>
  );
}
