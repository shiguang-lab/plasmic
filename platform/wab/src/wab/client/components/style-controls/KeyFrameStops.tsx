import { maybeShowContextMenu } from "@/wab/client/components/ContextMenu";
import { MenuBuilder } from "@/wab/client/components/menu-builder";
import sty from "@/wab/client/components/style-controls/KeyFrameStops.module.scss";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { UiText } from "@/wab/client/i18n/UiText";
import ColorStopIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__ColorStop";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type {
  ModelFieldStore,
  ModelRef,
  ModelSnapshots,
} from "@/wab/client/studio-ctx/model-snapshots";
import { XDraggable } from "@/wab/commons/components/XDraggable";
import {
  ensure,
  ensureHTMLElt,
  insert,
  maybe,
  removeAt,
  spawn,
} from "@/wab/shared/common";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { AnimationSequence, KeyFrame } from "@/wab/shared/model/classes";
import { Menu } from "antd";
import classNames from "classnames";
import $ from "jquery";
import L from "lodash";
import { ok } from "neverthrow";
import React from "react";
import { useStore } from "zustand";

interface KeyFrameStopsProps {
  sequence: AnimationSequence;
  studioCtx: StudioCtx;
  onSelectKeyframe: (keyframe: KeyFrame) => void;
  selectedKeyframe?: KeyFrame;
  onDeleteKeyframe?: (keyframe: KeyFrame) => void;
}

type RelOffset = (
  e: Pick<React.MouseEvent, "clientX" | "clientY">,
) => { top: number; left: number; leftFrac: number; leftPct: number };

type SequenceBinding = {
  models: ModelSnapshots;
  sequenceField: ModelFieldStore<readonly ModelRef<KeyFrame>[]>;
};

class KeyFrameSequenceBindings {
  private readonly owners = new WeakMap<StudioCtx, WeakMap<AnimationSequence, SequenceBinding>>();
  read(studio: StudioCtx, sequence: AnimationSequence): SequenceBinding {
    let sequences = this.owners.get(studio);
    if (!sequences) { sequences = new WeakMap(); this.owners.set(studio, sequences); }
    let binding = sequences.get(sequence);
    if (!binding) {
      const models = studio.modelSnapshots;
      binding = { models, sequenceField: models.field(sequence, "keyframes") };
      sequences.set(sequence, binding);
    }
    return binding;
  }
}

/**
 * Create a keyframe, but do not actually insert it, just return it with the
 * proposed index where it should be inserted.
 */
function createKeyFrame(sequence: AnimationSequence, pct: number) {
  const roundedPct = Math.round(pct);

  // Find where to insert this keyframe
  let index = sequence.keyframes.findIndex((kf) => roundedPct <= kf.percentage);
  if (index < 0) {
    index = sequence.keyframes.length;
  }

  // Do not insert at the exact same position as an existing KeyFrame
  if (sequence.keyframes.some((kf) => kf.percentage === roundedPct)) {
    return undefined;
  }

  const keyframe = new KeyFrame({
    percentage: roundedPct,
    rs: mkRuleSet({}),
  });

  return { index, keyframe };
}

/** Ghost input is finite committed percentages; it never reads a sequence array. */
function createGhostKeyFrame(pct: number, percentages: readonly number[]) {
  const roundedPct = Math.round(pct);
  if (percentages.some((percentage) => percentage === roundedPct)) {
    return undefined;
  }
  return new KeyFrame({
    percentage: roundedPct,
    rs: mkRuleSet({}),
  });
}

/**
 * Aggregate finite percentage subscription for a mounted ghost. This lives
 * only while the ghost is active; rows keep their own per-key subscriptions.
 */
function useKeyFramePercentageStores(
  models: ModelSnapshots,
  keyframeRefs: readonly ModelRef<KeyFrame>[],
): readonly ModelFieldStore<number>[] {
  return React.useMemo(
    () =>
      keyframeRefs.map((keyframeRef) =>
        models.field(models.resolve(keyframeRef), "percentage"),
      ),
    [models, keyframeRefs],
  );
}

