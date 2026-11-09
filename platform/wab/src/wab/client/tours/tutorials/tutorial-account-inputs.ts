import type { AppCtx } from "@/wab/client/app-ctx";
import * as React from "react";
import { shallow } from "zustand/shallow";

/** Account and tour configuration are published by AppCtx, not document fields. */
export function useTutorialAccountInputs(app: AppCtx) {
  const source = React.useMemo(() => createTutorialAccountInputsSource(app), [app]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}

function createTutorialAccountInputsSource(app: Parameters<typeof useTutorialAccountInputs>[0]) {
    const capture = () => Object.freeze({
      displayName: app.selfInfo?.displayName ?? "",
      templateTours: app.appConfig.templateTours ? Object.freeze({...app.appConfig.templateTours}) : undefined,
    });
    let current = capture();
    const getSnapshot = () => {
      const next = capture();
      const templateTours = shallow(next.templateTours, current.templateTours) ? current.templateTours : next.templateTours;
      if (next.displayName !== current.displayName || templateTours !== current.templateTours) { current = Object.freeze({...next, templateTours}); }
      return current;
    };
    return {getSnapshot, subscribe: (changed: () => void) => app.subscribeUiEnvironmentInputs(changed)};
  }
