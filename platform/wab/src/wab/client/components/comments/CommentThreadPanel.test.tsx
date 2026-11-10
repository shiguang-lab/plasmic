import CommentsTab from "@/wab/client/components/comments/CommentsTab";
import type { TplCommentThread } from "@/wab/client/components/comments/utils";
import { showError } from "@/wab/client/ErrorNotifications";
import { setLanguagePreference } from "@/wab/client/i18n";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { toOpaque } from "@/wab/commons/types";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import * as React from "react";
import { createStore } from "zustand/vanilla";

const fixture = vi.hoisted(() => ({
  studio: undefined as StudioCtx | undefined,
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => fixture.studio,
}));
vi.mock("@/wab/client/studio-ctx/StudioCtx", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/wab/client/studio-ctx/StudioCtx")
  >()),
  canUpdateHistory: () => true,
}));
vi.mock("@/wab/client/components/comments/CommentSubjectInputs", () => ({
  CommentSubjectName: () => "QueryBar",
  CommentSubjectType: () => "SearchForm",
}));
vi.mock("@shiguang2/components/esm/scrollbar", async () => {
  const ReactModule = await import("react");
  return {
    Scrollbar: ReactModule.forwardRef<
      HTMLDivElement,
      {
        children: React.ReactNode;
        style?: React.CSSProperties;
        events?: { scroll?: () => void };
      }
    >(({ children, style, events }, ref) => (
      <div
        ref={ref}
        style={style}
        data-testid="shared-scrollbar"
        onScroll={() => events?.scroll?.()}
      >
        {children}
      </div>
    )),
  };
});
vi.mock("@/wab/client/ErrorNotifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/ErrorNotifications")>()),
  showError: vi.fn(),
  reportError: vi.fn(),
}));