function useCommittedPercentages(
  stores: readonly ModelFieldStore<number>[],
): readonly number[] {
  const cache = React.useRef<readonly number[] | undefined>(undefined);
  const subscribe = React.useCallback(
    (listener: () => void) => {
      const stops = stores.map((store) => store.subscribe(listener));
      return () => stops.forEach((stop) => stop());
    },
    [stores],
  );
  const getSnapshot = React.useCallback(() => {
    const values = stores.map((store) => store.getState());
    const previous = cache.current;
    if (
      previous &&
      previous.length === values.length &&
      previous.every((value, index) => value === values[index])
    ) {
      return previous;
    }
    const next = Object.freeze(values);
    cache.current = next;
    return next;
  }, [stores]);
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function GhostKeyFrameStop(props: {
  percentageStores: readonly ModelFieldStore<number>[];
  ghostLeftPct: number;
}) {
  const { percentageStores, ghostLeftPct } = props;
  const percentages = useCommittedPercentages(percentageStores);
  const ghost = createGhostKeyFrame(ghostLeftPct, percentages);
  if (!ghost) {
    return null;
  }
  return (
    <div
      data-keyframe-ghost
      className={sty.stopContainer}
      style={{
        left: `${ghost.percentage}%`,
      }}
    >
      <KeyFrameStopView
        percentage={ghost.percentage}
        isSelected={false}
        isGhost
        removing={false}
      />
    </div>
  );
}

function KeyFrameStopView(props: {
  percentage: number;
  isSelected: boolean;
  isGhost: boolean;
  removing: boolean;
}) {
  const { percentage, isSelected, isGhost, removing } = props;
  return (
    <div
      className={classNames(sty.stop, {
        [sty["stop--selected"]]: isSelected,
        [sty["stop--removing"]]: isSelected && removing,
        [sty["stop--ghost"]]: isGhost,
      })}
    >
      <Icon icon={ColorStopIcon} className="keyframe-stop__icon" size={24} />
      <div className="keyframe-stop__percentage-chip">{percentage}%</div>
    </div>
  );
}

function KeyFrameStop(props: {
  keyframeRef: ModelRef<KeyFrame>;
  keyframeNum: number;
  isSelected: boolean;
  sequence: AnimationSequence;
  studioCtx: StudioCtx;
  models: ModelSnapshots;
  onSelectKeyframe: (keyframe: KeyFrame) => void;
  removing: boolean;
  setRemoving: (removing: boolean) => void;
  setIsDragging: (isDragging: boolean) => void;
  handleChange: (f: () => any) => void;
  renderKeyframeMenu: (keyframe: KeyFrame) => React.ReactElement;
  relOffset: RelOffset;
}) {
  const {
    keyframeRef,
    keyframeNum,
    isSelected,
    sequence,
    studioCtx,
    models,
    onSelectKeyframe,
    removing,
    setRemoving,
    setIsDragging,
    handleChange,
    renderKeyframeMenu,
    relOffset,
  } = props;
  const keyframe = React.useMemo(
    () => models.resolve(keyframeRef),
    [models, keyframeRef],
  );
  const percentageStore = React.useMemo(
    () => models.field(keyframe, "percentage"),
    [models, keyframe],
  );
  const percentage = useStore(percentageStore);

  return (
    <div
      className={sty.stopContainer}
      data-keyframe-uid={keyframe.uid}
      style={{
        left: `${percentage}%`,
      }}
    >
      <XDraggable
        onMouseDown={() => onSelectKeyframe(keyframe)}
        onStart={() => {
          studioCtx.startUnlogged();
          setIsDragging(true);
        }}
        onDrag={(e) => {
          const { top, leftPct } = relOffset(e.mouseEvent);
          const prev = maybe(
            sequence.keyframes[keyframeNum - 1],
            (x) => x.percentage,
          );
          const next = maybe(
            sequence.keyframes[keyframeNum + 1],
            (x) => x.percentage,
          );
          const newRemoving = top > 90 || top < -30;
          if (removing !== newRemoving) {
            setRemoving(newRemoving);
          }
          const newVal = L.clamp(
            Math.round(leftPct),
            prev != null ? prev + 1 : 0,
            next != null ? next - 1 : 100,
          );
          if (keyframe.percentage !== newVal) {
            handleChange(() => {
              keyframe.percentage = newVal;
            });
          }
        }}
        onStop={(e) => {
          const { top } = relOffset(e.mouseEvent);
          setRemoving(false);
          setIsDragging(false);
          if (sequence.keyframes.length > 1 && (top > 90 || top < -30)) {
            handleChange(() => {
              removeAt(sequence.keyframes, keyframeNum);
            });
            // Select another keyframe if we deleted the selected one
            if (isSelected && sequence.keyframes.length > 0) {
              const newIndex = Math.min(
                keyframeNum,
                sequence.keyframes.length - 1,
              );
              onSelectKeyframe(sequence.keyframes[newIndex]);
            }
          }
          studioCtx.stopUnlogged();
        }}
      >
        <div
          onMouseDown={() => onSelectKeyframe(keyframe)}
          onContextMenu={(e) => {
            e.preventDefault();
            maybeShowContextMenu(
              e.nativeEvent,
              renderKeyframeMenu(keyframe),
            );
          }}
        >
          <KeyFrameStopView
            percentage={percentage}
            isSelected={isSelected}
            isGhost={false}
            removing={removing}
          />
        </div>
      </XDraggable>
    </div>
  );
}

export function KeyFrameStops(props: KeyFrameStopsProps) {
  const {
    sequence,
    studioCtx,
    onSelectKeyframe,
    selectedKeyframe,
    onDeleteKeyframe,
  } = props;
  const [removing, setRemoving] = React.useState(false);
  const [ghostLeftPct, setGhostLeftPct] = React.useState<number | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const stopsAndBarRef = React.useRef<HTMLDivElement>(null);
  const barRef = React.useRef<HTMLDivElement>(null);
  const [bindings] = React.useState(() => new KeyFrameSequenceBindings());
  const binding = bindings.read(studioCtx, sequence);
  const { models, sequenceField } = binding;
  const keyframeRefs = useStore(sequenceField);
  const percentageStores = useKeyFramePercentageStores(models, keyframeRefs);

  React.useEffect(() => {
    if (stopsAndBarRef.current) {
      const element = $(stopsAndBarRef.current);
      const clearGhost = () => setGhostLeftPct(null);
      element.on("mouseout", clearGhost);
      return () => {
        element.off("mouseout", clearGhost);
      };
    }
    return undefined;
  }, []);

  const relOffset = React.useCallback<RelOffset>(
    (e) => {
      if (barRef.current) {
        const containerOffset = ensure(
          $(barRef.current).offset(),
          "Element must have offset",
        );
        const barWidth = ensureHTMLElt(barRef.current).offsetWidth;
        const top = e.clientY - containerOffset.top;
        const left = e.clientX - containerOffset.left;
        const leftFrac = left / barWidth;
        const leftPct = Math.max(0, Math.min(100, 100 * leftFrac));
        return { top, left, leftFrac, leftPct };
      }
      return { top: 0, left: 0, leftFrac: 0, leftPct: 0 };
    },
    [barRef],
  );

  const handleChange = (f: () => any) => {
    spawn(
      studioCtx.change(() => {
        f();
        // Sort keyframes by percentage after any change
        sequence.keyframes.sort((a, b) => a.percentage - b.percentage);
        return ok();
      }),
    );
  };

  // Render context menu for keyframe
  const renderKeyframeMenu = (keyframe: KeyFrame) => {
    const builder = new MenuBuilder();
    builder.genSection(undefined, (push) => {
      if (onDeleteKeyframe && sequence.keyframes.length > 1) {
        push(
          <Menu.Item key="delete" onClick={() => onDeleteKeyframe(keyframe)}>
            <UiText message={"Delete keyframe"} />
          </Menu.Item>,
        );
      }
    });
    return builder.build({
      onMenuClick: (e) => e.domEvent.stopPropagation(),
      menuName: "keyframe-menu",
    });
  };

  const selectedUid = selectedKeyframe?.uid;

  return (
    <div className={sty.keyframeStops}>
      <div ref={stopsAndBarRef} className={sty.stopsAndBar}>
        <div
          className={sty.barContainer}
          onMouseMove={(e) => {
            if (!isDragging) {
              const { leftPct } = relOffset(e);
              return setGhostLeftPct(leftPct);
            }
          }}
          onClick={(e) => {
            const { leftPct } = relOffset(e);
            const res = createKeyFrame(sequence, leftPct);
            if (res != null) {
              const { index, keyframe } = res;
              handleChange(() => {
                insert(sequence.keyframes, index, keyframe);
              });
              onSelectKeyframe(keyframe);
            }
          }}
        >
          {/* Percentage marks */}
          <div className={sty.marks}>
            {[0, 25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                className={sty.mark}
                style={{
                  left: `${pct}%`,
                }}
              >
                {pct}%
              </div>
            ))}
          </div>
          <div ref={barRef} className={sty.bar} />
        </div>
        <div className={sty.stops}>
          {keyframeRefs.map((keyframeRef, keyframeNum) => (
            <KeyFrameStop
              key={keyframeRef.uid}
              keyframeRef={keyframeRef}
              keyframeNum={keyframeNum}
              isSelected={keyframeRef.uid === selectedUid}
              sequence={sequence}
              studioCtx={studioCtx}
              models={models}
              onSelectKeyframe={onSelectKeyframe}
              removing={removing}
              setRemoving={setRemoving}
              setIsDragging={setIsDragging}
              handleChange={handleChange}
              renderKeyframeMenu={renderKeyframeMenu}
              relOffset={relOffset}
            />
          ))}
          {ghostLeftPct != null && (
            <GhostKeyFrameStop
              percentageStores={percentageStores}
              ghostLeftPct={ghostLeftPct}
            />
          )}
        </div>
      </div>
    </div>
  );
}
