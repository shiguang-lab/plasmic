import { createContext } from "react";

// Internal editing state never enters the component business props.
export const ResourceAuthorizationCanvasContext = createContext(false);
