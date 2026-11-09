import { FromStarterTemplate } from "@/wab/client/components/pages/FromStarterTemplate";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/dashboard/DashboardLayout", () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("does not create another project when only path, workspace or template version changes", async () => {
  const location = { href: "" };
  vi.stubGlobal("location", location);
  let complete: (value: { projectId: string }) => void = () => {};
  const api = { clonePublishedTemplate: vi.fn(() => new Promise((resolve) => { complete = resolve; })) };
  const appCtx = { api, selfInfo: {} } as any;
  const field = (version: string, path: string, workspaceId: string) => <FromStarterTemplate appCtx={appCtx} baseProjectId="template" version={version} workspaceId={workspaceId as any} path={path} name="Draft" />;
  const view = render(field("1", "/first", "first-workspace"));
  view.rerender(field("2", "/second", "second-workspace"));
  expect(api.clonePublishedTemplate).toHaveBeenCalledExactlyOnceWith("template", "Draft", "first-workspace", "1");
  await act(async () => complete({ projectId: "created-once" }));
  expect(location.href).toBe("/projects/created-once");
});

it("ignores an earlier clone's navigation when the original project request changes", async () => {
  const location = { href: "" };
  vi.stubGlobal("location", location);
  const completions: ((result: { projectId: string }) => void)[] = [];
  const api = { clonePublishedTemplate: vi.fn(() => new Promise((resolve) => completions.push(resolve))) };
  const appCtx = { api, selfInfo: {} } as any;
  const field = (baseProjectId: string) => <FromStarterTemplate appCtx={appCtx} baseProjectId={baseProjectId} version="1" path="/template" name="Draft" />;
  const view = render(field("old-template"));
  view.rerender(field("current-template"));
  expect(api.clonePublishedTemplate).toHaveBeenCalledTimes(2);
  await act(async () => completions[1]({ projectId: "current" }));
  expect(location.href).toBe("/projects/current");
  await act(async () => completions[0]({ projectId: "old" }));
  expect(location.href).toBe("/projects/current");
});
