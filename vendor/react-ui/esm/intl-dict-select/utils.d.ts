import type { DefaultOptionType } from 'antd/es/select';
import type { IntlDictItemTreeNode, FormattedIntlDictNode } from './types';
/** 按展示顺序寻找首个可选项；列表展开分组，树按先父后子的顺序查找。 */
export declare const findFirstSelectableOption: (items: DefaultOptionType[], isTree: boolean, isCheckable: boolean) => DefaultOptionType | undefined;
/**
 * 将正式字典的扁平列表按 parentItemCode 构建为树，并生成完整路径。
 */
export declare const formatTreeData: (data: IntlDictItemTreeNode[], labelField: string, valueField: string, separator: string, treeNodeTitleClassName: string, adaptor?: ((data: IntlDictItemTreeNode[]) => IntlDictItemTreeNode[]) | undefined) => FormattedIntlDictNode[];
/**
 * 本地搜索过滤器：支持按名称（title）、编码（value）及完整路径（fullPath）即时过滤
 */
export declare const defaultFilterTreeNode: (inputValue: string, treeNode?: Partial<Record<'title' | 'value' | 'fullPath', unknown>>) => boolean;
/** 将正式字典的全部条目排序后映射为 Select 选项。 */
export declare const formatListData: (data: IntlDictItemTreeNode[], labelField: string, valueField: string, adaptor?: ((data: IntlDictItemTreeNode[]) => IntlDictItemTreeNode[]) | undefined) => DefaultOptionType[];
