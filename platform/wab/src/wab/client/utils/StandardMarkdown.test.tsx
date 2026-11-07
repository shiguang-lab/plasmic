import { StandardMarkdown } from "@/wab/client/utils/StandardMarkdown";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/user-mentions/UserMentionDisplay", () => ({
  UserMentionDisplay: ({ email }: { email: string }) => <span data-testid="mention">{email}</span>,
}));
afterEach(cleanup);

it("preserves GFM tables, external link behavior and the default wrapper", () => {
  const view = render(<StandardMarkdown>{"[Docs](https://example.com)\n\n| Name | Value |\n| --- | --- |\n| Item | **Ready** |"}</StandardMarkdown>);
  expect(view.container.firstElementChild?.className).toBe("markdown-body");
  const link = screen.getByRole("link", { name: "Docs" });
  expect(link.getAttribute("href")).toBe("https://example.com");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.getByText("Ready").tagName).toBe("STRONG");
});

it("preserves registered user mentions and keeps unsafe URL schemes blocked", () => {
  render(<StandardMarkdown>{"Hello @<person@example.com> and [unsafe](javascript:alert%281%29)."}</StandardMarkdown>);
  expect(screen.getByTestId("mention").textContent).toBe("person@example.com");
  expect(screen.getByText("unsafe").tagName).toBe("A");
  expect(screen.getByText("unsafe").getAttribute("href") ?? "").toBe("");
});

it("honors caller classes and custom paragraph renderers", () => {
  const view = render(<StandardMarkdown className="flex-col" components={{ p: "span" }}>Text</StandardMarkdown>);
  expect(view.container.firstElementChild?.className).toBe("flex-col");
  expect(screen.getByText("Text").tagName).toBe("SPAN");
});
