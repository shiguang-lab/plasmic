import type { CSSProperties, ReactNode } from 'react';
import type { ButtonProps, DropdownProps } from 'antd';
/** 操作项配置 */
export interface ActionItem {
    /** 唯一标识 */
    key?: string;
    /** 显示文案 */
    label?: ReactNode;
    /** 点击回调 */
    onClick?: () => void;
    /** 图标 */
    icon?: ReactNode;
    /** 是否禁用 */
    disabled?: boolean;
    /** 是否为危险操作 */
    danger?: boolean;
    /** 悬浮提示 */
    tooltip?: string;
}
/** ActionGroup 组件 Props */
export interface ActionGroupProps {
    /** 操作项数组（优先于 children），falsy 值自动过滤 */
    items?: (ActionItem | null | false | undefined)[];
    /** 操作元素（items 未传时生效），falsy 值自动过滤 */
    children?: ReactNode;
    /** 最多直接显示的操作数，默认 3 */
    max?: number;
    /** 操作项之间的分隔符，false 不显示，true 显示默认竖线，或传入自定义 ReactNode，默认 false */
    divider?: boolean | ReactNode;
    /** "更多"按钮文案，默认 '更多' */
    moreText?: ReactNode;
    /** "更多"按钮图标，设为 false 隐藏图标，默认 DownOutlined */
    moreIcon?: ReactNode | false;
    /** "更多"按钮类型，默认 'link' */
    moreButtonType?: ButtonProps['type'];
    /** "更多"按钮尺寸，默认 'small' */
    moreButtonSize?: ButtonProps['size'];
    /** Dropdown 配置，透传给 antd Dropdown（trigger 默认 ['click']，placement 默认 'bottomRight'） */
    dropdownProps?: Omit<DropdownProps, 'menu'>;
    /** 自定义类名 */
    className?: string;
    /** 自定义样式 */
    style?: CSSProperties;
}
//# sourceMappingURL=types.d.ts.map