import {
  applyAiSessionAction,
  snapshotAiSession,
} from "@/wab/client/copilot/ai-session-view";
import { LocalEditSession } from "@/wab/client/copilot/local-edit-session";
import { RemoteAiSessionView } from "@/wab/client/copilot/use-ai-session-view";
import { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { mock } from "vitest-mock-extended";

it("keeps rapid local edits while earlier stream snapshots arrive, then accepts server changes", async () => {
  const api = mock<TopFrameApi>();
  const view = new RemoteAiSessionView(api, "project");
  const service = new LocalEditSession("project");
  view.update(snapshotAiSession(service));
  const listener = vi.fn();
  const dispose = view.subscribe(listener);
  const first = { prompt: "A", attachments: [] };
  const second = { prompt: "AB", attachments: [] };
  view.draft = first;
  view.draft = second;
  await applyAiSessionAction(service, { type: "draft", value: first, threadId: service.activeThreadId });
  view.update(snapshotAiSession(service));
  expect(view.draft.prompt).toBe("AB");
  await applyAiSessionAction(service, { type: "draft", value: second, threadId: service.activeThreadId });
  view.update(snapshotAiSession(service));
  service.draft = { prompt: "", attachments: [] };
  view.update(snapshotAiSession(service));
  expect(view.draft.prompt).toBe("");
  expect(api.updateAiSession).toHaveBeenNthCalledWith(1, "project", {
    type: "draft",
    threadId: service.activeThreadId,
    value: first,
  });
  expect(api.updateAiSession).toHaveBeenNthCalledWith(2, "project", {
    type: "draft",
    threadId: service.activeThreadId,
    value: second,
  });
  expect(listener).toHaveBeenCalledTimes(5);
  dispose();
  view.update(snapshotAiSession(service));
  expect(listener).toHaveBeenCalledTimes(5);
});
it("sends execution to the top frame and reads ownership from the service snapshot", async () => {
  const api = mock<TopFrameApi>();
  const service = new LocalEditSession("project");
  const view = new RemoteAiSessionView(api, "project");
  view.update(snapshotAiSession(service));
  await view.run("Edit this page", undefined, "auto", [], "model");
  expect(api.updateAiSession).toHaveBeenCalledWith("project", {
    type: "run",
    args: ["Edit this page", undefined, "auto", [], "model", service.activeThreadId],
  });
  view.selectedModel = "model";
  view.update(snapshotAiSession(service));
  expect(view.selectedModel).toBe("model");
  service.selectedModel = "model";
  view.update(snapshotAiSession(service));
  service.selectedModel = "new-model";
  view.update(snapshotAiSession(service));
  expect(view.selectedModel).toBe("new-model");
});

it("keeps a new topic and its draft when an older topic snapshot arrives during the bridge round trip", async () => {
  const api = mock<TopFrameApi>();
  const service = new LocalEditSession("project");
  service.newThread("topic-a");
  service.draft = {prompt: "A draft", attachments: []};
  const view = new RemoteAiSessionView(api, "project");
  view.update(snapshotAiSession(service));
  view.newThread("topic-b");
  view.draft = {prompt: "B draft", attachments: []};
  view.update(snapshotAiSession(service));
  expect(view.activeThreadId).toBe("topic-b");
  expect(view.draft.prompt).toBe("B draft");
  await applyAiSessionAction(service, {type: "newThread", args: ["topic-b"]});
  view.update(snapshotAiSession(service));
  expect(view.draft.prompt).toBe("B draft");
  await applyAiSessionAction(service, {type: "draft", threadId: "topic-b", value: {prompt: "B draft", attachments: []}});
  view.update(snapshotAiSession(service));
  expect(view.draft.prompt).toBe("B draft");
  await service.selectThread("topic-a");
  view.update(snapshotAiSession(service));
  expect(view.draft.prompt).toBe("A draft");
  expect(api.updateAiSession).toHaveBeenCalledWith("project", {type: "draft", threadId: "topic-b", value: {prompt: "B draft", attachments: []}});
});
