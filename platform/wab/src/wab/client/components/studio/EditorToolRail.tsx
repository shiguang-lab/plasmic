import LeftTabButton from "@/wab/client/components/studio/LeftTabButton";
import { useI18n } from "@/wab/client/i18n";
import { MessageKey } from "@/wab/client/i18n/locales";
import WarningTrianglesvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__WarningTriangleSvg";
import { PlasmicLeftTabStrip } from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftTabStrip";
import * as React from "react";

const tools = {
  Select: "M5 3l14 10-7 1-3 7z",
  Pan: "M7 12V6a2 2 0 0 1 4 0v5 M11 11V4a2 2 0 0 1 4 0v7 M15 11V6a2 2 0 0 1 4 0v9c0 5-3 7-6 7-4 0-6-3-9-8a2 2 0 0 1 3-2l2 2",
  Insert: "M12 4v16 M4 12h16",
  Layers: "M2 7l10-5 10 5-10 5z M2 12l10 5 10-5 M2 17l10 5 10-5",
  Assets: "M3 3h18v18H3z M3 16l6-6 7 7 3-3 2 2 M15 7h.01",
  Libraries: "m16 6 4 14 M12 6v14 M8 8v12 M4 4v16",
  AI: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  Issues: "M12 3 2 21h20z M12 9v5 M12 17h.01",
  More: "M4 12h.01 M12 12h.01 M20 12h.01",
} satisfies Partial<Record<MessageKey, string>>;
export function EditorToolIcon({ tool }: { tool: keyof typeof tools }) {
  if (tool === "Issues") {
    return <WarningTrianglesvgIcon />;
  }
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={tools[tool]} />
    </svg>
  );
}
export function EditorToolRail(
  props: React.ComponentProps<typeof PlasmicLeftTabStrip>,
) {
  const { t } = useI18n();
  return (
    <PlasmicLeftTabStrip
      showAvatar={false}
      insert={{ render: () => null }}
      root={{ id: "left-tab-strip" }}
      buttons={
        <>
          {(Object.keys(tools) as (keyof typeof tools)[]).map((tool) => (
            <React.Fragment key={tool}>
              {(tool === "Insert" || tool === "Issues") && (
                <div className="editor-rail-divider" role="separator" />
              )}
              <LeftTabButton
                hasLabel
                label={t(tool)}
                tooltip={t(tool)}
                icon={<EditorToolIcon tool={tool} />}
                disabled
              />
            </React.Fragment>
          ))}
        </>
      }
      bottomButtons={null}
      players={{ render: () => null }}
      avatar={{ render: () => null }}
      divider={{ render: () => null }}
      figma={{ render: () => null }}
      keyboard={{ render: () => null }}
      {...props}
    />
  );
}
