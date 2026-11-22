import { describe, expect, it } from "vitest";
import { checkProjectInput, extractProjectId } from "../lib";

describe("extractProjectId / checkProjectInput", () => {
  it("extracts project id from share URLs with queries, fragments, and trailing slashes", () => {
    expect(
      extractProjectId("https://studio.plasmic.app/projects/Ab123?tab=design")
    ).toBe("Ab123");
    expect(
      extractProjectId("https://studio.plasmic.app/projects/Ab123/?tab=design#top")
    ).toBe("Ab123");
    expect(
      extractProjectId("https://studio.plasmic.app/projects/Ab123#section")
    ).toBe("Ab123");
    expect(extractProjectId("Ab123")).toBe("Ab123");
  });

  it("rejects invalid URLs and malformed bare project inputs", () => {
    for (const invalid of [
      "https://studio.plasmic.app/invalid",
      "https://example.com/projects/Ab123",
      "not valid id",
      "Ab12",
      "",
    ]) {
      expect(checkProjectInput(invalid)).toBe(false);
      expect(() => extractProjectId(invalid)).toThrow();
    }
  });
});
