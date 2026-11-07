import { PLAYER_COLORS } from "@/wab/client/components/studio/GlobalCssVariables";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  ApiUser,
  PlayerViewInfo,
  ServerPlayerInfo,
} from "@/wab/shared/ApiSchema";
import { asyncOneAtATime, ensure } from "@/wab/shared/common";
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
interface MultiplayerState {
  readonly selfId: number;
  readonly playerIds: readonly number[];
  readonly players: ReadonlyMap<number, PlayerData>;
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
    })),
  );
  readonly store: Pick<
    typeof this.state,
    "getState" | "getInitialState" | "subscribe"
  > = this.state;
  constructor(private studioCtx: StudioCtx) {}

  updateSelfId(id: number) {
    this.state.setState((previous) => {
      if (id === previous.selfId && !previous.players.has(id)) {
        return previous;
      }
      if (!previous.players.has(id)) {
        return { ...previous, selfId: id };
      }
      const players = new Map(previous.players);
      players.delete(id);
      return {
        selfId: id,
        players,
        playerIds: previous.playerIds.filter((playerId) => playerId !== id),
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

  updateSessions = asyncOneAtATime(async (sessions: ServerPlayerInfo[]) => {
    const initial = this.store.getState();
    const users = new Map(
      [...initial.players.values()].flatMap((player) =>
        player.type === "NormalUser"
          ? [[player.user.id, player.user] as const]
          : [],
      ),
    );
    const missing = [
      ...new Set(
        sessions.flatMap((player) =>
          player.playerId !== initial.selfId &&
          player.type === "NormalUser" &&
          !users.has(player.userId)
            ? [player.userId]
            : [],
        ),
      ),
    ];
    if (missing.length) {
      const response = await this.studioCtx.appCtx.api.getUsersById(missing);
      response.users.forEach((user) => users.set(user.id, user));
    }
    this.state.setState((previous) => {
      let changed: Map<number, PlayerData> | undefined;
      const ids = new Set(sessions.map((player) => player.playerId));
      const remove = (id: number) => {
        changed ??= new Map(previous.players);
        changed.delete(id);
      };
      const put = (id: number, player: PlayerData) => {
        changed ??= new Map(previous.players);
        changed.set(id, player);
      };
      for (const id of previous.playerIds) {
        if (id === previous.selfId || !ids.has(id)) {
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
          const common = {
            color:
              PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
            viewInfo: mergeViewInfo(undefined, player.viewInfo),
          };
          put(
            player.playerId,
            player.type === "AnonUser"
              ? { type: "AnonUser", ...common }
              : {
                  type: "NormalUser",
                  user: ensure(
                    users.get(player.userId),
                    "Should have fetched all missing data",
                  ),
                  ...common,
                },
          );
        } else {
          const viewInfo = mergeViewInfo(existing.viewInfo, player.viewInfo);
          if (viewInfo !== existing.viewInfo) {
            put(player.playerId, { ...existing, viewInfo });
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
        playerIds: shallow(previous.playerIds, playerIds)
          ? previous.playerIds
          : playerIds,
      };
    }, true);
  }, undefined);
}
