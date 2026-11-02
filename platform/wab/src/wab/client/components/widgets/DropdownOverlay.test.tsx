import { ensure } from "@/wab/shared/common";
import DropdownOverlay from "@/wab/client/components/widgets/DropdownOverlay";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

it("forwards the positioning ref and bounded surface props when content owns scrolling", () => {
  const ref = React.createRef<HTMLDivElement>();
  render(<DropdownOverlay ref={ref} scrollable={false}>Options</DropdownOverlay>);
  const root = ensure(screen.getByText("Options").closest<HTMLElement>(".dropdown-overlay"), "Dropdown surface");
  expect(ref.current).toBe(root);
  expect(root.classList.contains("dropdown-overlay")).toBe(true);
  expect(root.style.overflow).toBe("hidden");
  expect(root.style.maxHeight).toBe("80vh");
  expect(root.querySelector("[data-overlayscrollbars]")).toBeNull();
});
