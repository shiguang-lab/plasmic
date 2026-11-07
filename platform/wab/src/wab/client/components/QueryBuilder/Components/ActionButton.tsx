import { Icon } from "@/wab/client/components/widgets/Icon";
import PlussvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__PlusSvg";
import TrashsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__TrashSvg";
import UnorderedListsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__UnorderedListSvg";
import { Button } from "antd";
import React from "react";

export function ActionButton({ type, onClick, label, readonly }: {
  type: "addRule" | "addGroup" | "delRule" | "delGroup";
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  label: string;
  readonly?: boolean;
}) {
  const remove = type === "delRule" || type === "delGroup";
  const icon = remove ? TrashsvgIcon : type === "addGroup" ? UnorderedListsvgIcon : PlussvgIcon;
  return <Button size="small" disabled={readonly} onClick={onClick}
    aria-label={label} icon={<Icon icon={icon} />}
    className={`qb-button action action--${remove ? "DELETE" : type === "addGroup" ? "ADD-GROUP" : "ADD-RULE"}`}>
    {remove ? null : label}
  </Button>;
}
