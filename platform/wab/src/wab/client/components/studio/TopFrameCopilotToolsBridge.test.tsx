import { TopFrameCopilotToolsBridge } from "@/wab/client/components/studio/TopFrameCopilotToolsBridge";
import { render, waitFor } from "@testing-library/react";
import React from "react";

const frame = vi.hoisted(() => ({
  hostFrameApiReady: true,
  hostFrameApi: {
    cancelCopilotToolCall: vi.fn(async (_requestId: string) => {}),
    clearCopilotCallerActivity: vi.fn(async (_callerId: string) => {}),
    waitForStudioReady: vi.fn(async () => {}),
    executeCopilotToolCall: vi.fn(
      async (_name: string, _input: Record<string, unknown>) => ({
        success: true,
        output: "{}",
      }),
    ),
  },
}));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  useTopFrameCtx: () => frame,
}));

afterEach(() => {
  delete window.PLASMIC_AI_TOOLS;
  vi.clearAllMocks();
  frame.hostFrameApiReady = true;
});

describe("prototype browser bridge", () => {
  it("forwards active cancellation by request id without releasing the edit queue", async () => {
    let release = () => {};
    frame.hostFrameApi.executeCopilotToolCall.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return { success: true, output: "{}" };
    });
    const rendered = render(<TopFrameCopilotToolsBridge />);
    const tools = window.PLASMIC_AI_TOOLS;
    if (!tools) throw new Error("Bridge missing");
    const controller = new AbortController();
    const first = tools.read({}, undefined, controller.signal);
    const second = tools.read({});
    await waitFor(() => expect(frame.hostFrameApi.executeCopilotToolCall).toHaveBeenCalledTimes(1));
    await tools._clearCallerActivity("disconnected-session");
    expect(frame.hostFrameApi.clearCopilotCallerActivity).toHaveBeenCalledWith("disconnected-session");
    controller.abort();
    expect(frame.hostFrameApi.cancelCopilotToolCall).toHaveBeenCalledWith(expect.any(String));
    const requestId = frame.hostFrameApi.cancelCopilotToolCall.mock.calls[0][0];
    expect(frame.hostFrameApi.executeCopilotToolCall).toHaveBeenCalledWith("read", {}, undefined, undefined, requestId);
    expect(frame.hostFrameApi.executeCopilotToolCall).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(frame.hostFrameApi.executeCopilotToolCall).toHaveBeenCalledTimes(2);
    rendered.unmount();
  });
  it("does not execute a stopped local operation waiting in the shared MCP queue", async () => {
    let release = () => {};
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    frame.hostFrameApi.executeCopilotToolCall.mockImplementationOnce(
      async () => {
        await paused;
        return { success: true, output: "{}" };
      },
    );
    const rendered = render(<TopFrameCopilotToolsBridge />);
    const tools = window.PLASMIC_AI_TOOLS;
    if (!tools) {
      throw new Error("Bridge missing");
    }
    const first = tools.read({});
    const controller = new AbortController();
    const local = tools._executeLocal({}, controller.signal);
    await waitFor(() =>
      expect(frame.hostFrameApi.executeCopilotToolCall).toHaveBeenCalledTimes(
        1,
      ),
    );
    controller.abort();
    release();
    await first;
    expect(await local).toMatchObject({ success: false });
    expect(frame.hostFrameApi.executeCopilotToolCall).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });
  it("appears only after host connection and cleans up on navigation", () => {
    frame.hostFrameApiReady = false;
    const rendered = render(<TopFrameCopilotToolsBridge />);
    expect(window.PLASMIC_AI_TOOLS).toBeUndefined();
    frame.hostFrameApiReady = true;
    rendered.rerender(<TopFrameCopilotToolsBridge />);
    expect(window.PLASMIC_AI_TOOLS?._meta.insertHtml.inputSchema).toBeDefined();
    rendered.unmount();
    expect(window.PLASMIC_AI_TOOLS).toBeUndefined();
  });

  it("serializes concurrent calls instead of racing edits", async () => {
    let release = () => {};
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    frame.hostFrameApi.executeCopilotToolCall.mockImplementationOnce(
      async () => {
        await paused;
        return { success: true, output: "{}" };
      },
    );
    const rendered = render(<TopFrameCopilotToolsBridge />);
    const tools = window.PLASMIC_AI_TOOLS;
    if (!tools) {
      throw new Error("Bridge missing");
    }
    const codex = { id: "codex", name: "Codex" }, chatgpt = { id: "chatgpt", name: "ChatGPT" };
    const first = tools.createComponent({ name: "First" }, codex);
    const second = tools.read({}, chatgpt);
    await waitFor(() =>
      expect(frame.hostFrameApi.executeCopilotToolCall).toHaveBeenCalledTimes(
        1,
      ),
    );
    release();
    await Promise.all([first, second]);
    expect(
      frame.hostFrameApi.executeCopilotToolCall.mock.calls.map((c) => c[0]),
    ).toEqual(["createComponent", "read"]);
    expect(frame.hostFrameApi.executeCopilotToolCall).toHaveBeenNthCalledWith(1, "createComponent", { name: "First" }, undefined, codex);
    expect(frame.hostFrameApi.executeCopilotToolCall).toHaveBeenNthCalledWith(2, "read", {}, undefined, chatgpt);
    rendered.unmount();
  });

  it("returns a structured transport error and continues with the next call", async () => {
    frame.hostFrameApi.waitForStudioReady.mockRejectedValueOnce(
      new Error("Disconnected"),
    );
    const rendered = render(<TopFrameCopilotToolsBridge />);
    const tools = window.PLASMIC_AI_TOOLS;
    if (!tools) {
      throw new Error("Bridge missing");
    }
    expect(await tools.read({})).toMatchObject({
      success: false,
      error: { type: "EXECUTION_FAILED", message: "Disconnected" },
    });
    expect(await tools.read({})).toMatchObject({ success: true });
    rendered.unmount();
    expect(await tools.createComponent({ name: "Stale" })).toMatchObject({
      success: false,
    });
    expect(frame.hostFrameApi.executeCopilotToolCall).toHaveBeenCalledTimes(1);
  });
});
