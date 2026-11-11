import InternalIntlDictSelect from './IntlDictSelect';
import { IntlDictView } from '../intl-dict-view';
type CompoundedIntlDictSelect = typeof InternalIntlDictSelect & {
    View: typeof IntlDictView;
};
export declare const IntlDictSelect: CompoundedIntlDictSelect;
export default IntlDictSelect;
export { IntlDictView };
export { fetchDictItems, clearDictCache } from './service';
export { formatTreeData, defaultFilterTreeNode } from './utils';
export type { IntlDictSelectProps, IntlDictItemTreeNode, FormattedIntlDictNode, } from './types';
export type { IntlDictViewProps, IntlDictViewItem } from '../intl-dict-view';
