import { useState, useRef, useCallback } from "react";

export const useFPS = () => {
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  const updateFPS = useCallback(() => {
    const now = performance.now();
    const elapsed = now - lastTimeRef.current;

    if (elapsed >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / elapsed));
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }
    frameCountRef.current++;
  }, []);

  return { fps, updateFPS };
};
