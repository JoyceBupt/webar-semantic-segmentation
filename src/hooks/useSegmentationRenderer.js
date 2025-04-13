import { useCallback } from "react";

export const useSegmentationRenderer = (canvasRef) => {
  const renderSegmentation = useCallback(
    async (
      video,
      segmentation,
      classMap,
      selectedClass = null,
      alpha = 0.6,
      threshold = 0.5
    ) => {
      if (!canvasRef.current) return [];

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

      // 检查分割数据格式并规范化
      let segmentationData = segmentation.data;

      // 如果数据是空的或无效，早期返回
      if (
        !segmentationData ||
        (Array.isArray(segmentationData) && segmentationData.length === 0)
      ) {
        // 只绘制原始视频帧
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        tempCanvas.remove();
        return [];
      }

      // 计算透明度值
      const baseAlpha = Math.round(alpha * 255);
      const highlightAlpha = Math.min(255, Math.round(baseAlpha * 1.5));

      // 确定数据格式
      const isNestedArray =
        segmentation.shape === "nested" ||
        (Array.isArray(segmentationData) && Array.isArray(segmentationData[0]));

      try {
        if (isNestedArray) {
          // 二维数组
          for (let y = 0; y < segmentationData.length; y++) {
            for (let x = 0; x < segmentationData[y].length; x++) {
              const classId = segmentationData[y][x];
              const pixelIndex = (y * segmentation.width + x) * 4;

              // 初始化像素数据
              tempImageData.data[pixelIndex] = 0;
              tempImageData.data[pixelIndex + 1] = 0;
              tempImageData.data[pixelIndex + 2] = 0;
              tempImageData.data[pixelIndex + 3] = 0;

              // 如果有选定的类别，只显示该类别，否则显示所有类别
              if (classId > 0 && classMap[classId]) {
                // 应用阈值过滤
                const confidence = 1.0; // 假设置信度为1，如果API提供置信度，可以使用实际值

                if (
                  confidence >= threshold &&
                  (selectedClass === null || classId === selectedClass)
                ) {
                  detectedClasses.add(classId);
                  const color = classMap[classId].color;
                  // 如果是选定的类别，增加透明度使其更突出
                  const alphaValue =
                    selectedClass === classId ? highlightAlpha : baseAlpha;
                  tempImageData.data[pixelIndex] = color[0];
                  tempImageData.data[pixelIndex + 1] = color[1];
                  tempImageData.data[pixelIndex + 2] = color[2];
                  tempImageData.data[pixelIndex + 3] = alphaValue;
                }
              }
            }
          }
        } else {
          // 一维数组 - 扁平格式 [class1, class2, ...]
          const width = segmentation.width;
          const height = segmentation.height;

          if (segmentationData.length !== width * height) {
            // 删除此处的警告，但保留逻辑
          }

          for (
            let i = 0;
            i < Math.min(segmentationData.length, width * height);
            i++
          ) {
            const classId = segmentationData[i];
            const pixelIndex = i * 4;

            // 初始化像素数据
            tempImageData.data[pixelIndex] = 0;
            tempImageData.data[pixelIndex + 1] = 0;
            tempImageData.data[pixelIndex + 2] = 0;
            tempImageData.data[pixelIndex + 3] = 0;

            // 如果有选定的类别，只显示该类别，否则显示所有类别
            if (classId > 0 && classMap[classId]) {
              // 应用阈值过滤
              const confidence = 1.0; // 假设置信度为1，如果API提供置信度，可以使用实际值

              if (
                confidence >= threshold &&
                (selectedClass === null || classId === selectedClass)
              ) {
                detectedClasses.add(classId);
                const color = classMap[classId].color;
                // 如果是选定的类别，增加透明度使其更突出
                const alphaValue =
                  selectedClass === classId ? highlightAlpha : baseAlpha;
                tempImageData.data[pixelIndex] = color[0];
                tempImageData.data[pixelIndex + 1] = color[1];
                tempImageData.data[pixelIndex + 2] = color[2];
                tempImageData.data[pixelIndex + 3] = alphaValue;
              }
            }
          }
        }

        // 绘制原始视频帧
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 绘制分割结果
        tempCtx.putImageData(tempImageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        // 出错时只显示原始视频
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        console.error("Error rendering segmentation:", error);
      } finally {
        // 清理临时画布
        tempCanvas.remove();
      }

      // 返回检测到的类别
      return Array.from(detectedClasses);
    },
    [canvasRef]
  );

  return { renderSegmentation };
};
