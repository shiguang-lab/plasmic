import { useLocalAiStatus } from "@/wab/client/copilot/use-local-ai-status";
import { LocalAiStatus } from "@/wab/shared/copilot/local-edit";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { SWRConfig } from "swr";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/copilot/local-edit-session", () => ({
  localAiFetch: request,
}));
const status: LocalAiStatus = {
  configured: true,
  model: "model",
  models: ["model", "alternate"],
  pageGenerationEnabled: true,
};
afterEach(cleanup);
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(status);
});
function View({
  project,
  enabled,
  label,
}: {
  project: string;
  enabled: boolean;
  label: string;
}) {
  const { data } = useLocalAiStatus(project, enabled);
  return (
    <div>
      {label}: {data?.model ?? "loading"}
    </div>
  );
}
function Page({
  project = "project",
  enabled = true,
}: {
  project?: string;
  enabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <View project={project} enabled={enabled} label="Page" />
      <button onClick={() => setOpen(!open)}>Toggle AI</button>
      {open && (
        <>
          <View project={project} enabled={enabled} label="Panel" />
          <View project={project} enabled={enabled} label="Chat" />
        </>
      )}
    </>
  );
}
it("prefetches before opening AI, coalesces pending consumers and reuses data after reopening", async () => {
  let finish: (value: LocalAiStatus) => void = () => {
    throw new Error("Missing deferred request");
  };
  request.mockImplementationOnce(
    () =>
      new Promise<LocalAiStatus>((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Page />
    </SWRConfig>,
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledExactlyOnceWith("project", "status"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Toggle AI" }));
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(status);
  });
  await screen.findByText("Panel: model");
  await screen.findByText("Chat: model");
  fireEvent.click(screen.getByRole("button", { name: "Toggle AI" }));
  fireEvent.click(screen.getByRole("button", { name: "Toggle AI" }));
  expect(screen.getByText("Panel: model")).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(1);
});
it("waits for feature/permission enablement and fetches a separate catalog when switching projects", async () => {
  const cache = new Map();
  const ui = (project: string, enabled: boolean) => (
    <SWRConfig value={{ provider: () => cache }}>
      <Page project={project} enabled={enabled} />
    </SWRConfig>
  );
  const { rerender } = render(ui("first", false));
  expect(request).not.toHaveBeenCalled();
  rerender(ui("first", true));
  await screen.findByText("Page: model");
  expect(request).toHaveBeenCalledExactlyOnceWith("first", "status");
  rerender(ui("second", true));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(request).toHaveBeenLastCalledWith("second", "status");
});
