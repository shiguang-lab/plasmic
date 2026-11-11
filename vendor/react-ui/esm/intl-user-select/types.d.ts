import type * as React from 'react';
import type { SelectProps } from 'antd';
/**
 * 海外系统用户接口返回的原始数据结构
 */
export interface IntlUserOption {
    /** 用户唯一标识（UUID） */
    userId: string;
    /** 账户登录名/用户名 */
    username: string;
    /** 用户中文名/花名/昵称 */
    nickname: string;
    /** 邮箱 */
    email?: string;
    /** 手机号 */
    phone?: string;
    /** 其他任意拓展字段 */
    [key: string]: any;
}
/**
 * 格式化后的 Select 选项结构
 */
export interface FormattedIntlUserOption {
    /** 渲染显示的标签或文本 */
    label: React.ReactNode;
    /** 选中的值，默认通常为 userId 或 username */
    value: string;
    /** 原始用户数据对象 */
    origin: IntlUserOption;
    /** 用户名 */
    username: string;
    /** 昵称 */
    nickname: string;
    /** 是否禁用 */
    disabled?: boolean;
    [key: string]: any;
}
export interface IntlUserSelectProps extends Omit<SelectProps<any, FormattedIntlUserOption>, 'options' | 'labelRender'> {
    /**
     * 用户全量数据请求地址，默认为 '/fintecharch/sys-user/options'
     */
    source?: string | (() => string);
    /**
     * 自定义请求实例（支持传入基座下发的 request / axios 实例或自定义请求函数）
     * 默认优先使用 props.request，其次使用基座全局注入的 window.$$request
     */
    request?: any;
    /**
     * 请求参数（如需传递特定系统参数）
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
     * 选项的取值字段，默认为 'userId'
     */
    valueKey?: string;
    /**
     * 选项的默认回显显示字段，默认为 'nickname'
     */
    labelKey?: string;
    /**
     * 自定义选项标签渲染函数（支持例如 nickname-username、JSX Tag 或高亮组合）
     * 设置后下拉选项即显示为此渲染结果，同时内置拼音与多字段即时搜索依然生效
     */
    labelRender?: (user: IntlUserOption) => React.ReactNode;
    /**
     * 直接传入用户选项列表（如传入则不再请求远程接口）
     */
    options?: IntlUserOption[];
}
