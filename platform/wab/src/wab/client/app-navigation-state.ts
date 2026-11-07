import type { AppCtx } from "@/wab/client/app-ctx";
import type { TeamId, WorkspaceId } from "@/wab/shared/ApiSchema";
import { arrayEq } from "@/wab/shared/common";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface NavigationTeam {
  readonly id: TeamId;
  readonly name: string;
}

export interface NavigationWorkspace {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly teamId: TeamId;
}

export interface AppNavigationSnapshot {
  readonly teams: readonly NavigationTeam[];
  readonly workspaces: readonly NavigationWorkspace[];
}

/** Pure account navigation projection. The AppCtx creates it only on first use
 * and synchronizes it after completed reload commands install their data. */
export class AppNavigationState {
  private readonly state: StoreApi<AppNavigationSnapshot>;
  readonly store: Pick<StoreApi<AppNavigationSnapshot>, "getState" | "getInitialState" | "subscribe">;

  constructor(private readonly appCtx: AppCtx) {
    this.state = createStore(() => this.capture());
    this.store = { getState: this.state.getState, getInitialState: this.state.getInitialState, subscribe: this.state.subscribe };
  }

  private capture(previous?: AppNavigationSnapshot): AppNavigationSnapshot {
    const oldTeams = new Map(previous?.teams.map((team) => [team.id, team]));
    const oldWorkspaces = new Map(previous?.workspaces.map((space) => [space.id, space]));
    const teams = this.appCtx.getAllTeams().map((team) => {
      const before = oldTeams.get(team.id);
      return before?.name === team.name ? before : Object.freeze({ id: team.id, name: team.name });
    });
    const workspaces = this.appCtx.workspaces.map((space) => {
      const before = oldWorkspaces.get(space.id);
      return before?.name === space.name && before.teamId === space.team.id
        ? before : Object.freeze({ id: space.id, name: space.name, teamId: space.team.id });
    });
    const sharedTeams = previous && arrayEq(previous.teams, teams) ? previous.teams : Object.freeze(teams);
    const sharedWorkspaces = previous && arrayEq(previous.workspaces, workspaces) ? previous.workspaces : Object.freeze(workspaces);
    return previous && sharedTeams === previous.teams && sharedWorkspaces === previous.workspaces
      ? previous : Object.freeze({ teams: sharedTeams, workspaces: sharedWorkspaces });
  }

  sync() {
    this.state.setState((previous) => this.capture(previous), true);
  }
}
