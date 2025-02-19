import { useCallback } from "react";

export const useSegmentationRenderer = (canvasRef) => {
  const renderSegmentation = useCallback(
    async (video, segmentation, classMap) => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // 创建临时画布来处理分割结果
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = segmentation.width;
      tempCanvas.height = segmentation.height;
      const tempCtx = tempCanvas.getContext("2d");
      const tempImageData = tempCtx.createImageData(
        segmentation.width,
        segmentation.height
      );

      // 记录检测到的类别
      const detectedClasses = new Set();

      // 处理分割结果
      for (let i = 0; i < segmentation.segmentationMap.length; i++) {
        const classId = segmentation.segmentationMap[i];
        const pixelIndex = i * 4;

        // 初始化像素数据
        tempImageData.data[pixelIndex] = 0;
        tempImageData.data[pixelIndex + 1] = 0;
        tempImageData.data[pixelIndex + 2] = 0;
        tempImageData.data[pixelIndex + 3] = 0;

        if (classId > 0 && classMap[classId]) {
          detectedClasses.add(classId);
          const color = classMap[classId].color;
          tempImageData.data[pixelIndex] = color[0];
          tempImageData.data[pixelIndex + 1] = color[1];
          tempImageData.data[pixelIndex + 2] = color[2];
          tempImageData.data[pixelIndex + 3] = 128; // 半透明
        }
      }

      // 绘制原始视频帧
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 绘制分割结果
      tempCtx.putImageData(tempImageData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

      // 绘制检测到的类别标签
      if (detectedClasses.size > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(5, 40, 150, 25 + detectedClasses.size * 20);

        ctx.font = "16px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "left";

        let y = 60;
        ctx.fillText("检测到的物体:", 10, y);
        y += 25;

        detectedClasses.forEach((classId) => {
          const classInfo = classMap[classId];
          if (classInfo) {
            const color = classInfo.color;
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fillRect(15, y - 12, 12, 12);
            ctx.fillStyle = "white";
            ctx.fillText(classInfo.name, 35, y);
            y += 20;
          }
        });
      }

      // 清理临时画布
      tempCanvas.remove();
    },
    [canvasRef]
  );

  return { renderSegmentation };
};
