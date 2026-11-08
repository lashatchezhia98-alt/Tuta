import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { apiRoot } from "./api";
type Snapshot = {
  status: "loading" | "ready" | "error";
  features: Record<string, boolean>;
};
const initial: Snapshot = { status: "loading", features: {} };
let snapshot = initial,
  pending: Promise<void> | null = null;
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((listener) => listener());
}
export function refreshFeatures() {
  if (pending) return pending;
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 10000);
  pending = fetch(apiRoot + "/api/site-features", {
    signal: controller.signal,
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) throw Error();
      const body = await response.json();
      snapshot = { status: "ready", features: body.features || {} };
    })
    .catch(() => {
      snapshot = { status: "error", features: {} };
    })
    .finally(() => {
      clearTimeout(timeout);
      pending = null;
      emit();
    });
  return pending;
}
let users = 0,
  stop: undefined | (() => void);
export function useAppFeatures(active = true) {
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => snapshot,
    () => initial,
  );
  useEffect(() => {
    if (!active) return;
    if (++users === 1) {
      void refreshFeatures();
      const timer = setInterval(() => {
        if (AppState.currentState === "active") void refreshFeatures();
      }, 15000);
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") void refreshFeatures();
      });
      stop = () => {
        clearInterval(timer);
        sub.remove();
      };
    }
    return () => {
      if (--users === 0) {
        stop?.();
        stop = undefined;
      }
    };
  }, [active]);
  return { ...state, retry: refreshFeatures };
}
export function useFeatureEnabled(feature: string, active = true) {
  const state = useAppFeatures(active);
  return {
    status:
      state.status === "ready"
        ? state.features[feature] === true
          ? "enabled"
          : "disabled"
        : state.status,
    retry: state.retry,
  };
}
export function useJourneyEnabled(active = true) {
  return useFeatureEnabled("journey", active);
}
