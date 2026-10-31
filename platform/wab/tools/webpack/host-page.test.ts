import { createHash } from "crypto";
import { buildHostPage } from "./host-page";

it("addresses the exact emitted HTML and changes identity when its rendered content changes", () => {
  const source =
    '<script src="/client.<%= commitHash %>.js"></script><%= studioUrl %>';
  const page = buildHostPage(source, {
    commitHash: "abc123",
    studioUrl: "https://studio.example",
  });
  expect(page.path).toBe(
    `/static/host.${createHash("sha256").update(page.html).digest("hex")}.html`,
  );
  expect(
    buildHostPage(source, {
      commitHash: "abc123",
      studioUrl: "https://studio.example",
    }),
  ).toEqual(page);
  expect(
    buildHostPage(source, {
      commitHash: "def456",
      studioUrl: "https://studio.example",
    }).path,
  ).not.toBe(page.path);
  expect(
    buildHostPage(source, {
      commitHash: "abc123",
      studioUrl: "https://other.example",
    }).path,
  ).not.toBe(page.path);
});
