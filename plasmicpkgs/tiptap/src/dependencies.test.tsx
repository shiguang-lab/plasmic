// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import MentionExtension from "@tiptap/extension-mention";
import { afterEach, expect, it, vi } from "vitest";
import { TiptapContextProvider, useTiptapContext } from "./contexts";
import { Mention } from "./registerMention";
import { Bold } from "./registerBold";
import { Italic } from "./registerItalic";
import { Strike } from "./registerStrike";
import { Underline } from "./registerUnderline";
import { Code } from "./registerCode";
import { Link } from "./registerLink";

let current: ReturnType<typeof useTiptapContext>;
function Capture() { current = useTiptapContext(); return null; }
afterEach(() => { cleanup(); vi.useRealTimers(); });

it.each([[Bold, "bold"], [Italic, "italic"], [Strike, "strike"], [Underline, "underline"], [Code, "code"], [Link, "link"]] as const)(
  "%s preserves initial extension configuration across ordinary rerenders", (Component, key) => {
    const content = (className: string) => <TiptapContextProvider><Capture /><Component className={className} /></TiptapContextProvider>;
    const view = render(content("first"));
    expect(current[key]?.options.HTMLAttributes.class).toBe("first");
    view.rerender(content("current"));
    expect(current[key]?.options.HTMLAttributes.class).toBe("first");
  },
);

it("reads current mention data without reinstalling the extension and cancels pending installation", async () => {
  vi.useFakeTimers();
  function Fixture({ data, show = true }: { data: { id: string }[]; show?: boolean }) {
    return <TiptapContextProvider><Capture />{show && <Mention {...MentionExtension.options} className="mention" dataStatic={data} suggestionItem={<span>Result</span>} />}</TiptapContextProvider>;
  }
  const view = render(<Fixture data={[{ id: "Alice" }]} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  const extension = current.mention;
  expect(await extension?.options.suggestion.items?.({ query: "a" } as any)).toEqual([{ id: "Alice" }]);
  view.rerender(<Fixture data={[{ id: "Bob" }]} />);
  expect(current.mention).toBe(extension);
  expect(await extension?.options.suggestion.items?.({ query: "b" } as any)).toEqual([{ id: "Bob" }]);
  view.rerender(<Fixture data={[]} show={false} />);
  expect(current.mention).toBeUndefined();
  view.rerender(<Fixture data={[{ id: "Carol" }]} />);
  view.rerender(<Fixture data={[]} show={false} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(current.mention).toBeUndefined();
});
