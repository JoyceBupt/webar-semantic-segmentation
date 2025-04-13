import { useState, useCallback, useRef } from "react";

export const useFPS = () => {
  const [fps, setFPS] = useState(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  const updateFPS = useCallback(() => {
    frameCountRef.current += 1;
    const now = performance.now();
    const elapsed = now - lastTimeRef.current;

    // 每秒更新一次 FPS
    if (elapsed >= 1000) {
      setFPS((frameCountRef.current / elapsed) * 1000);
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }
  }, []);

  return { fps, updateFPS };
};