import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL } from "../../lib/site";
import { SiteFooter } from "./SiteFooter";

describe("SiteFooter", () => {
  it("links to both policies and the contact address", () => {
    const doc = new DOMParser().parseFromString(renderToStaticMarkup(<SiteFooter />), "text/html");
    const hrefs = [...doc.querySelectorAll("a")].map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual(expect.arrayContaining(["/privacy", "/terms", `mailto:${CONTACT_EMAIL}`]));
  });
});
