import { AiMarkdown } from "@/wab/client/components/copilot/AiMarkdown";
import { copyToClipboard } from "@shiguang2/components/esm/x-markdown/utils/clipboard";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
vi.mock("@shiguang2/components/esm/x-markdown/utils/clipboard", () => ({
  copyToClipboard: vi.fn(() => true),
}));
afterEach(cleanup);
it("renders lists and tables while keeping model HTML and external images inert", () => {
  const { container } = render(
    <AiMarkdown>
      {
        "# Heading\n\n- One\n- Two\n\n| Name | Value |\n| --- | --- |\n| Count | 1 |\n\n<script>window.hacked=true</script>\n\n[Unsafe](javascript:alert(1))\n\n![Reference](https://example.test/image.png)"
      }
    </AiMarkdown>,
  );
  expect(screen.getByRole("heading", { name: "Heading" })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(screen.queryByRole("link", { name: "Unsafe" })).toBeNull();
  expect(screen.getByText("Unsafe")).toBeInTheDocument();
});
it("copies the displayed fenced code without interpreting it", () => {
  render(<AiMarkdown>{"```js\nconst counter = 1;\n```"}</AiMarkdown>);
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  expect(copyToClipboard).toHaveBeenCalledWith("const counter = 1;\n");
  expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
});

it("does not claim success when copying fails", () => {
  vi.mocked(copyToClipboard).mockReturnValueOnce(false);
  render(<AiMarkdown>{"```js\nconst counter = 1;\n```"}</AiMarkdown>);
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
});

it("highlights code and opens a bounded fullscreen viewer", () => {
  const { container } = render(
    <AiMarkdown>
      {"```typescript\nconst title: string = 'Studio';\n```"}
    </AiMarkdown>,
  );
  expect(container.querySelector("pre code .token")?.textContent).toBe("const");
  expect(container.querySelector("pre pre")).toBeNull();
  expect(screen.getByText("typescript")).toBeInTheDocument();
  const code = container.querySelector('[data-test-id="ai-code-block"]');
  expect(code?.querySelector("[data-overlayscrollbars]")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(
    screen.getByRole("dialog").querySelector("[data-overlayscrollbars]"),
  ).toBeInTheDocument();
});

it("renders known inline node names and node links with the same locate action", () => {
  const node = {
    uuid: "node-1",
    name: "StatusFilter",
    page: "page",
    branch: null,
  };
  const locate = vi.fn();
  render(
    <AiMarkdown nodes={[node]} onLocate={locate}>
      {"Updated `StatusFilter`. Open [StatusFilter](#plasmic-node/node-1)."}
    </AiMarkdown>,
  );
  const references = screen.getAllByRole("button", {
    name: "Locate node {name}",
  });
  expect(references).toHaveLength(2);
  references.forEach((reference) => fireEvent.click(reference));
  expect(locate).toHaveBeenNthCalledWith(1, node);
  expect(locate).toHaveBeenNthCalledWith(2, node);
});

it("handles a node link read by the model without opening a browser URL", () => {
  const locate = vi.fn();
  render(
    <AiMarkdown onLocate={locate}>
      {"[CreateGroup](#plasmic-node/actual-node-uuid)"}
    </AiMarkdown>,
  );
  expect(screen.queryByRole("link")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Locate node {name}" }));
  expect(locate).toHaveBeenCalledWith({
    uuid: "actual-node-uuid",
    name: "CreateGroup",
    page: null,
    branch: null,
  });
});

it("keeps malformed node links and ordinary inline code inert", () => {
  render(
    <AiMarkdown>
      {"`const title = 'Studio'` [Bad node](#plasmic-node/../../other)"}
    </AiMarkdown>,
  );
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByText("Bad node")).toBeInTheDocument();
});

it("renders incomplete fenced code during streaming and preserves the finalized text", () => {
  const rendered = render(
    <AiMarkdown running>{'```json\n{"title": "Studio"}'}</AiMarkdown>,
  );
  expect(
    rendered.container.querySelector('[data-test-id="ai-code-block"]'),
  ).toBeInTheDocument();
  rendered.rerender(
    <AiMarkdown>{'```json\n{"title": "Studio"}\n```'}</AiMarkdown>,
  );
  expect(rendered.container.querySelector("pre code")?.textContent).toContain(
    '{"title": "Studio"}',
  );
});

it("renders math with XMarkdown's existing formula renderer", () => {
  const { container } = render(
    <AiMarkdown>
      {"Inline $x^2$ and a formula:\n\n$$\nx^2 + y^2 = z^2\n$$"}
    </AiMarkdown>,
  );
  expect(container.querySelectorAll(".katex")).toHaveLength(2);
});
