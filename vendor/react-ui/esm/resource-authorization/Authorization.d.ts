import Record from './Record';
import type { ResourceAuthorizationProps } from './types';
declare function AuthorizationCom({ open, resourceTypeCode, resourceId, resourceName, onClose, onSuccess, apiSources, title, width, }: ResourceAuthorizationProps): import("react/jsx-runtime").JSX.Element;
export declare const Authorization: typeof AuthorizationCom & {
    Record: typeof Record;
};
export default Authorization;
