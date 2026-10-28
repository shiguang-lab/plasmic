import { AntdConfigProvider } from "@/wab/client/antd-theme";
import {
  AiRunningNotice,
  AiThreadPicker,
} from "@/wab/client/components/copilot/AiThreadPicker";
import { LocalEditSession } from "@/wab/client/copilot/local-edit-session";
import type { AiTask, AiThread } from "@/wab/shared/copilot/ai-chat";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
function thread(id: string, title: string): AiThread {
  return {
    id,
    title,
    projectId: "project",
    branchId: null,
    createdBy: "user",
    createdAt: "2026-10-28T00:00:00Z",
    lastMessageAt: "2026-10-28T00:00:00Z",
    archivedAt: null,
    seq: 1,
  };
}
function mount(session: LocalEditSession, disabled = false) {
  function View() {
    React.useSyncExternalStore(session.subscribe, session.snapshot);
    return (
      <AntdConfigProvider productUI>
        <AiThreadPicker session={session} disabled={disabled} />
      </AntdConfigProvider>
    );
  }
  return render(<View />);
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("does not offer conversation requests when AI editing is disabled", () => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  mount(new LocalEditSession("project"), true);
  expect(
    screen.getByRole("button", { name: "Switch conversation" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "New conversation" }),
  ).toBeDisabled();
  expect(request).not.toHaveBeenCalled();
});

it("selects a topic, preserves its draft and supports rename, archive and restoration", async () => {
  const rows = [
    thread(first, "Customer layout"),
    thread(second, "Customer validation"),
  ];
  const request = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/threads?")) {
      const params = new URL(url, "http://localhost").searchParams;
      return {
        ok: true,
        json: async () => ({
          threads: rows.filter(
            (row) =>
              !!row.archivedAt === (params.get("archived") === "1") &&
              row.title
                .toLowerCase()
                .includes((params.get("query") ?? "").toLowerCase()),
          ),
        }),
      };
    }
    if (init?.method === "POST") {
      const row = rows.find((value) => url.endsWith(value.id));
      if (!row) {
        throw Error("Unknown test conversation");
      }
      const patch = JSON.parse(String(init.body));
      if (patch.title) {
        row.title = patch.title;
      }
      if (patch.archived !== undefined) {
        row.archivedAt = patch.archived ? "2026-10-28T01:00:00Z" : null;
      }
      row.seq++;
      return { ok: true, json: async () => ({ ...row }) };
    }
    return { ok: true, json: async () => ({ tasks: [] }) };
  });
  vi.stubGlobal("fetch", request);
  const session = new LocalEditSession("project");
  session.newThread();
  mount(session);
  fireEvent.click(screen.getByRole("button", { name: "Switch conversation" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /^Customer layout/ }),
  );
  await waitFor(() => expect(session.activeThreadId).toBe(first));
  act(() => {
    session.draft = { prompt: "Keep this request", attachments: [] };
  });
  fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
  expect(session.activeThreadId).not.toBe(first);
  fireEvent.click(screen.getByRole("button", { name: "Switch conversation" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /^Customer layout/ }),
  );
  expect(session.draft.prompt).toBe("Keep this request");
  fireEvent.click(screen.getByRole("button", { name: "Switch conversation" }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Conversation actions: Customer layout",
    }),
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Rename conversation" }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Conversation name" }), {
    target: { value: "Customer search" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(session.activeThread?.title).toBe("Customer search"),
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Conversation actions: Customer search",
    }),
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Archive conversation" }),
  );
  await waitFor(() => expect(session.activeThreadId).not.toBe(first));
  fireEvent.click(
    screen.getByRole("button", { name: "Archived conversations" }),
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Conversation actions: Customer search",
    }),
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Restore conversation" }),
  );
  await waitFor(() => expect(rows[0].archivedAt).toBeNull());
});

it.each([false, true])(
  "searches the directory and disables archiving a blocked conversation (verification=%s)",
  async (needsReconciliation) => {
    const running = {
      ...thread(first, "Running layout"),
      lastTask: {
        id: "run",
        prompt: "Improve layout",
        status: needsReconciliation
          ? ("stopped" as const)
          : ("running" as const),
        needsReconciliation,
        createdAt: "2026-10-28T00:00:00Z",
      },
    };
    const request = vi.fn(async () => ({
      ok: true,
      json: async () => ({ threads: [running] }),
    }));
    vi.stubGlobal("fetch", request);
    mount(new LocalEditSession("project"));
    fireEvent.click(
      screen.getByRole("button", { name: "Switch conversation" }),
    );
    await screen.findByRole("button", {
      name: "Conversation actions: Running layout",
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search conversations" }),
      { target: { value: "layout" } },
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.stringContaining("query=layout"),
        expect.anything(),
      ),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Conversation actions: Running layout",
      }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Archive conversation" }),
    ).toHaveAttribute("aria-disabled", "true");
  },
);

it("offers a route back to a conversation requiring saved-design verification", () => {
  const session = new LocalEditSession("project");
  session.newThread(first);
  session.draft = { prompt: "Original task", attachments: [] };
  session.newThread(second);
  session.tasks = [
    mock<AiTask>({
      id: "blocked",
      threadId: first,
      status: "stopped",
      needsReconciliation: true,
      binding: {
        projectId: "project",
        branchId: null,
        sessionId: "session",
        changeCounter: 0,
        componentUuid: "page",
        elementUuids: [],
      },
    }),
  ];
  const open = vi.fn();
  render(
    <AntdConfigProvider productUI>
      <AiRunningNotice session={session} onOpen={open} />
    </AntdConfigProvider>,
  );
  expect(
    screen.getByText("Another conversation needs saved-design verification."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View conversation" }));
  expect(session.activeThreadId).toBe(first);
  expect(session.draft.prompt).toBe("Original task");
  expect(open).toHaveBeenCalledOnce();
});
