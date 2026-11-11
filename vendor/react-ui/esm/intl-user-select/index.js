import { withConfigProvider } from "../config-provider/index.js";
import InternalIntlUserSelect from "./IntlUserSelect.js";
export var IntlUserSelect = withConfigProvider(InternalIntlUserSelect);
export default IntlUserSelect;
export { fetchIntlUsers, clearIntlUserCache } from "./service.js";
export { defaultFilterOption, formatUserData } from "./utils.js";
