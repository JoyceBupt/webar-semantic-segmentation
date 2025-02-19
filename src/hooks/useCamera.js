import { useCallback } from "react";

export const useCamera = (videoRef) => {
  const setupCamera = useCallback(async () => {
    if (!videoRef.current) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user",
        },
        audio: false,
      });

      const video = videoRef.current;
      video.srcObject = stream;

      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      return true;
    } catch (error) {
      console.error("摄像头访问失败:", error);
      return false;
    }
  }, [videoRef]);

  return { setupCamera };
};
