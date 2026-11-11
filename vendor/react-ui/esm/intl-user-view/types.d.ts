import type * as React from 'react';
import type { IntlUserOption } from '../intl-user-select/types';
/**
 * 回显解析后的单项用户数据
 */
export interface IntlUserViewItem {
    /** 匹配到的值（通常为 userId） */
    value: string;
    /** 最终格式化渲染展示的标签或组件 */
    label: React.ReactNode;
    /** 原始海外用户对象（若未在用户库中匹配到则为 undefined） */
    origin?: IntlUserOption;
    /** 用户名 */
    username?: string;
    /** 昵称 */
    nickname?: string;
    /** 是否为兜底展示（即未在用户字典中找到对应数据） */
    isFallback?: boolean;
}
export interface IntlUserViewProps {
    /**
     * 待回显的用户值（支持单个值如 'u-1'，或数组 ['u-1', 'u-2']，或逗号分隔字符串 'u-1,u-2'）
     */
    value?: string | number | (string | number)[];
    /**
     * 全量用户接口请求地址，默认为 '/fintecharch/sys-user/options'
     */
    source?: string | (() => string);
    /**
     * 自定义请求实例（支持传入基座下发的 request / axios 实例或自定义请求函数）
     * 默认优先使用 props.request，其次使用基座全局注入的 window.$$request
     */
    request?: any;
    /**
     * 附加请求参数
     */
    params?: Record<string, any>;
    /**
     * 请求入参适配器
     */
    requestAdaptor?: (params?: Record<string, any>) => Record<string, any>;
    /**
     * 响应数据适配器
     */
    adaptor?: (data: IntlUserOption[]) => IntlUserOption[];
    /**
     * 匹配取值字段，默认为 'userId'
     */
    valueKey?: string;
    /**
     * 默认标签显示字段，默认为 'nickname'
     */
    labelKey?: string;
    /**
     * 直接传入用户数据列表（避免远程请求）
     */
    options?: IntlUserOption[];
    /**
     * 多值拼接分隔符，默认为 ', '
     */
    separator?: string;
    /**
     * 空值或无匹配时展示的文案，默认为 '-'
     */
    emptyText?: React.ReactNode;
    /**
     * 自定义轻量加载指示图标
     */
    loadingIcon?: React.ReactNode;
    /**
     * 单个用户项自定义渲染（支持例如 (u) => `${u.nickname}-${u.username}` 或自定义 JSX）
     */
    labelRender?: (user: IntlUserOption) => React.ReactNode;
    /**
     * 容器级自定义渲染（完全接管最终渲染，例如渲染为 Tag 列表或自定义排版）
     */
    render?: (items: IntlUserViewItem[], rawValue: any) => React.ReactNode;
    /**
     * 根节点类名
     */
    className?: string;
    /**
     * 根节点行内样式
     */
    style?: React.CSSProperties;
}
