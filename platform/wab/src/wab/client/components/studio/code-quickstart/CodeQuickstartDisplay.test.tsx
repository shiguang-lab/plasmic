import CodeQuickstartDisplay from "@/wab/client/components/studio/code-quickstart/CodeQuickstartDisplay";
import { ApiProject } from "@/wab/shared/ApiSchema";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({ hidden: [] as string[], copy: vi.fn() }));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    appConfig: {
      hiddenQuickstartPlatforms: mocks.hidden,
      appContentBaseUrl: "https://docs.example.com/app-content",
    },
  }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("copy-to-clipboard", () => ({ default: mocks.copy }));
const project = {
  id: "project1",
  name: "Project",
  projectApiToken: "public-token",
} as ApiProject;
afterEach(() => {
  cleanup();
  mocks.hidden = [];
  vi.resetAllMocks();
});

it("copies actual CLI commands for the current Studio and keeps the project-specific guide", () => {
  mocks.copy.mockReturnValue(true);
  const { container } = render(
    <CodeQuickstartDisplay
      project={project}
      noComponents={false}
      subjectComponentInfo={{
        pathOrComponent: "/groups",
        componentName: "Groups",
      }}
    />,
  );
  expect(container.querySelector("iframe")).toBeNull();
  expect(screen.getByLabelText("Project token").getAttribute("type")).toBe(
    "password",
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy command" }));
  expect(mocks.copy).toHaveBeenCalledWith(
    `npx @plasmicapp/cli auth --host '${window.location.origin}'\nnpx @plasmicapp/cli init --host '${window.location.origin}' --platform nextjs\nnpx @plasmicapp/cli sync --projects 'project1'`,
  );
  expect(screen.getByRole("status").textContent).toBe("Command copied");
  const guide = new URL(
    screen
      .getByRole("link", { name: "Open integration guide" })
      .getAttribute("href") ?? "",
  );
  expect(guide.pathname).toBe("/app-content/nextjs");
  const params = new URLSearchParams(guide.hash.slice(1));
  expect(params.get("projectId")).toBe("project1");
  expect(params.get("apiToken")).toBe("public-token");
  expect(params.get("componentName")).toBe("Groups");
});

it("respects hidden frameworks and switches to API integration without React source commands", async () => {
  mocks.hidden = ["nextjs"];
  render(
    <CodeQuickstartDisplay
      project={project}
      noComponents={false}
      subjectComponentInfo={undefined}
    />,
  );
  expect(
    screen
      .getByRole("link", { name: "Open integration guide" })
      .getAttribute("href"),
  ).toContain("/react#");
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Framework" }));
  fireEvent.click(await screen.findByText("REST API"));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Copy command" })).toBeNull(),
  );
  expect(
    screen
      .getByRole("link", { name: "Open integration guide" })
      .getAttribute("href"),
  ).toContain("/rest#");
  expect(
    screen
      .getByRole("link", { name: "Open API explorer" })
      .getAttribute("href"),
  ).toBe("/projects/project1/docs/loader");
});

it("reports copy failure and disables source sync for an empty project", () => {
  mocks.copy.mockReturnValue(false);
  const { rerender } = render(
    <CodeQuickstartDisplay
      project={project}
      noComponents={false}
      subjectComponentInfo={undefined}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy command" }));
  expect(screen.getByRole("status").textContent).toBe("Failed to copy command");
  rerender(
    <CodeQuickstartDisplay
      project={project}
      noComponents
      subjectComponentInfo={undefined}
    />,
  );
  expect(
    screen
      .getByRole("button", { name: "Copy command" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen.getByText("Create a page or component before exporting code"),
  ).toBeTruthy();
});
