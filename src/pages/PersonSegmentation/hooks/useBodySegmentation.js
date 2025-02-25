import { useState, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";
import * as bodySegmentation from "@tensorflow-models/body-segmentation";

export const useBodySegmentation = () => {
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadModel = useCallback(async () => {
    try {
      // 基础初始化
      await tf.ready();

      // 确保使用 WebGL 后端
      if (tf.getBackend() !== "webgl") {
        await tf.setBackend("webgl");
      }

      // 启用生产模式以提高性能
      tf.enableProdMode();

      // 加载分割模型
      const model = await bodySegmentation.createSegmenter(
        bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
        {
          runtime: "tfjs",
          modelType: "general",
        }
      );

      setModel(model);
      setLoading(false);
      return model;
    } catch (error) {
      console.error("模型加载失败:", error);
      setLoading(false);
      return null;
    }
  }, []);

  const segmentPeople = useCallback(
    async (video, options = {}) => {
      if (!model || !video) return null;

      try {
        // 确保 WebGL 后端可用
        if (tf.getBackend() !== "webgl") {
          await tf.setBackend("webgl");
        }

        // 执行人像分割
        const people = await model.segmentPeople(video, {
          flipHorizontal: false,
          multiSegmentation: false,
          segmentBodyParts: false,
          ...options,
        });

        return people;
      } catch (error) {
        console.error("人像分割过程出错:", error);
        return null;
      }
    },
    [model]
  );

  return {
    model,
    loading,
    loadModel,
    segmentPeople,
  };
};
