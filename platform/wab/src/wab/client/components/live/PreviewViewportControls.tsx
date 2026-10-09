import styles from "@/wab/client/components/live/PreviewViewport.module.scss";
import {
  DEVICE_VIEWPORTS,
  PreviewViewport,
  PreviewViewportMode,
  isViewportDimension,
} from "@/wab/client/components/live/preview-viewport";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import React from "react";

export function PreviewViewportControls({
  value,
  scale,
  onChange,
}: {
  value: PreviewViewport;
  scale: number;
  onChange: (value: PreviewViewport) => void;
}) {
  const { t: uiT } = useI18n();
  const [width, setWidth] = React.useState(`${value.width}`);
  const [height, setHeight] = React.useState(`${value.height}`);
  React.useEffect(() => {
    setWidth(`${value.width}`);
    setHeight(`${value.height}`);
  }, [value.width, value.height]);

  const selectMode = (viewport: PreviewViewportMode) => {
    onChange({
      ...value,
      ...(viewport === "phone" || viewport === "tablet"
        ? DEVICE_VIEWPORTS[viewport]
        : {}),
      viewport,
    });
  };
  const valid =
    isViewportDimension(Number(width)) && isViewportDimension(Number(height));
  return (
    <div className={styles.controls} aria-label={uiT("Preview viewport")}>
      <div
        className={styles.modes}
        role="group"
        aria-label={uiT("Preview device")}
      >
        {(
          [
            ["desktop", "Desktop"],
            ["phone", "Phone"],
            ["tablet", "Tablet"],
            ["custom", "Custom"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={value.viewport === mode}
            onClick={() => selectMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>
      {value.viewport === "custom" ? (
        <form
          className={styles.dimensions}
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) {
              onChange({
                viewport: "custom",
                width: Number(width),
                height: Number(height),
              });
            }
          }}
        >
          <input
            aria-label={uiT("Preview width")}
            type="number"
            min={240}
            max={7680}
            step={1}
            value={width}
            onChange={(event) => setWidth(event.target.value)}
          />
          <span>×</span>
          <input
            aria-label={uiT("Preview height")}
            type="number"
            min={240}
            max={7680}
            step={1}
            value={height}
            onChange={(event) => setHeight(event.target.value)}
          />
          <button type="submit" disabled={!valid}>
            <UiText message={"Apply"} />
          </button>
        </form>
      ) : (
        <span className={styles.size} aria-live="polite">
          {value.width} × {value.height}
          {value.viewport === "desktop" && " · Fit to window"}
        </span>
      )}
      {(value.viewport === "phone" || value.viewport === "tablet") && (
        <button
          type="button"
          onClick={() =>
            onChange({ ...value, width: value.height, height: value.width })
          }
        >
          {value.width > value.height
            ? "Switch to portrait"
            : "Switch to landscape"}
        </button>
      )}
      {value.viewport !== "desktop" && (
        <span className={styles.size}>
          <UiText message={"Zoom"} /> {Math.round(scale * 100)}%
        </span>
      )}
    </div>
  );
}
