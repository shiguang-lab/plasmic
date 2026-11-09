import { CmsColorInput, ContentEntryFormContext } from "@/wab/client/components/cms/CmsInputs";
import { CmsMetaType } from "@/wab/shared/ApiSchema";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";

const pickers = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock("@simonwep/pickr", () => ({ default: {
  create: (options: any) => {
    const handlers = new Map();
    const picker = { options, handlers, setColor: vi.fn(), destroy: vi.fn(),
      on: vi.fn((name, callback) => { handlers.set(name, callback); return picker; }),
      off: vi.fn((name) => handlers.delete(name)),
    };
    pickers.instances.push(picker);
    return picker;
  },
} }));
afterEach(cleanup);

it("synchronizes controlled colors silently, reads the current callback and releases each picker", () => {
  const first = vi.fn(), second = vi.fn();
  const field = (value: string, callback: (value: string | undefined) => void, disabled = false) =>
    <ContentEntryFormContext.Provider value={{ disabled, name: [], typeMeta: { type: CmsMetaType.COLOR }, database: {} as any }}>
      <CmsColorInput value={value} onChange={callback} />
    </ContentEntryFormContext.Provider>;
  const view = render(field("#112233", first));
  const initial = pickers.instances[0];
  view.rerender(field("#445566", second));
  expect(pickers.instances).toHaveLength(1);
  expect(initial.setColor).toHaveBeenLastCalledWith("#445566", true);
  act(() => initial.handlers.get("change")({ toHEXA: () => ({ toString: () => "#778899" }) }));
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith("#778899");
  view.rerender(field("#445566", second, true));
  expect(initial.destroy).toHaveBeenCalledOnce();
  expect(pickers.instances[1].options.disabled).toBe(true);
  view.unmount();
  expect(pickers.instances[1].destroy).toHaveBeenCalledOnce();
});
