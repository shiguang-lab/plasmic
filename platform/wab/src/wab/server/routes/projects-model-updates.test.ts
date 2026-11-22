import { mergePartialChangesBundles } from "@/wab/server/routes/projects";

describe("mergePartialChangesBundles", () => {
  it("merges sequential partial changes without mutating input bundles or cached nodes", () => {
    const partialChanges = [
      {
        data: JSON.stringify({
          root: "0",
          version: "256",
          deps: ["dep-1"],
          map: {
            n1: { __type: "TplTag", tag: "div", attrs: ["a"] },
            n2: { __type: "TplTag", tag: "span" },
          },
        }),
        deletedIids: JSON.stringify(["old-1"]),
        modifiedComponentIids: ["c1"],
      },
      {
        data: JSON.stringify({
          root: "0",
          version: "256",
          deps: ["dep-1", "dep-2"],
          map: {
            n1: { __type: "TplTag", attrs: ["b"] },
            n3: { __type: "TplTag", tag: "p" },
          },
        }),
        deletedIids: JSON.stringify(["n2"]),
        modifiedComponentIids: ["c2"],
      },
      {
        data: JSON.stringify({
          root: "0",
          version: "256",
          deps: ["dep-1", "dep-2"],
          map: {
            n2: { __type: "TplTag", tag: "section" },
            n1: { __type: "TplTag", tag: "main" },
          },
        }),
        deletedIids: JSON.stringify(["n3"]),
        modifiedComponentIids: ["c1", "c3"],
      },
    ];

    const merged = mergePartialChangesBundles(partialChanges, "256");
    expect(merged).toEqual({
      data: {
        root: "0",
        version: "256",
        deps: ["dep-1", "dep-2"],
        map: {
          n1: { __type: "TplTag", tag: "main", attrs: ["b"] },
          n2: { __type: "TplTag", tag: "section" },
          n3: { __type: "TplTag", tag: "p" },
        },
      },
      deletedIids: ["old-1", "n3"],
      modifiedComponentIids: ["c1", "c2", "c3"],
    });
  });
});
