import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { AppCtx } from "@/wab/client/app-ctx";
import { CanvasAiComposer } from "@/wab/client/components/copilot/CanvasAiComposer";
import { CopilotChatDialog } from "@/wab/client/components/copilot/CopilotChatDialog";
import { LocalEditSession } from "@/wab/client/copilot/local-edit-session";
import { toOpaque } from "@/wab/commons/types";
import { ApiProject, CopilotChatOpenOpts } from "@/wab/shared/ApiSchema";
import { LocalAiContext } from "@/wab/shared/copilot/local-edit";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { SWRConfig } from "swr";
import { mock } from "vitest-mock-extended";

let statusCache = new Map();
const config = vi.hoisted(() => ({
  enableLocalAiEditing: true,
  enableLocalAiPageGeneration: false,
}));
const state = vi.hoisted(() => ({
  session: undefined as LocalEditSession | undefined,
  configured: true,
  missingModels: false,
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({ appConfig: config }),
}));
vi.mock("@/wab/client/copilot/local-edit-session", async (original) => {
  const actual =
    await original<typeof import("@/wab/client/copilot/local-edit-session")>();
  return {
    ...actual,
    getLocalEditSession: () => state.session,
    localAiFetch: async () => ({
      configured: state.configured,
      model: "fixture-model",
      ...(state.missingModels
        ? {}
        : { models: ["fixture-model", "alternate-model"] }),
      pageGenerationEnabled: true,
    }),
  };
});
afterEach(cleanup);
beforeEach(() => {
  statusCache = new Map();
  state.session = new LocalEditSession("project");
  state.configured = true;
  state.missingModels = false;
  config.enableLocalAiEditing = true;
  config.enableLocalAiPageGeneration = false;
});
function mount(chatOpenOpts?: CopilotChatOpenOpts) {
  const onClose = vi.fn();
  const project = mock<ApiProject>({
    id: toOpaque("project"),
    name: "Project",
  });
  return {
    onClose,
    ...render(
      <SWRConfig value={{ provider: () => statusCache }}>
        <AntdConfigProvider productUI>
          <CopilotChatDialog
            project={project}
            chatOpenOpts={chatOpenOpts}
            width={303}
            hiddenByModal={false}
            onClose={onClose}
          />
        </AntdConfigProvider>
      </SWRConfig>,
    ),
  };
}
it("renders a working Web composer and submits once through the session", async () => {
  const run = vi
    .spyOn(state.session as LocalEditSession, "run")
    .mockResolvedValue();
  mount();
  const input = screen.getByRole("textbox");
  fireEvent.change(
    screen.getByLabelText("Choose requirement documents and reference images"),
    { target: { files: [new File(["A table"], "requirements.md")] } },
  );
  await screen.findByRole("button", {
    name: "Remove attachment requirements.md",
  });
  fireEvent.change(input, { target: { value: "Change the title" } });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Send AI request" }),
    ).not.toBeDisabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send AI request" }));
  expect(run).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledWith(
    "Change the title",
    undefined,
    undefined,
    [{ type: "text", name: "requirements.md", text: "A table" }],
    "fixture-model",
  );
  expect(input).toHaveValue("");
});
it("shows configuration state without enabling an unavailable model", async () => {
  state.configured = false;
  mount();
  await screen.findByText(
    "Configure the AI service on the server to start editing.",
  );
  expect(
    screen.getByRole("button", { name: "Send AI request" }),
  ).toBeDisabled();
});
it("closing the panel stops its current task", () => {
  const stop = vi.spyOn(state.session as LocalEditSession, "stop");
  const { onClose } = mount();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(stop).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});
it("keeps a rejected tool's actual error in execution progress", () => {
  if (!state.session) {
    throw new Error("Session fixture missing");
  }
  state.session.tasks = [
    {
      id: "rejected",
      prompt: "Edit form",
      attachments: [],
      status: "failed",
      phase: "Failed",
      messages: [],
      records: [],
      operations: [
        {
          id: "read-form",
          name: "read",
          status: "failed",
          error: "Component is not in the pinned scope.",
        },
      ],
    },
  ];
  mount();
  expect(screen.getByText("Execution progress")).toBeInTheDocument();
  expect(
    screen.getByText("Component is not in the pinned scope."),
  ).toBeInTheDocument();
});

