import type * as React from 'react';
import type { IntlDeptTreeNode, FormattedIntlDeptNode } from './types';
export interface FormatDeptTreeOptions {
    labelField?: string;
    valueField?: string;
    pathSeparator?: string;
    labelRender?: (node: IntlDeptTreeNode) => React.ReactNode;
    adaptor?: (data: IntlDeptTreeNode[]) => IntlDeptTreeNode[];
}
/**
 * 递归格式化海外组织架构树数据
 */
export declare const formatDeptTreeData: (nodes: IntlDeptTreeNode[], options?: FormatDeptTreeOptions, parentPath?: string) => FormattedIntlDeptNode[];
/**
 * 组织架构树本地即时搜索匹配器
 * 支持对节点标签名称、节点编码 (value) 以及层级完整路径 (fullPath) 进行模糊匹配
 */
export declare const defaultFilterTreeNode: (inputValue: string, treeNode?: any) => boolean;
