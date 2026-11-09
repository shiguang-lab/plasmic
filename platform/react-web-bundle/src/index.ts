import { CanvasTriggersRuntime } from "./canvas-triggers";
import * as CanvasPlume from "./canvas-plume";
import { CanvasQueriesRuntime } from "./canvas-queries";
import { CanvasComponentRuntime } from "./canvas-component";
import * as DataSourcesContext from "@plasmicapp/data-sources-context";
import * as ReactWeb from "@plasmicapp/react-web";
import * as DataSources from "@plasmicapp/react-web/lib/data-sources";

ReactWeb.setPlumeStrictMode(false);

(window as any).__PlasmicReactWebBundle = ReactWeb;
(window as any).__PlasmicDataSourcesBundle = DataSources;
(window as any).__PlasmicDataSourcesContextBundle = DataSourcesContext;

(window as any).__PlasmicCanvasReactRuntime = { CanvasComponentRuntime, CanvasQueriesRuntime, CanvasPlume, CanvasTriggersRuntime };
