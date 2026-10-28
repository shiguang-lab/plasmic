import { comboToKeyLabels } from "@/wab/client/components/studio/Shortcuts";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { UiText } from "@/wab/client/i18n/UiText";
import { analytics } from "@/wab/client/observability";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { MaybeWrap, joinReactNodes } from "@/wab/commons/components/ReactUtil";
import { ensure, filterFalsy } from "@/wab/shared/common";
import type { MenuProps } from "antd";
import { Menu, Tooltip } from "antd";
import { createStyles } from "antd-style";
import L from "lodash";
import React from "react";

type onMenuClick = MenuProps["onClick"];

interface MenuBuilderFrame {
  type: "root" | "group" | "sub";
  name?: React.ReactNode;
  items: React.ReactNode[];
}

export class MenuBuilder {
  private stack: MenuBuilderFrame[] = [{ type: "root", items: [] }];
  private keyCounter: number = 0;

  private curFrame() {
    return ensure(L.last(this.stack), `Must be at least one frame`);
  }

  private pushItem = (...item: React.ReactNode[]) =>
    this.curFrame().items.push(...filterFalsy(item));

  private newStack(type: "group" | "sub", name?: React.ReactNode) {
    this.stack.push({ type, name, items: [] });
  }

  private makeKey() {
    return `key-${this.keyCounter++}`;
  }

  private popStack() {
    if (this.stack.length === 1) {
      return;
    }

    const frame = ensure(this.stack.pop(), `Must be at least one frame`);
    if (frame.items.length === 0) {
      return;
    }

    if (frame.type === "group") {
      const lastItem = L.last(this.curFrame().items);
      if (
        lastItem &&
        React.isValidElement(lastItem) &&
        lastItem.type !== Menu.Divider
      ) {
        this.pushItem(<Menu.Divider key={`${this.makeKey()}`} />);
      }
      if (frame.name) {
        this.pushItem(
          <Menu.ItemGroup title={frame.name as string} key={this.makeKey()}>
            {frame.items}
          </Menu.ItemGroup>,
        );
      } else {
        this.pushItem(...frame.items);
      }
    } else if (frame.type === "sub") {
      this.pushItem(
        <Menu.SubMenu
          title={<span className="mr-sm">{frame.name}</span>}
          key={this.makeKey()}
        >
          {frame.items}
        </Menu.SubMenu>,
      );
    }
  }

  genSection(
    name: React.ReactNode | undefined,
    func: (push: (...item: React.ReactNode[]) => void) => void,
  ): this {
    this.newStack("group", name);
    func(this.pushItem);
    this.popStack();
    return this;
  }

  genSub(
    name: React.ReactNode,
    func: (push: (...item: React.ReactNode[]) => void) => void,
  ) {
    this.newStack("sub", name);
    func(this.pushItem);
    this.popStack();
  }

  isEmpty(): boolean {
    return this.stack.length === 1 && this.curFrame().items.length === 0;
  }

  build(
    opts: {
      onMenuClick?: onMenuClick;
      subMenuCloseDelay?: number;
      menuName?: string;
    } = {},
  ) {
    while (this.stack.length > 1) {
      this.popStack();
    }
    return (
      <Menu
        onClick={(event) => {
          const target = event.domEvent.target;
          if (target) {
            analytics().track("menu", {
              item: event.key,
              menuName: opts.menuName,
            });
          }
          opts.onMenuClick?.(event);
        }}
        subMenuCloseDelay={opts.subMenuCloseDelay}
      >
        {this.curFrame().items}
      </Menu>
    );
  }
}

export function MenuItemContent(props: {
  children: React.ReactNode;
  shortcut?: string;
}) {
  return <TextAndShortcut {...props} />;
}

/** Content for a "Create new <entity>" menu item. */
export function CreateNewMenuItemContent(props: {
  entity: "data token" | "prop";
}) {
  return (
    <div className="flex flex-vcenter">
      <Icon icon={PlusIcon} className="mr-sm" />{" "}
      {props.entity === "data token" ? (
        <UiText message="Create new data token" />
      ) : (
        <UiText message="Create new prop" />
      )}
    </div>
  );
}

const useKeyboardShortcutStyles = createStyles(({ token }) => ({
  root: {
    "&.shortcut-combo": {
      background: token.colorBgContainer,
      color: token.colorText,
      border: `1px solid ${token.colorBorderSecondary}`,
      boxShadow: "none",
      padding: "2px 5px",
      minWidth: 18,
      textAlign: "center",
    },
  },
  tooltip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    whiteSpace: "nowrap",
  },
  tooltipKeys: {
    color: "inherit",
    opacity: 0.55,
    fontSize: "inherit",
    lineHeight: "inherit",
  },
}));

export function KeyboardShortcut(props: {
  children?: string;
  tooltip?: React.ReactNode;
  variant?: "tooltip";
}) {
  const { styles } = useKeyboardShortcutStyles();
  return props.children ? (
    <MaybeWrap
      cond={!!props.tooltip}
      wrapper={(x) => (
        <Tooltip title={props.tooltip}>
          <TriggerTarget>{x}</TriggerTarget>
        </Tooltip>
      )}
    >
      <div
        className={
          props.variant === "tooltip"
            ? styles.tooltipKeys
            : `shortcut-combo inline-block ${styles.root}`
        }
      >
        {normalizeCombo(props.children, props.variant)}
      </div>
    </MaybeWrap>
  ) : null;
}

export function TextAndShortcut(props: {
  children: React.ReactNode;
  shortcut?: string;
  variant?: "tooltip";
}) {
  const { children, shortcut, variant } = props;
  const { styles } = useKeyboardShortcutStyles();
  return (
    <div className={variant === "tooltip" ? styles.tooltip : "flex"}>
      <div className={variant === "tooltip" ? undefined : "flex-fill mr-sm"}>
        {children}
      </div>
      <KeyboardShortcut variant={variant}>{shortcut}</KeyboardShortcut>
    </div>
  );
}

function normalizeCombo(combo: string, variant?: "tooltip") {
  const keyLabels = comboToKeyLabels(combo);
  const mac = keyLabels.some(
    ({ key }) => key === "command" || key === "option",
  );
  const tooltipLabels: Record<string, string> = {
    enter: "Enter",
    esc: "Esc",
    ctrl: "Ctrl",
    shift: mac ? "⇧" : "Shift",
  };
  return joinReactNodes(
    keyLabels.map(({ key, label }) => (
      <span key={key} title={key}>
        {variant === "tooltip" ? (tooltipLabels[key] ?? label) : label}
      </span>
    )),
    variant === "tooltip" && mac ? "" : "+",
  );
}

export function menuSection(
  sectionName: string,
  ...items: (JSX.Element | undefined | false | null)[]
): JSX.Element[] {
  const filteredItems = items.filter(
    (it): it is JSX.Element => !!it && !it.props.hidden,
  );
  if (filteredItems.length === 0) {
    return [];
  }
  filteredItems.push(
    <Menu.Divider
      className="hiddenIfLastChild"
      key={`${sectionName}-divider`}
    />,
  );
  return filteredItems;
}
