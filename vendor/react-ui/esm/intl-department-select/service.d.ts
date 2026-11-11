import type { IntlDeptTreeNode } from './types';
/**
 * 获取底层 HTTP 请求客户端：
 * 1. 显式传入的 customRequest
 * 2. 基座全局注入的 window.$$request
 * 3. 兜底回退至 @lattebank/webadmin-http
 */
export declare const getHttp: (customRequest?: any) => any;
/**
 * 执行 GET 请求，自动兼容基座 Axios 实例与 @lattebank/webadmin-http 的入参格式
 */
export declare const requestGet: (http: any, url: string, params?: Record<string, any>) => Promise<any>;
/**
 * 获取海外组织架构全量树形数据（含并发去重缓存，防止多组件重复请求）
 */
export declare const fetchIntlDepartments: (url?: string, params?: Record<string, any>, customRequest?: any) => Promise<IntlDeptTreeNode[]>;
/**
 * 清除组织架构请求缓存（主要用于测试或强制重新拉取场景）
 */
export declare const clearIntlDeptCache: () => void;
