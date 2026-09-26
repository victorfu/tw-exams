import type { Metadata } from "next";
import { ContactLink, LegalDocument } from "@/components/Site/LegalDocument";

export const metadata = {
  title: "隱私權政策",
  description: "泡泡考卷不需要註冊、不蒐集個人資料，自製考卷的檔案只在你的瀏覽器裡處理。",
} satisfies Metadata;

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="隱私權政策"
      intro="泡泡考卷（以下稱「本站」）重視你的隱私。本政策說明你使用本站時，哪些資料會被處理、存在哪裡，以及你可以怎麼做。"
    >
      <section>
        <h2>一、我們蒐集哪些資料</h2>
        <p>本站不需要註冊，也不會要求你提供姓名、email、電話、學校等個人資料。</p>
      </section>

      <section>
        <h2>二、自製考卷的檔案</h2>
        <ul>
          <li>
            你上傳的照片與 PDF、框出的題目和組好的考卷，都只在你的瀏覽器（目前這個分頁）裡處理，不會上傳到本站的伺服器。
          </li>
          <li>這些資料在重新整理或關閉分頁後就會消失。我們無法取得，也無法幫你救回。</li>
          <li>從考古題匯入時，瀏覽器會向本站下載那份考卷檔，之後的處理同樣只在你的裝置上進行。</li>
        </ul>
      </section>

      <section>
        <h2>三、瀏覽器儲存與 Cookie</h2>
        <ul>
          <li>
            本站只在你瀏覽器的 localStorage 記住兩項偏好：亮色或深色模式，以及自製考卷的列印設定（例如字級、是否附答案頁）。這些資料不含個人資料、不會傳給我們，你可以隨時從瀏覽器設定清除。
          </li>
          <li>本站不使用追蹤或廣告用的 Cookie，也沒有廣告與第三方分析工具。</li>
          <li>字型、PDF 預覽元件等網站資源都由本站提供，瀏覽時不會連線到 Google 等第三方網站。</li>
        </ul>
      </section>

      <section>
        <h2>四、伺服器存取紀錄與第三方服務</h2>
        <p>
          本站架設在 Vercel（Vercel Inc.）的平台上，考古題檔案存放在 Vercel Blob。你瀏覽網頁或開啟考卷時，Vercel
          會依其服務運作自動產生存取紀錄，可能包含 IP 位址、瀏覽器與裝置資訊、請求的網址與時間。這些紀錄用於提供服務、維護安全與排除問題，可能在中華民國境外處理，保存方式依
          Vercel 的隱私權政策。
        </p>
        <p>除法令要求外，我們不會把存取紀錄提供給第三人，也不會出售或出租任何資料。</p>
      </section>

      <section>
        <h2>五、兒童隱私</h2>
        <p>
          本站的使用者可能包含國小學童。我們不蒐集任何可識別個人身分的資料；家長或老師陪同孩子使用時，也不需要提供孩子的任何資料。
        </p>
      </section>

      <section>
        <h2>六、你的權利</h2>
        <p>
          依《個人資料保護法》，你可以來信詢問或要求處理與你有關的資料。由於本站原則上不保存能識別你的資料，我們可能無法從存取紀錄中找出屬於你的部分，但會盡力協助。
        </p>
      </section>

      <section>
        <h2>七、政策修訂</h2>
        <p>本政策修訂時，我們會更新本頁內容與上方的生效日期。</p>
      </section>

      <section>
        <h2>八、聯絡我們</h2>
        <p>
          對本政策有任何問題，請來信 <ContactLink />。
        </p>
      </section>
    </LegalDocument>
  );
}
