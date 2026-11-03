import "./entry";
import "./drag-entry";
import { getSelectableLayers } from "@geometry-baseline";
import { DragMoveManager } from "@drag-baseline";
(window as any).__geometryBaseline=getSelectableLayers;
(window as any).__dragBaseline=DragMoveManager;
(window as any).__geometry.production=true;
