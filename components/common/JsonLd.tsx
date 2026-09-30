import { jsonLdHtml } from "../../lib/seo";

/** 結構化資料（schema.org），給搜尋引擎與 AI 摘要用。 */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }} />;
}
