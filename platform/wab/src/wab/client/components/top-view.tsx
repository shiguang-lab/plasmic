import {
  withProvider,
} from "@/wab/commons/components/ContextUtil";
import { ScreenDimmer } from "@/wab/commons/components/ScreenDimmer";
import { ensure } from "@/wab/shared/common";
import { Spin } from "antd";
import cx from "classnames";
import * as React from "react";
import { ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconContext } from "react-icons";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export class App {
  readonly store = createStore(() => ({ isDragging: false, showSpinner: false }));

  setIsDragging(isDragging: boolean) {
    if (isDragging !== this.isDragging()) {
      this.store.setState({ isDragging });
    }
  }
  isDragging() {
    return this.store.getState().isDragging;
  }
  async withSpinner<T>(task: Promise<T>): Promise<T> {
    const wasShowingSpinner = this.store.getState().showSpinner;
    this.store.setState({ showSpinner: true });
    try {
      return await task;
    } finally {
      this.store.setState({ showSpinner: wasShowingSpinner });
    }
  }
}

type AppViewProps = {
  contents: (app: App) => ReactNode;
};

export function AppView({ contents }: AppViewProps) {
  const [app] = React.useState(() => new App());
  const { isDragging, showSpinner } = useStore(app.store);
  return (
    <IconContext.Provider value={{ style: { transform: "translateY(16%)" } }}>
      {providesAppContext(app)(
        <div className={cx({ app: true, "app--dragging": isDragging })}>
          {contents(app)}
          {showSpinner && createPortal(
            <ScreenDimmer><Spin size="large" /></ScreenDimmer>,
            document.body,
          )}
        </div>,
      )}
    </IconContext.Provider>
  );
}

export const AppContext = React.createContext<App | undefined>(undefined);
export const providesAppContext = withProvider(AppContext.Provider);
export const useApp = () =>
  ensure(React.useContext(AppContext), "AppContext must exist");