it("submits natural language with automatic targeting and no mode or identity fields", async () => {
  config.enableLocalAiPageGeneration = true;
  const run = vi
    .spyOn(state.session as LocalEditSession, "run")
    .mockResolvedValue();
  mount();
  await screen.findByText("fixture-model");
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: "New page name" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Create a new records page at /records" },
  });
  fireEvent.keyDown(screen.getByRole("textbox"), {
    key: "Enter",
    shiftKey: true,
  });
  expect(run).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("textbox"), {
    key: "Enter",
    isComposing: true,
  });
  expect(run).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(run).toHaveBeenCalledWith(
    "Create a new records page at /records",
    undefined,
    "auto",
    [],
    "fixture-model",
  );
});

it("uses the chosen model and remembers it when reopening the panel", async () => {
  const run = vi
    .spyOn(state.session as LocalEditSession, "run")
    .mockResolvedValue();
  const first = mount();
  await screen.findByText("fixture-model");
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "AI model" }));
  const alternate = await screen.findByText("alternate-model");
  const holder = alternate.closest(".ant-select-dropdown-list-holder");
  expect(holder).toBeInstanceOf(HTMLElement);
  expect((holder as HTMLElement).style.maxHeight).toBe("");
  expect((holder as HTMLElement).style.overflowY).toBe("");
  expect(alternate.closest("[data-overlayscrollbars]")).toHaveStyle({
    maxHeight: "240px",
  });
  fireEvent.click(alternate);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Change title" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send AI request" }));
  expect(run).toHaveBeenCalledWith(
    "Change title",
    undefined,
    undefined,
    [],
    "alternate-model",
  );
  first.unmount();
  mount();
  await screen.findByText("alternate-model");
  expect((state.session as LocalEditSession).selectedModel).toBe(
    "alternate-model",
  );
});

