import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE } from "@/lib/site";
import PrivacyPage, { metadata as privacyMetadata } from "./privacy/page";
import TermsPage, { metadata as termsMetadata } from "./terms/page";

function render(element: React.ReactElement): Document {
  return new DOMParser().parseFromString(renderToStaticMarkup(element), "text/html");
}

describe("privacy policy", () => {
  const doc = render(<PrivacyPage />);
  const text = doc.body.textContent ?? "";

  it("has its own title, effective date and contact", () => {
    expect(privacyMetadata.title).toBe("隱私權政策");
    expect(doc.querySelector("h1")?.textContent).toBe("隱私權政策");
    expect(text).toContain(LEGAL_EFFECTIVE_DATE);
    expect(doc.querySelector(`a[href="mailto:${CONTACT_EMAIL}"]`)).not.toBeNull();
  });

  it("describes what the site really stores", () => {
    expect(text).toContain("不需要註冊");
    expect(text).toContain("不會上傳");
    expect(text).toContain("localStorage");
    expect(text).toContain("Vercel");
  });
});

describe("terms of service", () => {
  const doc = render(<TermsPage />);
  const text = doc.body.textContent ?? "";

  it("has its own title, effective date and contact", () => {
    expect(termsMetadata.title).toBe("服務條款");
    expect(doc.querySelector("h1")?.textContent).toBe("服務條款");
    expect(text).toContain(LEGAL_EFFECTIVE_DATE);
    expect(doc.querySelector(`a[href="mailto:${CONTACT_EMAIL}"]`)).not.toBeNull();
  });

  it("covers copyright takedowns and non-commercial use", () => {
    expect(text).toContain("下架");
    expect(text).toContain("非商業");
    expect(text).toContain("中華民國法律");
  });
});
