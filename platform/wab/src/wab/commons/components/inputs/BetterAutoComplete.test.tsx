import { BetterAutoComplete, type AutoCompleteSource } from "@/wab/commons/components/inputs/BetterAutoComplete";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

it("keeps the latest source result and selection while old requests finish late", async () => {
  const first = Promise.withResolvers<string[]>(), second = Promise.withResolvers<string[]>();
  const sourceA: AutoCompleteSource<string> = { query: vi.fn(() => first.promise), render: (value) => value };
  const sourceB: AutoCompleteSource<string> = { query: vi.fn(() => second.promise), render: (value) => value };
  const selected = vi.fn();
  const contents = (source: AutoCompleteSource<string>) => <BetterAutoComplete source={source} defaultIsOpen onSelect={selected}><input aria-label="Entry" /></BetterAutoComplete>;
  const mounted = render(contents(sourceA));
  await waitFor(() => expect(sourceA.query).toHaveBeenCalledOnce());
  mounted.rerender(contents(sourceB));
  await waitFor(() => expect(sourceB.query).toHaveBeenCalledOnce());
  await act(async () => second.resolve(["Beta"]));
  expect(await screen.findByText("Beta")).toBeTruthy();
  await act(async () => first.resolve(["Alpha"]));
  expect(screen.queryByText("Alpha")).toBeNull();
  fireEvent.click(screen.getByText("Beta"));
  expect(selected).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ item: "Beta", source: sourceB, selector: "Click" }));
  mounted.unmount();
});

it("queries controlled text and cancels a pending request on unmount", async () => {
  const pending = Promise.withResolvers<string[]>();
  const source: AutoCompleteSource<string> = { query: vi.fn(() => pending.promise), render: (value) => value };
  const mounted = render(<React.StrictMode><BetterAutoComplete source={source} value="Current" defaultIsOpen><input aria-label="Entry" /></BetterAutoComplete></React.StrictMode>);
  await waitFor(() => expect(source.query).toHaveBeenCalledWith("Current", undefined, 100));
  expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("Current");
  mounted.unmount();
  await act(async () => pending.reject(new Error("Old request failed")));
});
