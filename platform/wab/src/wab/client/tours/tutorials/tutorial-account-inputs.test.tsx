import { fakeAppCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { useTutorialAccountInputs } from "@/wab/client/tours/tutorials/tutorial-account-inputs";
import type { AppCtx } from "@/wab/client/app-ctx";
import { mock } from "vitest-mock-extended";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

afterEach(cleanup);
it("updates account copy and tour configuration only after native publication and releases its listener", () => {
  const {appCtx: app} = fakeAppCtx();
  app.appConfig = {...app.appConfig, templateTours: {template: "onboarding"}};
  let renders = 0;
  const subscribe = app.subscribeUiEnvironmentInputs.bind(app), released = vi.fn();
  vi.spyOn(app, "subscribeUiEnvironmentInputs").mockImplementation((listener) => {
    const stop = subscribe(listener); return () => {released(); stop();};
  });
  function Account() {
    const value = useTutorialAccountInputs(app); renders++;
    return <output>{value.displayName}:{value.templateTours?.template}</output>;
  }
  const mounted = render(<Account />);
  const before = renders;
  act(() => {app.publishUiEnvironmentInputs();});
  expect(renders).toBe(before);
  act(() => {
    app.selfInfo = mock<NonNullable<AppCtx["selfInfo"]>>({displayName: "Updated name"});
    app.appConfig = {...app.appConfig, templateTours: {template: "updated-tour"}};
    app.publishUiEnvironmentInputs();
  });
  expect(screen.getByRole("status").textContent).toBe("Updated name:updated-tour");
  mounted.unmount();
  expect(released).toHaveBeenCalledOnce();
});
