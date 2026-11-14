import { useCallback, useEffect, useState, type RefObject } from "react";
import { Keyboard, Platform, type View } from "react-native";

// Android usually resizes the window. Edge-to-edge devices can instead leave
// some of the form behind the IME; only reserve the space it actually covers.
export function useFormKeyboard(viewport: RefObject<View | null>) {
  const [keyboard, setKeyboard] = useState(() => Keyboard.metrics());
  const [overlap, setOverlap] = useState(0);

  const measure = useCallback((screenY: number) => {
    const view = viewport.current;
    view?.measureInWindow((_x, y, _width, height) => {
      if (viewport.current === view && Keyboard.isVisible()) {
        setOverlap(Math.max(0, Math.ceil(y + height - screenY)));
      }
    });
  }, [viewport]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow",
      (event) => setKeyboard(event.endCoordinates.height > 0 ? event.endCoordinates : undefined),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => { setKeyboard(undefined); setOverlap(0); },
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  const screenY = Platform.OS === "android" ? keyboard?.screenY : undefined;
  useEffect(() => {
    if (screenY !== undefined) {
      const frame = requestAnimationFrame(() => measure(screenY));
      return () => cancelAnimationFrame(frame);
    }
  }, [measure, screenY]);

  return {
    visible: Boolean(keyboard),
    overlap: screenY === undefined ? 0 : overlap,
    onLayout: () => { if (screenY !== undefined) measure(screenY); },
  };
}
