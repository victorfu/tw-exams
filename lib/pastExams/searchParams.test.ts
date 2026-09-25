import { describe, expect, it } from "vitest";
import { readUrlState, writeUrlState } from "./searchParams";

describe("readUrlState", () => {
  it("reads every filter from the query string", () => {
    const params = new URLSearchParams("c=ds&year=114,112&type=final&city=臺北市&q=民權&id=tcool:1");
    expect(readUrlState(params)).toEqual({
      collectionId: "ds",
      academicYears: [114, 112],
      examType: "final",
      city: "臺北市",
      query: "民權",
      examId: "tcool:1",
    });
  });

  it("treats missing or invalid values as no filter", () => {
    expect(readUrlState(new URLSearchParams("year=abc,,113&type=quiz&city="))).toEqual({
      collectionId: null,
      academicYears: [113],
      examType: null,
      city: null,
      query: "",
      examId: null,
    });
  });
});

describe("writeUrlState", () => {
  it("omits empty values and round-trips", () => {
    const state = {
      collectionId: "ds",
      academicYears: [114, 112],
      examType: "midterm" as const,
      city: null,
      query: "台北 民權",
      examId: "tcool:1",
    };
    const query = writeUrlState(state);

    expect(query).toBe("c=ds&year=114%2C112&type=midterm&q=%E5%8F%B0%E5%8C%97+%E6%B0%91%E6%AC%8A&id=tcool%3A1");
    expect(readUrlState(new URLSearchParams(query))).toEqual(state);
  });

  it("returns an empty string when nothing is set", () => {
    expect(
      writeUrlState({ collectionId: null, academicYears: [], examType: null, city: null, query: "", examId: null }),
    ).toBe("");
  });
});
