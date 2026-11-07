import { LEFT_PANE_INIT_WIDTH } from "@/wab/client/ClientConstants";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { TutorialEventsType } from "@/wab/client/tours/tutorials/tutorials-events";
import type { TutorialStateFlags } from "@/wab/client/tours/tutorials/tutorials-types";
import type { CopilotChatOpenOpts } from "@/wab/shared/ApiSchema";
import type { LeftTabKey } from "@/wab/shared/ui-config-utils";
import { isEqual } from "lodash";
import { createStore } from "zustand/vanilla";

/** Immutable scalar UI data. AI options stay an opaque command identity. */
export type LeftPanel =
  | Readonly<{ type: "tab"; tab: LeftTabKey }>
  | Readonly<{ type: "insert"; inline: boolean }>
  | Readonly<{ type: "ai"; opts?: CopilotChatOpenOpts }>;

export interface OnboardingTourState {
  readonly run: boolean;
  readonly stepIndex: number;
  // List of events that will trigger the tour to advance to the next step
  readonly triggers: readonly TutorialEventsType[];
  readonly tour: string;
  readonly flags: Readonly<Partial<TutorialStateFlags>>;
}

export interface LeftPanelSnapshot {
  readonly panel: LeftPanel | undefined;
  readonly leftTabGroup: string | undefined;
  readonly lastLeftTabKey: LeftTabKey;
  readonly onboardingTourState: OnboardingTourState;
  readonly panelsHidden: boolean;
  readonly leftPaneWidth: number;
}

const forcedInsertPanel: LeftPanel = Object.freeze({
  type: "insert",
  inline: false,
});

function freezePanel(panel: LeftPanel): LeftPanel {
  if (panel.type === "tab") {
    const next: LeftPanel = { type: "tab", tab: panel.tab };
    return Object.freeze(next);
  }
  if (panel.type === "insert") {
    const next: LeftPanel = { type: "insert", inline: panel.inline };
    return Object.freeze(next);
  }
  const next: LeftPanel = { type: "ai", opts: panel.opts };
  return Object.freeze(next);
}

function freezeOnboardingTourState(
  state: OnboardingTourState,
): OnboardingTourState {
  const next: OnboardingTourState = {
    run: state.run,
    stepIndex: state.stepIndex,
    tour: state.tour,
    flags: Object.freeze({ ...state.flags }),
    triggers: Object.freeze([...state.triggers]),
  };
  return Object.freeze(next);
}

function emptyOnboardingTourState(): OnboardingTourState {
  const state: OnboardingTourState = {
    run: false,
    stepIndex: 0,
    tour: "",
    flags: {},
    triggers: [],
  };
  return freezeOnboardingTourState(state);
}

function initialSnapshot(): LeftPanelSnapshot {
  const snapshot: LeftPanelSnapshot = {
    panel: undefined,
    leftTabGroup: undefined,
    lastLeftTabKey: "outline",
    onboardingTourState: emptyOnboardingTourState(),
    panelsHidden: false,
    leftPaneWidth: LEFT_PANE_INIT_WIDTH,
  };
  return Object.freeze(snapshot);
}

function samePanel(a: LeftPanel | undefined, b: LeftPanel | undefined) {
  return a?.type === "ai" && b?.type === "ai"
    ? a.opts === b.opts
    : isEqual(a, b);
}

function isForcedInsert(state: LeftPanelSnapshot) {
  return !!state.onboardingTourState.flags.forceAddDrawerOpen;
}

/** The effective panel is derived from the canonical base panel and tour flag. */
export function selectLeftPanel(
  state: LeftPanelSnapshot,
): LeftPanel | undefined {
  return isForcedInsert(state) ? forcedInsertPanel : state.panel;
}

export function selectLeftTabKey(
  state: LeftPanelSnapshot,
): LeftTabKey | undefined {
  const panel = selectLeftPanel(state);
  return panel?.type === "tab" ? panel.tab : undefined;
}

export function selectLeftTabGroup(
  state: LeftPanelSnapshot,
): string | undefined {
  return state.leftTabGroup;
}

export function selectPanelsHidden(state: LeftPanelSnapshot): boolean {
  return state.panelsHidden;
}

export function selectLeftPaneWidth(state: LeftPanelSnapshot): number {
  return state.leftPaneWidth;
}

export function selectShowAddDrawer(state: LeftPanelSnapshot): boolean {
  return selectLeftPanel(state)?.type === "insert";
}

export function selectShowInlineAddDrawer(state: LeftPanelSnapshot): boolean {
  const panel = selectLeftPanel(state);
  return panel?.type === "insert" ? panel.inline : false;
}

export function selectIsCopilotChatOpen(state: LeftPanelSnapshot): boolean {
  return selectLeftPanel(state)?.type === "ai";
}

