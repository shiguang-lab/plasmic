import type * as React from 'react';
import type { TreeSelectProps } from 'antd';
/**
 * 海外系统组织架构接口返回的原始节点结构
 */
export interface IntlDeptTreeNode {
    /** 部门名称（展示标签） */
    label: string;
    /** 部门编码或唯一标识 */
    value: string;
    /** 子部门树形列表 */
    children?: IntlDeptTreeNode[];
    /** 排序号 */
    sort?: number;
    /** 状态 */
    status?: string | number;
    /** 其他任意拓展字段 */
    [key: string]: any;
}
/**
 * 格式化后的 TreeSelect 树形节点数据结构
 */
export interface FormattedIntlDeptNode {
    /** 显示内容 */
    label: React.ReactNode;
    /** 节点标识值（用于表单提交与回显匹配） */
    value: string;
    /** 树节点标题（用于 Tree 渲染） */
    title: React.ReactNode;
    /** 从根节点到本节点的层级完整路径（如 "总部 / 研发中心 / 前端组"） */
    fullPath?: string;
    /** 子节点列表 */
    children?: FormattedIntlDeptNode[];
    /** 原始部门节点对象 */
    origin: IntlDeptTreeNode;
    /** 是否禁用 */
    disabled?: boolean;
    [key: string]: any;
}
export interface IntlDepartmentSelectProps extends Omit<TreeSelectProps<any, FormattedIntlDeptNode>, 'treeData' | 'labelRender'> {
    /**
     * 组织架构树全量数据请求地址，默认为 '/fintecharch/sys-dept/options'
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
     * 部门名称标签字段，默认为 'label'（兼容 'name'）
     */
    labelField?: string;
    /**
     * 部门取值标识字段，默认为 'value'（兼容 'deptCode'、'id'）
     */
    valueField?: string;
    /**
     * 选中后或展示时是否显示从根节点到本节点的完整路径，默认为 false
     */
    showFullPath?: boolean;
    /**
     * 完整路径层级分隔符，默认为 ' / '
     */
    pathSeparator?: string;
    /**
     * 自定义节点展示渲染函数（例如 (node) => `${node.label} [${node.value}]` 或带有 Tag 标签）
     */
    labelRender?: (node: IntlDeptTreeNode) => React.ReactNode;
    /**
     * 直接传入树形数据列表（避免远程接口请求）
     */
    treeData?: IntlDeptTreeNode[];
}
