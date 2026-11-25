import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cancelAnimation, Easing, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useReducedMotionPreference } from "./useReducedMotionPreference";

export type ActiveQuestTab = "map" | "entry" | "album";
const TABS: ActiveQuestTab[] = ["map", "entry", "album"];
const TRANSITION_MS = 240;
const TRANSITION_EASING = Easing.bezier(0.42, 0, 0.58, 1);

/** Keep outgoing content visible until the incoming scene has committed and faded in. */
export function useActiveQuestTabTransition(initialTab: ActiveQuestTab) {
  const [state, setState] = useState({ tab: initialTab, mounted: [initialTab], request: 0 });
  const targetTab = useRef(initialTab);
  const mountedTabs = useRef<ActiveQuestTab[]>([initialTab]);
  const revision = useRef(0);
  const pending = useRef<{ tab: ActiveQuestTab; request: number } | null>(null);
  const map = useSharedValue(initialTab === "map" ? 1 : 0);
  const entry = useSharedValue(initialTab === "entry" ? 1 : 0);
  const album = useSharedValue(initialTab === "album" ? 1 : 0);
  const progress = useMemo(() => ({ map, entry, album }), [map, entry, album]);
  const reduced = useReducedMotionPreference();

  const setTab = useCallback((next: ActiveQuestTab) => {
    const request = ++revision.current;
    pending.current = null;
    targetTab.current = next;
    mountedTabs.current = [next];
    for (const name of TABS) {
      cancelAnimation(progress[name]);
      progress[name].set(name === next ? 1 : 0);
    }
    setState({ tab: next, mounted: [next], request });
  }, [progress]);

  const finishTransition = useCallback((next: ActiveQuestTab, request: number) => {
    if (revision.current !== request || targetTab.current !== next) return;
    mountedTabs.current = [next];
    setState({ tab: next, mounted: [next], request });
  }, []);

  const selectTab = useCallback((next: ActiveQuestTab) => {
    if (targetTab.current === next) return;
    if (reduced) { setTab(next); return; }
    const request = ++revision.current;
    targetTab.current = next;
    pending.current = { tab: next, request };
    for (const name of TABS) cancelAnimation(progress[name]);
    // Rapid reversals retain each scene's current opacity and existing content.
    const mounted = Array.from(new Set([...mountedTabs.current, next]));
    mountedTabs.current = mounted;
    setState({ tab: next, mounted, request });
  }, [progress, reduced, setTab]);

  const onSceneReady = useCallback((scene: ActiveQuestTab, request: number) => {
    if (pending.current?.tab !== scene || pending.current.request !== request || revision.current !== request) return;
    pending.current = null;
    for (const name of TABS) {
      const incoming = name === scene;
      progress[name].set(withTiming(incoming ? 1 : 0, { duration: TRANSITION_MS, easing: TRANSITION_EASING }, finished => {
        if (finished && incoming) scheduleOnRN(finishTransition, scene, request);
      }));
    }
  }, [progress, finishTransition]);

  useEffect(() => {
    if (reduced) setTab(targetTab.current);
  }, [reduced, setTab]);

  useEffect(() => () => {
    revision.current += 1;
    pending.current = null;
    for (const name of TABS) cancelAnimation(progress[name]);
  }, [progress]);

  return { tab: state.tab, mountedTabs: state.mounted, request: state.request, progress, reduced, setTab, selectTab, onSceneReady };
}
