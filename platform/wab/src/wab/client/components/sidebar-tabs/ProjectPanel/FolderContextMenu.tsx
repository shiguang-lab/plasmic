import { menuSection } from "@/wab/client/components/menu-builder";
import { UiText } from "@/wab/client/i18n/UiText";
import { Menu } from "antd";
import * as React from "react";

/**
 * Context menu shown when right-clicking a folder row.
 *
 * @param itemDisplay text to indicate the type of items in the folder
 * @param onAdd callback when add is clicked
 * @param onSelectRename callback when rename is clicked
 * @param onDelete callback when delete is clicked
 */
export function FolderContextMenu({
  itemDisplay,
  onAdd,
  onSelectRename,
  onDelete,
}: {
  itemDisplay: string;
  onAdd: () => void;
  onSelectRename: () => void;
  onDelete: () => void;
}) {
  return (
    <Menu id="proj-item-menu">
      {menuSection(
        "add",
        <Menu.Item key="add" onClick={onAdd}>
          <strong>
            <UiText message={"Add"} />
          </strong>{" "}
          {itemDisplay}
        </Menu.Item>,
      )}
      {menuSection(
        "rename",
        <Menu.Item
          key="rename"
          onClick={(e) => {
            e.domEvent.stopPropagation();
            onSelectRename();
          }}
        >
          <strong>
            <UiText message={"Rename"} />
          </strong>{" "}
          folder
        </Menu.Item>,
      )}
      {menuSection(
        "delete",
        <Menu.Item key="delete" onClick={onDelete}>
          <strong>
            <UiText message={"Delete"} />
          </strong>{" "}
          folder
        </Menu.Item>,
      )}
    </Menu>
  );
}
