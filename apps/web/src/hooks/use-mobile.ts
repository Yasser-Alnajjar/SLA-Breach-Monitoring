import * as React from "react";

const MOBILE_BREAKPOINT = 768;

const getMediaQuery = () => `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const subscribe = (callback: () => void) => {
  const mql = window.matchMedia(getMediaQuery());

  mql.addEventListener("change", callback);

  return () => {
    mql.removeEventListener("change", callback);
  };
};

const getSnapshot = () => window.matchMedia(getMediaQuery()).matches;

const getServerSnapshot = () => false;

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
