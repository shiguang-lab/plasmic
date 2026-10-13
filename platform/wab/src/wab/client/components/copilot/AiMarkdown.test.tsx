import { AiMarkdown } from "@/wab/client/components/copilot/AiMarkdown";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

vi.mock("@/wab/client/i18n",() => ({useI18n:()=>({t:(text:string)=>text})}));
afterEach(cleanup);
it("renders lists and tables while keeping model HTML and external images inert",() => {
  const {container}=render(<AiMarkdown>{"# Heading\n\n- One\n- Two\n\n| Name | Value |\n| --- | --- |\n| Count | 1 |\n\n<script>window.hacked=true</script>\n\n[Unsafe](javascript:alert(1))\n\n![Reference](https://example.test/image.png)"}</AiMarkdown>);
  expect(screen.getByRole("heading",{name:"Heading"})).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(screen.queryByRole("link",{name:"Unsafe"})).toBeNull();
  expect(screen.getByText("Unsafe")).toBeInTheDocument();
});
it("copies the displayed fenced code without interpreting it",() => {
  const writeText=vi.fn().mockResolvedValue(undefined);
  const descriptor=Object.getOwnPropertyDescriptor(navigator,"clipboard");
  Object.defineProperty(navigator,"clipboard",{value:{writeText},configurable:true});
  try {
    render(<AiMarkdown>{"```js\nconst counter = 1;\n```"}</AiMarkdown>);
    fireEvent.click(screen.getByRole("button",{name:"Copy"}));
    expect(writeText).toHaveBeenCalledWith("const counter = 1;\n");
  } finally {
    if(descriptor) { Object.defineProperty(navigator,"clipboard",descriptor); }
    else { Reflect.deleteProperty(navigator,"clipboard"); }
  }
});
