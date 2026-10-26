import { render } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { FormWrapper as SchemaForm } from "../src/form/SchemaForm";

const dataResult = vi.hoisted(() => ({ current: { isLoading: false } }));
vi.mock("@plasmicapp/data-sources", async (importOriginal) => ({
  ...await importOriginal<typeof import("@plasmicapp/data-sources")>(),
  usePlasmicDataOp: () => dataResult.current,
}));

test.each(["advanced", "simplified"] as const)("%s Form preserves caller styles", (mode) => {
  const view = render(<SchemaForm mode={mode} style={{ width: 420, opacity: 0.8 }} />);
  const form = view.container.querySelector("form")!;
  expect(form.style.width).toBe("420px");
  expect(form.style.opacity).toBe("0.8");
});

test("SchemaForm merges loading styles and restores caller styles when data finishes loading", () => {
  const form = (
    <SchemaForm
      mode="simplified"
      data={{ sourceId: "source", opId: "query", userArgs: {} } as any}
      style={{ width: 420, opacity: 0.8, transition: "opacity 200ms linear" }}
    />
  );
  dataResult.current = { isLoading: true };
  const view = render(form);
  expect(view.container.querySelector("form")?.style.width).toBe("420px");
  expect(view.container.querySelector("form")?.style.opacity).toBe("0.5");
  dataResult.current = { isLoading: false };
  view.rerender(React.cloneElement(form));
  expect(view.container.querySelector("form")?.style.width).toBe("420px");
  expect(view.container.querySelector("form")?.style.opacity).toBe("0.8");
  expect(view.container.querySelector("form")?.style.transition).toBe("opacity 200ms linear");
});
