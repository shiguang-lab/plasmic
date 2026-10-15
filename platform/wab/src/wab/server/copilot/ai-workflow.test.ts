import { aiChatRun } from "@/wab/server/copilot/ai-workflow";
import type { LocalEditResponse } from "@/wab/shared/copilot/local-edit";
const fixture = vi.hoisted(() => {
  const order: string[] = [],
    names = new Map<string, string>();
  const state = {
    status: "running",
    changed: false,
    componentUuid: "page" as string | null,
  };
  const a = {
    loadRun: vi.fn(async () => ({
      status: state.status,
      hasChanges: state.changed,
      task: {
        binding: {
          componentUuid: state.componentUuid,
          canvasName: state.componentUuid ? undefined : "PageGroup",
          elementUuids: [],
        },
      },
    })),
    runState: vi.fn(async () => ({ status: state.status })),
    chooseIntent: vi.fn(async () => undefined),
    requestTool: vi.fn(async (_run: string, id: string, name: string) => {
      names.set(id, name);
      order.push(name);
      if (name === "changeElement") {
        state.changed = true;
      }
    }),
    readTool: vi.fn(async (id: string) => ({
      status: "completed",
      result: {
        result:
          names.get(id) === "validate" ? '{"valid":true}' : '{"revision":12}',
        binding: {},
        changed: false,
      },
    })),
    setRun: vi.fn(async (_run: string, patch: { status?: string }) => {
      if (patch.status) {
        state.status = patch.status;
      }
    }),
    modelStep: vi.fn(
      async (
        _run: string,
        step: number,
        _resources: string[],
        channel: string,
      ): Promise<LocalEditResponse> => {
        order.push(channel);
        return channel === "answer"
          ? { text: "Saved revision 12", calls: [] }
          : {
              text: "Working",
              calls:
                step === 0
                  ? [
                      {
                        id: "change",
                        name: "changeElement",
                        input: { text: "Updated" },
                      },
                    ]
                  : [],
            };
      },
    ),
    recordModelResult: vi.fn(async () => {}),
  };
  return { a, order, state, names };
});
vi.mock("@temporalio/workflow", () => ({
  proxyActivities: () => fixture.a,
  sleep: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  fixture.order.length = 0;
  fixture.state.status = "running";
  fixture.state.changed = false;
  fixture.state.componentUuid = "page";
  fixture.names.clear();
});
it("validates and saves before requesting the explicit final answer channel", async () => {
  await aiChatRun("run");
  expect(fixture.order).toEqual([
    "read",
    "read",
    "commentary",
    "changeElement",
    "commentary",
    "validate",
    "save",
    "answer",
  ]);
  expect(fixture.a.modelStep.mock.calls.map((call) => call[3])).toEqual([
    "commentary",
    "commentary",
    "answer",
  ]);
  expect(fixture.a.setRun).toHaveBeenLastCalledWith("run", {
    status: "completed",
    phase: "Completed",
  });
  expect(fixture.a.modelStep.mock.calls.at(-1)?.[2]).toEqual([
    "run:0",
    "run:1",
    "run:3",
    "run:4",
  ]);
});

it("passes the explicitly declared failed call identity to the retry operation", async () => {
  fixture.a.modelStep.mockImplementationOnce(async () => ({
    text: "Read context",
    calls: [{ id: "bad-context", name: "getEditorContext", input: {} }],
  }));
  fixture.a.modelStep.mockImplementationOnce(async () => ({
    text: "Retry context",
    calls: [
      {
        id: "retry-context",
        name: "getEditorContext",
        input: {},
        retryOf: "bad-context",
      },
    ],
  }));
  fixture.a.readTool.mockImplementation(async (id) => ({
    status: id === "run:2" ? "failed" : "completed",
    error: "Invalid arguments",
    result: {
      result: fixture.names.get(id) === "validate" ? '{"valid":true}' : "{}",
      binding: {},
      changed: false,
    },
  }));
  await aiChatRun("run");
  expect(fixture.a.requestTool).toHaveBeenCalledWith(
    "run",
    "run:3",
    "getEditorContext",
    {},
    "run:2",
  );
  expect(fixture.a.recordModelResult).toHaveBeenCalledWith(
    "run",
    0,
    "bad-context",
    undefined,
    "Invalid arguments",
  );
  expect(fixture.a.setRun).toHaveBeenLastCalledWith("run", {
    status: "completed",
    phase: "Completed",
  });
});

it("runs from the canvas overview without requiring a focused page", async () => {
  fixture.state.componentUuid = null;
  await aiChatRun("run");
  expect(fixture.a.requestTool).toHaveBeenCalledWith(
    "run",
    "run:0",
    "getEditorContext",
    {},
    undefined,
  );
  expect(fixture.a.requestTool).toHaveBeenCalledWith(
    "run",
    "run:1",
    "read",
    {},
    undefined,
  );
  expect(fixture.a.setRun).toHaveBeenLastCalledWith("run", {
    status: "completed",
    phase: "Completed",
  });
});
