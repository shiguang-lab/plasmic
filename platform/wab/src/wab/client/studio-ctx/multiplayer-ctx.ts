import { PLAYER_COLORS } from "@/wab/client/components/studio/GlobalCssVariables";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  ApiUser,
  PlayerViewInfo,
  ServerPlayerInfo,
  UserId,
} from "@/wab/shared/ApiSchema";
import { asyncOneAtATime, simpleHash } from "@/wab/shared/common";
import { isEqual } from "lodash";
import { subscribeWithSelector } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import { createStore } from "zustand/vanilla";

interface PlayerDataBase {
  readonly color: (typeof PLAYER_COLORS)[number];
  readonly viewInfo?: Readonly<PlayerViewInfo>;
}
interface NormalPlayerData extends PlayerDataBase {
  readonly type: "NormalUser";
  readonly user: Readonly<ApiUser>;
}
interface AnonPlayerData extends PlayerDataBase {
  readonly type: "AnonUser";
  readonly user?: undefined;
}
export type PlayerData = NormalPlayerData | AnonPlayerData;
export interface CollaboratorAvatar {
  // Absent during the grace period, when there is no live player to follow.
  readonly playerId?: number;
  readonly user?: Readonly<ApiUser>;
  readonly color: PlayerData["color"];
  readonly focused: boolean;
}

interface MultiplayerState {
  readonly selfId: number;
  readonly playerIds: readonly number[];
  readonly players: ReadonlyMap<number, PlayerData>;
  readonly avatars: ReadonlyMap<string, CollaboratorAvatar>;
}

const AVATAR_GRACE_MS = 5_000;

function avatarKey(playerId: number, userId?: UserId) {
  return userId === undefined ? `anonymous:${playerId}` : `user:${userId}`;
}

function mergeViewInfo(
  previous: Readonly<PlayerViewInfo> | undefined,
  value: PlayerViewInfo | undefined,
) {
  if (!value) {
    return undefined;
  }
  const next: PlayerViewInfo = {
    branchId: value.branchId,
    arenaInfo: isEqual(previous?.arenaInfo, value.arenaInfo)
      ? previous?.arenaInfo
      : value.arenaInfo && { ...value.arenaInfo },
    cursorInfo: isEqual(previous?.cursorInfo, value.cursorInfo)
      ? previous?.cursorInfo
      : value.cursorInfo && { ...value.cursorInfo },
    selectionInfo: isEqual(previous?.selectionInfo, value.selectionInfo)
      ? previous?.selectionInfo
      : value.selectionInfo && { ...value.selectionInfo },
    positionInfo: isEqual(previous?.positionInfo, value.positionInfo)
      ? previous?.positionInfo
      : value.positionInfo && { ...value.positionInfo },
  };
  return previous && shallow(previous, next) ? previous : next;
}

/** One project connection. Rows subscribe by player ID and the fields they use. */
export class MultiplayerCtx {
  // Follow selection changes at user cadence, independently of incoming packets.
  private readonly followedPlayer = createStore<number | null>(() => null);
  readonly followStore: Pick<
    typeof this.followedPlayer,
    "getState" | "getInitialState" | "subscribe"
  > = this.followedPlayer;

  setFollowedPlayer(id: number | null) {
    this.followedPlayer.setState(id, true);
  }

  private readonly state = createStore(
    subscribeWithSelector<MultiplayerState>(() => ({
      selfId: -1,
      playerIds: [],
      players: new Map(),
      avatars: new Map(),
    })),
  );
  readonly store: Pick<
    typeof this.state,
    "getState" | "getInitialState" | "subscribe"
  > = this.state;
  private sessions: readonly ServerPlayerInfo[] = [];
  private readonly users = new Map<UserId, ApiUser>();
  private readonly avatarTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private sessionGeneration = 0;

  constructor(private studioCtx: StudioCtx) {}

  updateSelfId(id: number) {
    this.state.setState((previous) => {
      if (id === previous.selfId && !previous.players.has(id)) {
        return previous;
      }
      const self = previous.players.get(id);
      if (!self) {
        return { ...previous, selfId: id };
      }
      const players = new Map(previous.players);
      players.delete(id);
      return {
        ...previous,
        selfId: id,
        players,
        playerIds: previous.playerIds.filter((playerId) => playerId !== id),
        avatars: this.updateAvatars(
          previous.avatars,
          players,
          avatarKey(id, self.user?.id),
        ),
      };
    }, true);
  }

  getPlayerDataById(id: number) {
    return this.store.getState().players.get(id);
  }

  subscribePlayerPosition(id: number, listener: () => void) {
    return this.state.subscribe(
      (state) => {
        const player = state.players.get(id);
        return [
          !!player,
          player?.viewInfo?.branchId,
          player?.viewInfo?.arenaInfo,
          player?.viewInfo?.positionInfo,
        ] as const;
      },
      listener,
      { equalityFn: shallow, fireImmediately: true },
    );
  }

  async updateSessions(sessions: ServerPlayerInfo[]) {
    this.sessions = sessions;
    this.publishSessions();
    if (sessions.some((player) => this.needsUser(player))) {
      await this.loadUsers();
    }
  }

