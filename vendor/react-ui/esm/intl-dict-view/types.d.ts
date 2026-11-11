import type { ReactNode, CSSProperties } from 'react';
import type { IntlDictItemTreeNode } from '../intl-dict-select/types';
/**
 * 解析后的单个字典项对象
 */
export interface IntlDictViewItem {
    /** 字典项对应的展示文本，若未匹配到字典项则 fallback 为编码本身 */
    label: string;
    /** 原始传入的编码值 */
    value: string | number;
    /** 是否在字典树中成功匹配到了对应的字典项 */
    matched: boolean;
    /** 匹配到的原始字典项数据节点，未匹配到时为 undefined */
    origin?: IntlDictItemTreeNode;
}
/**
 * IntlDictView Props
 */
export interface IntlDictViewProps {
    /** 字典编码，如 PROVINCE_DICT */
    dictCode?: string;
    /**
     * 需要解析显示的编码值，支持单个值或多个值数组
     * 例如: "BEIJING" 或 ["BEIJING", "SUZHOU"]
     */
    value?: string | number | (string | number)[] | null;
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
    /** 附加的请求 Query 参数 */
    params?: Record<string, any>;
    /** 自定义请求参数适配器 */
    requestAdaptor?: (dictCode?: string) => Record<string, any>;
    /** 自定义响应数据适配器 */
    adaptor?: (data: IntlDictItemTreeNode[]) => IntlDictItemTreeNode[];
    /** 显示字段名，默认为 'dictItemName' */
    labelField?: string;
    /** 取值字段名，默认为 'dictItemCode' */
    valueField?: string;
    /**
     * 多值展示时的分隔符，默认为 ','
     */
    separator?: string;
    /**
     * 自定义渲染方式
     * @param items 解析后的选项列表（包含 label, value, matched, origin）
     * @param rawValue 原始传入的 value
     */
    render?: (items: IntlDictViewItem[], rawValue: any) => ReactNode;
    /** 自定义 Loading 图标或组件，默认展示小尺寸 LoadingOutlined 图标 */
    loadingIcon?: ReactNode;
    /** 手动传入的树节点数据，传入后优先使用而不发起网络请求 */
    treeData?: IntlDictItemTreeNode[];
    /** 当 value 为空（null, undefined, 空数组）时的占位内容，默认为 '-' */
    emptyText?: ReactNode;
    /** 自定义类名 */
    className?: string;
    /** 自定义行内样式 */
    style?: CSSProperties;
}
