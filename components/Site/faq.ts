import { CONTACT_EMAIL } from "../../lib/site";

export interface FaqItem {
  question: string;
  /** 純文字：首頁畫出來（信箱自動變連結），也原樣放進 FAQPage 結構化資料。 */
  answer: string;
}

/** 首頁的常見問題；畫面與 JSON-LD 共用，兩邊內容才不會不一致。 */
export function faqItems(terms: string): FaqItem[] {
  return [
    { question: "要付費嗎？", answer: "不用。考古題與自製考卷的所有功能都免費，也沒有廣告。" },
    { question: "需要註冊或登入嗎？", answer: "不需要，打開網頁就能直接使用。" },
    {
      question: "我上傳的照片和 PDF 會存到哪裡？",
      answer:
        "只在你目前這個瀏覽器分頁裡處理，不會上傳到伺服器。也因為這樣，重新整理或關閉分頁後題庫就會清空，組好的考卷記得先印出來。",
    },
    {
      question: "考古題是從哪裡來的？",
      answer: `整理自網路上公開的各校段考考卷，著作權屬於原學校與出題老師，僅供個人學習與教學使用。如果你是權利人、希望下架，或發現分類有誤，請來信 ${CONTACT_EMAIL}。`,
    },
    { question: "會收錄其他年級嗎？", answer: `目前收錄${terms}，其他年級與學期整理好後會陸續加入。` },
  ];
}