const originalScrollTo = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollTo",
);
beforeAll(() =>
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  }),
);
afterAll(() => {
  if (originalScrollTo) {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
  } else {
    delete (HTMLElement.prototype as any).scrollTo;
  }
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function setup() {
  await setLanguagePreference("en");
  const user = {
    id: toOpaque("self"),
    email: "author@example.com",
    displayName: "Author",
  };
  const date = new Date(2026, 10, 1).toISOString();
  const common = {
    createdAt: date,
    updatedAt: date,
    deletedAt: null,
    createdById: "self",
    updatedById: "self",
    deletedById: null,
  };
  const thread = (id: string, body: string) =>
    ({
      ...common,
      id: toOpaque(id),
      resolved: false,
      label: "QueryBar",
      location: { subject: { uuid: "project", iid: "subject" }, variants: [] },
      comments: [
        {
          ...common,
          id: toOpaque(`comment-${id}`),
          commentThreadId: toOpaque(id),
          body,
        },
      ],
      commentThreadHistories: [],
    }) as unknown as TplCommentThread;
  const one = thread(
    "one",
    "Query behavior\n\nA short description.\n\nDETAIL_ONLY: all six query states and validation rules.",
  );
  const two = thread(
    "two",
    "Reset behavior\n\nReset should cancel the pending query.",
  );
  const data = createStore(() => ({
    allThreads: [one, two],
    threadsById: new Map([
      [one.id, one],
      [two.id, two],
    ]),
    usersMap: new Map([[user.id, user]]),
    reactionsByCommentId: new Map(),
  }));
  const dialogs = createStore<{
    thread?: { threadId: typeof one.id };
    newThread?: undefined;
  }>(() => ({}));
  const filters = createStore(() => ({
    scope: "project" as const,
    status: "unresolved" as const,
    onlyRelated: false,
  }));
  const drafts = new Map<string, string>();
  const update = (
    id: string,
    run: (value: TplCommentThread) => TplCommentThread,
  ) =>
    data.setState((state) => {
      const allThreads = state.allThreads.map((value) =>
        value.id === id ? run(value) : value,
      );
      return {
        allThreads,
        threadsById: new Map(allThreads.map((value) => [value.id, value])),
      };
    });
  const ctx = {
    store: data,
    dialogStore: dialogs,
    filterStore: filters,
    requestStore: createStore(() => ({
      hasLoaded: true,
      isLoading: false,
      loadFailed: false,
    })),
    openCommentThreadDialog: vi.fn((id: typeof one.id) =>
      dialogs.setState({ thread: { threadId: id } }),
    ),
    closeCommentThreadDialog: vi.fn(() =>
      dialogs.setState({ thread: undefined }),
    ),
    getThreadDraft: (value: TplCommentThread) => drafts.get(value.id) ?? "",
    setThreadDraft: (value: TplCommentThread, text: string) =>
      drafts.set(value.id, text),
    clearThreadDraft: (value: TplCommentThread) => drafts.delete(value.id),
    postThreadComment: vi.fn((id: typeof one.id, value: { body: string }) =>
      update(id, (before) => ({
        ...before,
        comments: [
          ...before.comments,
          {
            ...common,
            id: toOpaque("reply"),
            commentThreadId: id,
            body: value.body,
          },
        ],
      })),
    ),
    editThread: vi.fn((id: typeof one.id, resolved: boolean) =>
      update(id, (before) => ({ ...before, resolved })),
    ),
    setCommentsFilter: vi.fn((value) => filters.setState(value)),
    fetchComments: vi.fn(),
  };
  const studio = {
    commentsCtx: ctx,
    appCtx: { selfInfo: user, api: {} },
    siteInfo: { id: "project", perms: [] },
    branchInfo: () => undefined,
    arenaState: { observedComponentsStore: createStore(() => []) },
    projectMetadataStore: createStore(() => ({ mentionUsers: [] })),
    toggleCommentsPanel: vi.fn(),
    focusCommentThread: vi.fn(),
  };
  fixture.studio = studio as unknown as StudioCtx;
  const view = render(<CommentsTab />);
  const open = (id = "one") =>
    fireEvent.click(
      view.container.querySelector<HTMLButtonElement>(
        `[data-comment-thread="${id}"]`,
      ) as HTMLButtonElement,
    );
  return { ctx, data, dialogs, filters, drafts, one, two, open, ...view };
}

it("shows summaries in the list and one full conversation in the same panel", async () => {
  const f = await setup();
  expect(screen.queryByText(/DETAIL_ONLY/)).toBeNull();
  f.open();
  const detail = screen.getByRole("region", { name: "Comment details" });
  expect(within(detail).getByText(/DETAIL_ONLY/)).toBeTruthy();
  expect(
    screen.getAllByRole("region", { name: "Comment details" }),
  ).toHaveLength(1);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(f.ctx.openCommentThreadDialog).toHaveBeenCalledWith("one");
  expect(
    within(detail)
      .getByRole("button", { name: "Locate comment target" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

it("preserves each draft, filters and list scroll position when navigating and returning", async () => {
  const f = await setup();
  const list = screen.getByTestId("shared-scrollbar");
  list.scrollTop = 140;
  fireEvent.scroll(list);
  const originalFilters = f.filters.getState();
  f.open();
  fireEvent.change(screen.getByRole("textbox", { name: "Add a comment" }), {
    target: { value: "Unsent first draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next comment" }));
  expect(
    (
      screen.getByRole("textbox", {
        name: "Add a comment",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("");
  fireEvent.change(screen.getByRole("textbox", { name: "Add a comment" }), {
    target: { value: "Second draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Previous comment" }));
  expect(
    (
      screen.getByRole("textbox", {
        name: "Add a comment",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("Unsent first draft");
  fireEvent.click(screen.getByRole("button", { name: "Back to comments" }));
  expect(f.filters.getState()).toBe(originalFilters);
  expect(list.scrollTop).toBe(140);
  expect(document.activeElement).toBe(
    f.container.querySelector('[data-comment-thread="one"]'),
  );
});

it("keeps a resolved conversation open and can undo it without losing the draft", async () => {
  const f = await setup();
  f.open();
  fireEvent.change(screen.getByRole("textbox", { name: "Add a comment" }), {
    target: { value: "Keep this draft" },
  });
  fireEvent.click(
    within(screen.getByRole("region", { name: "Comment details" })).getByRole(
      "button",
      { name: "Resolve" },
    ),
  );
  expect(f.data.getState().threadsById.get(f.one.id)?.resolved).toBe(true);
  expect(screen.getByRole("region", { name: "Comment details" })).toBeTruthy();
  expect(
    (
      screen.getByRole("textbox", {
        name: "Add a comment",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("Keep this draft");
  fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
  expect(f.data.getState().threadsById.get(f.one.id)?.resolved).toBe(false);
});

it("submits Enter once, keeps Shift+Enter and IME composition for editing, and clears the submitted draft", async () => {
  const f = await setup();
  f.open();
  const input = screen.getByRole("textbox", { name: "Add a comment" });
  fireEvent.change(input, { target: { value: "A real reply" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
  expect(f.ctx.postThreadComment).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() =>
    expect(f.ctx.postThreadComment).toHaveBeenCalledExactlyOnceWith("one", {
      body: "A real reply",
    }),
  );
  await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe(""));
  expect(f.drafts.get("one") ?? "").toBe("");
  expect(screen.getByText("A real reply")).toBeTruthy();
});

it("uses the same detail view when selection changes outside the list", async () => {
  const f = await setup();
  act(() => f.dialogs.setState({ thread: { threadId: f.two.id } }));
  expect(screen.getByRole("region", { name: "Comment details" })).toBeTruthy();
  expect(
    within(screen.getByRole("region", { name: "Comment details" })).getByText(
      "Reset behavior",
    ),
  ).toBeTruthy();
});

it("keeps a reply and its draft when submitting fails", async () => {
  const f = await setup();
  f.open();
  f.ctx.postThreadComment.mockImplementationOnce(() => {
    throw new Error("Write failed");
  });
  const input = screen.getByRole("textbox", { name: "Add a comment" });
  fireEvent.change(input, { target: { value: "Do not lose this reply" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() =>
    expect(showError).toHaveBeenCalledWith(expect.any(Error), {
      title: "Failed to send comment",
    }),
  );
  expect((input as HTMLTextAreaElement).value).toBe("Do not lose this reply");
  expect(f.drafts.get("one")).toBe("Do not lose this reply");
});
