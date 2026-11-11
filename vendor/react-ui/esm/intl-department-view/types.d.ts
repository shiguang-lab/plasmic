import type * as React from 'react';
import type { IntlDeptTreeNode } from '../intl-department-select/types';
/**
 * 回显解析后的单项组织架构节点数据
 */
export interface IntlDeptViewItem {
    /** 部门匹配到的值（通常为 deptCode 或 value） */
    value: string;
    /** 最终格式化渲染展示的标签或组件 */
    label: React.ReactNode;
    /** 部门层级完整路径（例如 "总公司 / 研发中心 / 前端组"） */
    fullPath?: string;
    /** 原始部门节点对象（若未在架构树中匹配到则为 undefined） */
    origin?: IntlDeptTreeNode;
    /** 是否为兜底展示（即未在架构树中找到对应节点） */
    isFallback?: boolean;
}
export interface IntlDepartmentViewProps {
    /**
     * 待回显的部门标识（支持单个值如 'dept_tech'，或数组 ['dept_root', 'dept_tech']，或逗号分隔字符串）
     */
    value?: string | number | (string | number)[];
    /**
     * 组织架构树请求地址，默认为 '/fintecharch/sys-dept/options'
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
    adaptor?: (data: IntlDeptTreeNode[]) => IntlDeptTreeNode[];
    /**
     * 部门标签名称字段，默认为 'label'
     */
    labelField?: string;
    /**
     * 部门取值标识字段，默认为 'value'
     */
    valueField?: string;
    /**
     * 是否显示层级完整路径（例如 "总公司 / 研发中心 / 前端组"），默认为 false
     */
    showFullPath?: boolean;
    /**
     * 完整路径层级分隔符，默认为 ' / '
     */
    pathSeparator?: string;
    /**
     * 直接传入部门树形数据列表（避免远程接口请求）
     */
    treeData?: IntlDeptTreeNode[];
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
     * 单个部门项自定义渲染（支持例如 (item) => `${item.label} [${item.value}]` 或自定义 JSX）
     */
    labelRender?: (item: IntlDeptViewItem) => React.ReactNode;
    /**
     * 容器级自定义渲染（完全接管最终渲染，例如渲染为 Tag 列表）
     */
    render?: (items: IntlDeptViewItem[], rawValue: any) => React.ReactNode;
    /**
     * 根节点类名
     */
    className?: string;
    /**
     * 根节点行内样式
     */
    style?: React.CSSProperties;
}