export function selectCopilotChatOpenOpts(
  state: LeftPanelSnapshot,
): CopilotChatOpenOpts | undefined {
  const panel = selectLeftPanel(state);
  return panel?.type === "ai" ? panel.opts : undefined;
}

export function selectOnboardingTourState(
  state: LeftPanelSnapshot,
): OnboardingTourState {
  return state.onboardingTourState;
}

/**
 * Canonical owner for the left panel's finite UI state, including visibility
 * and width. Commands that also open a panel stay on StudioCtx; this store
 * owns the panel/tab-group/last-tab/tour/visibility/width fields that used to
 * be MobX observables there. The effective panel is never stored separately:
 * it is always derived from `panel` and the tour flag by the selectors above.
 *
 * Resize bounds stay at the drag command site (`useResizableHandle`); this
 * owner stores the accepted width exactly as the original setter did.
 *
 * Like the other native prepared sources, field writes install an immutable
 * snapshot locally and publish it to subscribers once, after the enclosing
 * command has installed every final value. This is deliberately source-scoped:
 * there is no revision, second owner, or cross-source bridge.
 */
export class StudioLeftPanelState {
  private snapshot: LeftPanelSnapshot = initialSnapshot();
  private publicationDepth = 0;
  private readonly state = createStore<LeftPanelSnapshot>(() => this.snapshot);

  readonly store: ModelFieldStore<LeftPanelSnapshot> = {
    getState: () => this.snapshot,
    getInitialState: this.state.getInitialState,
    subscribe: this.state.subscribe,
  };

  private read() {
    return this.snapshot;
  }

  private update(partial: Partial<LeftPanelSnapshot>) {
    const next: LeftPanelSnapshot = { ...this.snapshot, ...partial };
    this.snapshot = Object.freeze(next);
    if (!this.publicationDepth) {
      this.publish();
    }
  }

  private publish() {
    if (this.state.getState() !== this.snapshot) {
      this.state.setState(this.snapshot, true);
    }
  }

  /** Hold notifications until the outer command fence, then publish once. */
  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try {
      return command();
    } finally {
      this.publicationDepth--;
      if (!this.publicationDepth) {
        this.publish();
      }
    }
  }

  get leftPanel() {
    return selectLeftPanel(this.read());
  }

  get leftTabKey() {
    return selectLeftTabKey(this.read());
  }

  get leftTabGroup() {
    return this.read().leftTabGroup;
  }

  get lastLeftTabKey() {
    return this.read().lastLeftTabKey;
  }

  get onboardingTourState() {
    return this.read().onboardingTourState;
  }

  get panelsHidden() {
    return this.read().panelsHidden;
  }

  get leftPaneWidth() {
    return this.read().leftPaneWidth;
  }

  get isCopilotChatOpen() {
    return selectIsCopilotChatOpen(this.read());
  }

  get copilotChatOpenOpts() {
    return selectCopilotChatOpenOpts(this.read());
  }

  showAddDrawer() {
    return selectShowAddDrawer(this.read());
  }

  showInlineAddDrawer() {
    return selectShowInlineAddDrawer(this.read());
  }

  setPanelsHidden(hidden: boolean) {
    if (this.read().panelsHidden !== hidden) {
      this.update({ panelsHidden: hidden });
    }
  }

  togglePanels() {
    this.setPanelsHidden(!this.read().panelsHidden);
  }

  setLeftPaneWidth(width: number) {
    if (!Object.is(this.read().leftPaneWidth, width)) {
      this.update({ leftPaneWidth: width });
    }
  }

  /** Replaces the base panel and closes any toolbar group. */
  setPanel(panel: LeftPanel | undefined) {
    const current = this.read();
    if (panel) {
      const nextPanel = samePanel(current.panel, panel)
        ? current.panel
        : freezePanel(panel);
      if (
        nextPanel !== current.panel ||
        current.leftTabGroup !== undefined
      ) {
        this.update({ panel: nextPanel, leftTabGroup: undefined });
      }
    } else if (current.panel !== undefined) {
      this.update({ panel: undefined });
    }
  }

  clearLeftTabGroup() {
    if (this.read().leftTabGroup !== undefined) {
      this.update({ leftTabGroup: undefined });
    }
  }

  setLeftTabGroup(group: string | undefined) {
    if (this.read().leftTabGroup !== group) {
      this.update({ leftTabGroup: group });
    }
  }

  setLastLeftTab(tabKey: LeftTabKey) {
    if (this.read().lastLeftTabKey !== tabKey) {
      this.update({ lastLeftTabKey: tabKey });
    }
  }

  setOnboardingTourState(state: OnboardingTourState) {
    if (isEqual(this.read().onboardingTourState, state)) {
      return;
    }
    this.update({ onboardingTourState: freezeOnboardingTourState(state) });
  }
}