it("keeps the panel mounted when the running server omits the model list", async () => {
  state.missingModels = true;
  mount();
  await screen.findByText(
    "The AI service returned an invalid status. Update the server and reload the assistant.",
  );
  expect(
    screen.getByRole("region", { name: "AI assistant" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Send AI request" }),
  ).toBeDisabled();
  expect(
    screen.queryByRole("combobox", { name: "AI model" }),
  ).not.toBeInTheDocument();
});

it("shares the canvas draft and attachments across panel close and reopen", () => {
  const session = state.session as LocalEditSession;
  session.draft = {
    prompt: "Canvas draft",
    attachments: [{ type: "text", name: "requirements.md", text: "A table" }],
  };
  const first = mount();
  expect(screen.getByRole("textbox")).toHaveValue("Canvas draft");
  expect(screen.getByText("requirements.md")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Continue in panel" },
  });
  first.unmount();
  expect(session.draft.prompt).toBe("Continue in panel");
  mount();
  expect(screen.getByRole("textbox")).toHaveValue("Continue in panel");
  expect(screen.getByText("requirements.md")).toBeTruthy();
});

it("accepts a request from the canvas, starts it once and clears the shared draft", async () => {
  const session = state.session as LocalEditSession;
  const attachments = [
    { type: "text" as const, name: "requirements.md", text: "A table" },
  ];
  session.draft = { prompt: "Canvas request", attachments };
  const run = vi.spyOn(session, "run").mockResolvedValue();
  mount({ prompt: "Canvas request", mode: undefined, attachments });
  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  expect(run).toHaveBeenCalledWith(
    "Canvas request",
    undefined,
    undefined,
    attachments,
    "fixture-model",
  );
  expect(session.draft).toEqual({ prompt: "", attachments: [] });
});

const selection: LocalAiContext = {
  scope: "StatusFilter",
  binding: {
    projectId: "project",
    branchId: null,
    sessionId: "session",
    changeCounter: 4,
    componentUuid: "page",
    frameUuid: "frame",
    elementUuids: ["node"],
  },
};
function AiModes({ context = selection }: { context?: LocalAiContext }) {
  const [panel, setPanel] = React.useState(false);
  const [opts, setOpts] = React.useState<CopilotChatOpenOpts>();
  const appCtx = mock<AppCtx>();
  Object.defineProperty(appCtx, "appConfig", { value: config });
  const project = mock<ApiProject>({
    id: toOpaque("project"),
    name: "Project",
  });
  return (
    <SWRConfig value={{ provider: () => statusCache }}>
      <AntdConfigProvider productUI>
        <button onClick={() => setPanel(true)}>Open panel</button>
        {panel ? (
          <CopilotChatDialog
            project={project}
            context={context}
            width={303}
            hiddenByModal={false}
            chatOpenOpts={opts}
            onClose={() => {
              setPanel(false);
              setOpts(undefined);
            }}
          />
        ) : (
          <CanvasAiComposer
            appCtx={appCtx}
            projectId="project"
            context={context}
            hiddenByModal={false}
            onSubmit={async (request) => {
              setOpts(request);
              setPanel(true);
            }}
          />
        )}
      </AntdConfigProvider>
    </SWRConfig>
  );
}

it("switches top-frame modes without losing attachments, scope, model or multiline drafts", async () => {
  const rendered = render(<AiModes />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Change padding\nand spacing" } });
  expect(
    screen.getByRole("group", { name: "AI canvas editing" }),
  ).toHaveAttribute("data-expanded", "true");
  fireEvent.change(
    screen.getByLabelText("Choose requirement documents and reference images"),
    { target: { files: [new File(["A table"], "requirements.md")] } },
  );
  await screen.findByRole("button", {
    name: "Remove attachment requirements.md",
  });
  await screen.findByRole("combobox", { name: "AI model" });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "AI model" }));
  fireEvent.click(await screen.findByText("alternate-model"));
  expect(state.session?.selectedModel).toBe("alternate-model");
  fireEvent.click(screen.getByRole("button", { name: "Open panel" }));
  expect(screen.queryByRole("group", { name: "AI canvas editing" })).toBeNull();
  expect(screen.getByRole("textbox")).toHaveValue(
    "Change padding\nand spacing",
  );
  expect(screen.getByText("requirements.md")).toBeTruthy();
  expect(screen.getByText("StatusFilter")).toBeTruthy();
  expect(screen.getByText("alternate-model")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Continue in panel" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("region", { name: "AI assistant" })).toBeNull();
  expect(screen.getByRole("textbox")).toHaveValue("Continue in panel");
  expect(screen.getByText("requirements.md")).toBeTruthy();
  expect(screen.getByText("alternate-model")).toBeTruthy();
  rendered.rerender(
    <AiModes context={{ ...selection, scope: "SearchButton" }} />,
  );
  expect(screen.getByText("SearchButton")).toBeTruthy();
  expect(screen.getByRole("textbox")).toHaveValue("Continue in panel");
});

it("submits from the top-frame entry into panel mode once with the selected node binding", async () => {
  const session = state.session as LocalEditSession;
  const run = vi.spyOn(session, "run").mockResolvedValue();
  render(<AiModes />);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Change padding" },
  });
  fireEvent.keyDown(screen.getByRole("textbox"), {
    key: "Enter",
    shiftKey: true,
  });
  fireEvent.keyDown(screen.getByRole("textbox"), {
    key: "Enter",
    isComposing: true,
  });
  expect(run).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  expect(run).toHaveBeenCalledWith(
    "Change padding",
    selection.binding,
    undefined,
    [],
    "fixture-model",
  );
  expect(screen.queryByRole("group", { name: "AI canvas editing" })).toBeNull();
  expect(screen.getByRole("region", { name: "AI assistant" })).toBeTruthy();
  expect(session.draft).toEqual({ prompt: "", attachments: [] });
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.getByRole("textbox")).toHaveValue("");
});
