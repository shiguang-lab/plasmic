import { withConfigProvider } from "../config-provider/index.js";
import InternalIntlUserView from "./IntlUserView.js";
export var IntlUserView = withConfigProvider(InternalIntlUserView);
export default IntlUserView;