  clearSessions() {
    this.sessionGeneration++;
    this.sessions = [];
    this.users.clear();
    this.avatarTimers.forEach((timer) => clearTimeout(timer));
    this.avatarTimers.clear();
    this.state.setState(
      (previous) =>
        previous.players.size || previous.avatars.size
          ? {
              ...previous,
              playerIds: [],
              players: new Map(),
              avatars: new Map(),
            }
          : previous,
      true,
    );
  }

  private needsUser(player: ServerPlayerInfo) {
    return (
      player.type === "NormalUser" &&
      player.playerId !== this.store.getState().selfId &&
      !this.users.has(player.userId)
    );
  }

  private readonly loadUsers = asyncOneAtATime(async () => {
    const generation = this.sessionGeneration;
    const missing = [
      ...new Set(
        this.sessions.flatMap((player) =>
          player.type === "NormalUser" && this.needsUser(player)
            ? [player.userId]
            : [],
        ),
      ),
    ];
    if (!missing.length) {
      return;
    }
    const response = await this.studioCtx.appCtx.api.getUsersById(missing);
    if (generation === this.sessionGeneration) {
      response.users.forEach((user) => this.users.set(user.id, user));
      this.publishSessions();
    }
  }, undefined);

  private publishSessions() {
    const sessions = this.sessions;
    this.state.setState((previous) => {
      let changed: Map<number, PlayerData> | undefined;
      let avatarsChanged = false;
      const activeIds = new Set(sessions.map((player) => player.playerId));
      const remove = (id: number) => {
        changed ??= new Map(previous.players);
        changed.delete(id);
        avatarsChanged = true;
      };
      const put = (id: number, player: PlayerData) => {
        changed ??= new Map(previous.players);
        changed.set(id, player);
      };
      for (const id of previous.playerIds) {
        if (id === previous.selfId || !activeIds.has(id)) {
          remove(id);
        }
      }
      for (const player of sessions) {
        if (player.playerId === previous.selfId) {
          continue;
        }
        const existing = (changed ?? previous.players).get(player.playerId);
        const sameUser =
          existing?.type === player.type &&
          existing?.user?.id === player.userId;
        if (!sameUser || !existing) {
          const user =
            player.type === "NormalUser"
              ? this.users.get(player.userId)
              : undefined;
          if (player.type === "NormalUser" && !user) {
            // Profile lookup must not delay removal of disconnected cursors.
            if (existing) {
              remove(player.playerId);
            }
            continue;
          }
          const avatar = previous.avatars.get(
            avatarKey(player.playerId, user?.id),
          );
          const colorIndex = user
            ? Math.abs(simpleHash(user.id)) % PLAYER_COLORS.length
            : Math.floor(Math.random() * PLAYER_COLORS.length);
          const common = {
            color: avatar?.color ?? PLAYER_COLORS[colorIndex],
            viewInfo: mergeViewInfo(undefined, player.viewInfo),
          };
          put(
            player.playerId,
            user
              ? { type: "NormalUser", user, ...common }
              : { type: "AnonUser", ...common },
          );
          avatarsChanged = true;
        } else {
          const viewInfo = mergeViewInfo(existing.viewInfo, player.viewInfo);
          if (viewInfo !== existing.viewInfo) {
            put(player.playerId, { ...existing, viewInfo });
            avatarsChanged ||=
              !!existing.viewInfo !== !!viewInfo ||
              existing.viewInfo?.arenaInfo?.focused !==
                viewInfo?.arenaInfo?.focused;
          }
        }
      }
      if (!changed) {
        return previous;
      }
      const playerIds = [...changed.keys()];
      return {
        ...previous,
        players: changed,
        avatars: avatarsChanged
          ? this.updateAvatars(previous.avatars, changed)
          : previous.avatars,
        playerIds: shallow(previous.playerIds, playerIds)
          ? previous.playerIds
          : playerIds,
      };
    }, true);
  }

  private updateAvatars(
    previous: MultiplayerState["avatars"],
    players: MultiplayerState["players"],
    excludedKey?: string,
  ): MultiplayerState["avatars"] {
    // Updating an existing account keeps its position in the toolbar.
    let changed: Map<string, CollaboratorAvatar> | undefined;
    const edit = () => (changed ??= new Map(previous));
    const active = new Set<string>();
    for (const [playerId, player] of players) {
      const key = avatarKey(playerId, player.user?.id);
      if (active.has(key)) {
        continue;
      }
      active.add(key);
      const avatar = previous.get(key);
      const focused = player.viewInfo
        ? !!player.viewInfo.arenaInfo?.focused
        : (avatar?.focused ?? false);
      if (avatar?.playerId !== playerId || avatar.focused !== focused) {
        edit().set(key, {
          playerId,
          user: player.user,
          color: player.color,
          focused,
        });
        clearTimeout(this.avatarTimers.get(key));
        this.avatarTimers.delete(key);
      }
    }
    for (const [key, avatar] of previous) {
      if (active.has(key)) {
        continue;
      }
      if (key === excludedKey) {
        edit().delete(key);
      } else if (avatar.playerId !== undefined) {
        edit().set(key, { ...avatar, playerId: undefined });
        this.avatarTimers.set(
          key,
          setTimeout(() => {
            this.avatarTimers.delete(key);
            this.state.setState((state) => {
              const avatars = new Map(state.avatars);
              avatars.delete(key);
              return { ...state, avatars };
            }, true);
          }, AVATAR_GRACE_MS),
        );
      }
    }
    return changed ?? previous;
  }
}
