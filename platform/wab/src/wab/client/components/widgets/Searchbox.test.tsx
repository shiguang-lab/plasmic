import Searchbox from "@/wab/client/components/widgets/Searchbox";
import type { TextboxRef } from "@/wab/client/components/widgets/Textbox";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
beforeEach(() => vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("forwards its real input handle and clears through the native change contract", () => {
  const inputRef = React.createRef<TextboxRef>();
  const values: string[] = [];
  render(<Searchbox ref={inputRef} value="Query" onChange={(event) => values.push(event.target.value)} />);
  const input = screen.getByRole("textbox") as HTMLInputElement;
  expect(inputRef.current?.input()).toBe(input);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(values).toEqual([""]);
  expect(inputRef.current?.input()).toBe(input);
});
