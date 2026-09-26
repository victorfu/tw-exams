import type { ReactNode } from "react";
import { CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE } from "../../lib/site";

/** 隱私權政策、服務條款的版面：標題、生效日期、內文（h2 分節）、聯絡方式。 */
export function LegalDocument({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="border-b border-border-hairline pb-8">
        <h1 className="text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">生效日期：{LEGAL_EFFECTIVE_DATE}</p>
        <p className="mt-6 leading-relaxed">{intro}</p>
      </header>
      <div className="space-y-10 pt-8 leading-relaxed [&_h2]:text-2xl [&_li]:mt-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}

/** 條款內的聯絡信箱連結。 */
export function ContactLink() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
      {CONTACT_EMAIL}
    </a>
  );
}
