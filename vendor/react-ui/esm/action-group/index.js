import { withConfigProvider } from "../config-provider/index.js";
import { ActionGroup as InternalActionGroup } from "./ActionGroup.js";
export var ActionGroup = withConfigProvider(InternalActionGroup);
