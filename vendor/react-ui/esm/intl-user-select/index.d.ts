/// <reference types="react" />
export declare const IntlUserSelect: import("react").ForwardRefExoticComponent<Omit<import("./types").IntlUserSelectProps & import("react").RefAttributes<any>, "ref"> & import("react").RefAttributes<unknown>>;
export default IntlUserSelect;
export { fetchIntlUsers, clearIntlUserCache } from './service';
export { defaultFilterOption, formatUserData } from './utils';
export type { IntlUserSelectProps, IntlUserOption, FormattedIntlUserOption, } from './types';
