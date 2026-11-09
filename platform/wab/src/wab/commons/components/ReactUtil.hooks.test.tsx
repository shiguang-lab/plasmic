import { useCommittedValue } from "@/wab/commons/components/ReactUtil";
import { act, cleanup, render } from "@testing-library/react";
import * as React from "react";

afterEach(cleanup);

it("keeps event reads on committed inputs while a replacement render is suspended", () => {
  let read: (() => string) | undefined;
  const pending = new Promise<void>(() => undefined);
  function Probe({ value, suspend = false }: { value: string; suspend?: boolean }) {
    read = useCommittedValue(value);
    if (suspend) { throw pending; }
    return <span>{value}</span>;
  }
  const mounted = render(<React.StrictMode><React.Suspense fallback="Waiting"><Probe value="committed" /></React.Suspense></React.StrictMode>);
  const committedRead = read;
  expect(committedRead?.()).toBe("committed");
  act(() => {
    React.startTransition(() => mounted.rerender(<React.StrictMode><React.Suspense fallback="Waiting"><Probe value="abandoned" suspend /></React.Suspense></React.StrictMode>));
  });
  expect(committedRead?.()).toBe("committed");
  mounted.rerender(<React.StrictMode><React.Suspense fallback="Waiting"><Probe value="next" /></React.Suspense></React.StrictMode>);
  expect(read).toBe(committedRead);
  expect(committedRead?.()).toBe("next");
});
