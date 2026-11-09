import React, { RefObject, useMemo } from "react";

/**
 * Creates a map of RefObject that can be used on dynamic lists
 * for which the ref of each element is needed
 */
class RefMap<Key, RefType> {
  private readonly refs = new Map<Key, RefObject<RefType | null>>();
  get = (key: Key) => {
    let ref = this.refs.get(key);
    if (!ref) {
      ref = React.createRef<RefType>();
      this.refs.set(key, ref);
    }
    return ref;
  };
}

export const useRefMap = <Key, RefType>() =>
  useMemo(() => new RefMap<Key, RefType>().get, []);
