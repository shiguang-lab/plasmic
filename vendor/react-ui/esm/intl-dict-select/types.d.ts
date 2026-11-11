import type { SelectProps, TreeSelectProps } from 'antd';
import type { DefaultOptionType } from 'antd/es/select';
import type { ReactNode } from 'react';
/**
 * 海外系统字典条目（正式数据接口返回扁平列表）
 */
export interface IntlDictItemTreeNode {
    /** 字典编码 */
    dictCode?: string;
    /** 字典项编码（通常作为选项的 value） */
    dictItemCode: string;
    /** 字典项名称（通常作为选项显示的文本） */
    dictItemName: string;
    /** 父级字典项编码（扁平列表构建树时使用） */
    parentItemCode?: string | null;
    /** 层级 */
    level?: number;
    /** 排序号 */
    seq?: number;
    /** 是否禁用 */
    disabled?: boolean;
    /** 操作状态 */
    operation?: string;
    /** 更新时间戳 */
    updatedAt?: number | string;
    /** 更新人 */
    updatedBy?: string;
    /** 自定义数据或手动传入回显数据时的子节点列表 */
    children?: IntlDictItemTreeNode[];
    /** 扩展属性 */
    [key: string]: any;
}
/**
 * 格式化后的字典树节点
 */
export interface FormattedIntlDictNode extends Omit<DefaultOptionType, 'label'> {
    /** 选项展示的 ReactNode（含 Tooltip） */
    label: ReactNode;
    /** 纯文本标题，供搜索与 tooltip 回退使用 */
    title: string;
    /** 完整层级路径，如 "江苏省 / 苏州市" */
    fullPath: string;
    /** 选项值 */
    value: string;
    /** 原始数据对象引用 */
    origin: IntlDictItemTreeNode;
    /** 是否禁用 */
    disabled?: boolean;
    /** 子节点列表 */
    children?: FormattedIntlDictNode[];
}
/**
 * IntlDictSelect 组件 Props
 */
interface IntlDictCommonProps {
    /**
     * 字典编码
     * 对应接口路径中的 ${dictCode}，如 PROVINCE_DICT
     */
    dictCode?: string;
    /**
     * 远程数据源 URL 或生成函数
     * 默认: /fintecharch/configservice/mgr/dict/dicts/${dictCode}/plain/dictItems（正式数据）
     * 传入字符串时直接作为请求地址，传入函数时为 (dictCode: string) => string
     */
    source?: string | ((dictCode: string) => string);
    /**
     * 自定义请求实例（支持传入基座下发的 request / axios 实例或自定义请求函数）
     * 默认优先使用 props.request，其次使用基座全局注入的 window.$$request
     */
    request?: any;
    /**
     * 附加的请求参数（通过 query params 传递）
     */
    params?: Record<string, any>;
    /**
     * 自定义请求参数适配器，返回值会合并到请求参数中
     */
    requestAdaptor?: (dictCode?: string) => Record<string, any>;
    /**
     * 自定义响应数据适配器，用于在组件格式化前对接口原始数据进行处理
     */
    adaptor?: (data: IntlDictItemTreeNode[]) => IntlDictItemTreeNode[];
    /**
     * 显示名称字段名，默认为 'dictItemName'
     */
    labelField?: string;
    /**
     * 取值字段名，默认为 'dictItemCode'
     */
    valueField?: string;
    /**
     * 路径分隔符，默认为 '/'
     */
    separator?: string;
    /** 是否多选，默认 false；list 模式对应 Select 的 multiple 模式 */
    multiple?: boolean;
    /**
     * 选项就绪且初始值为空时，自动选择第一个可选项并触发 onChange，默认 false。
     * 每次挂载仅初始化一次；保留已有 value/defaultValue，用户清空后不自动回填。
     */
    autoSelectFirst?: boolean;
}
interface IntlDictListProps extends IntlDictCommonProps, Omit<SelectProps<any, DefaultOptionType>, 'mode'> {
    /** 展示类型，默认 list，使用 Select */
    type?: 'list';
}
interface IntlDictTreeProps extends IntlDictCommonProps, Omit<TreeSelectProps<any, FormattedIntlDictNode>, 'treeData' | 'loadData' | 'labelRender'> {
    /** 树字典须显式配置 tree，使用 TreeSelect */
    type: 'tree';
    /** 选中后是否展示完整层级路径，默认 false */
    showFullPath?: boolean;
    /**
     * 是否支持带复选框的树选择（显示 checkbox，支持父子联动勾选）
     */
    treeCheckable?: boolean;
    /**
     * checkable 状态下节点选择完全受控（父子节点选中状态不再关联）
     */
    treeCheckStrictly?: boolean;
    /**
     * 配置 checkable 状态下回填到输入框的策略
     * TreeSelect.SHOW_ALL: 显示所有选中的节点
     * TreeSelect.SHOW_PARENT: 只显示父节点
     * TreeSelect.SHOW_CHILD: 只显示子节点
     */
    showCheckedStrategy?: TreeSelectProps['showCheckedStrategy'];
    /**
     * 手动传入的树形数据，传入后优先使用而不发起远程请求
     */
    treeData?: FormattedIntlDictNode[];
}
export type IntlDictSelectProps = IntlDictListProps | IntlDictTreeProps;
export {};
