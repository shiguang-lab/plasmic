import * as React from "react";

// The host is covered by the top-frame startup owner until it is revealed.
// While covered, omit local loading subtrees as well as their animations.
export const LoadingAnimationContext = React.createContext(true);
