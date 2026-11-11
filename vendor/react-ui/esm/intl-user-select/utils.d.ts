import type * as React from 'react';
import type { IntlUserOption, FormattedIntlUserOption } from './types';
/**
 * 格式化海外用户全量数据为 Select 选项列表
 */
export declare const formatUserData: (responseData: IntlUserOption[], adaptor?: ((data: IntlUserOption[]) => IntlUserOption[]) | undefined, labelRender?: ((user: IntlUserOption) => React.ReactNode) | undefined, valueKey?: string, labelKey?: string) => FormattedIntlUserOption[];
/**
 * 本地多字段即时搜索匹配器
 * 支持对 用户名 (username)、昵称 (nickname)、邮箱、手机号及 ID 进行无损匹配
 */
export declare const defaultFilterOption: (input: string, option?: FormattedIntlUserOption) => boolean;
