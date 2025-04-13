import { useState, useEffect, useCallback, useRef } from "react";

export const useSegmentationWorker = () => {
  const [status, setStatus] = useState("IDLE");
  const [error, setError] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isTfInitialized, setIsTfInitialized] = useState(false);
  const workerRef = useRef(null);

  // 初始化Worker
  useEffect(() => {
    try {
      // 创建Worker实例
      const worker = new Worker(
        new URL("../workers/segmentationWorker.js", import.meta.url),
        { type: "module" }
      );

      // 设置消息处理
      worker.onmessage = (e) => {
        const {
          type,
          status: workerStatus,
          error: workerError,
        } = e.data;

        switch (type) {
          case "STATUS":
            setStatus(workerStatus);
            if (workerStatus === "MODEL_LOADED") {
              setIsModelLoaded(true);
            }
            if (workerStatus === "TF_INITIALIZED") {
              setIsTfInitialized(true);
            }
            break;

          case "ERROR":
            setError(workerError);
            break;

          case "SEGMENTATION_RESULT":
            // 这里不做任何处理，结果会直接通过processFrame函数的Promise返回
            break;
        }
      };

      // 错误处理
      worker.onerror = (err) => {
        setError(`Worker error: ${err.message}`);
      };

      workerRef.current = worker;

      // 组件卸载时清理Worker
      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch (error) {
      setError(`Failed to initialize worker: ${error.message}`);
    }
  }, []);

  // 加载模型
  const loadModel = useCallback(
    (modelUrl, modelConfig = {}) => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          return reject("Worker not initialized");
        }
        // 确保TensorFlow已初始化
        if (!isTfInitialized) {
          // 等待TensorFlow初始化
          const checkTfInterval = setInterval(() => {
            if (isTfInitialized) {
              clearInterval(checkTfInterval);
              proceedWithLoading();
            }
          }, 100);

          // 设置超时
          setTimeout(() => {
            clearInterval(checkTfInterval);
            reject("TensorFlow initialization timeout");
          }, 5000);
        } else {
          proceedWithLoading();
        }

        function proceedWithLoading() {
          setStatus("LOADING");
          setError(null);

          // 创建一个消息处理函数来监听加载状态变化
          const messageHandler = (e) => {
            const { type, status: modelStatus, error: loadError } = e.data;

            if (type === "STATUS" && modelStatus === "MODEL_LOADED") {
              if (workerRef.current) {
                workerRef.current.removeEventListener(
                  "message",
                  messageHandler
                );
              }
              setIsModelLoaded(true);
              resolve();
            } else if (type === "ERROR") {
              if (workerRef.current) {
                workerRef.current.removeEventListener(
                  "message",
                  messageHandler
                );
              }
              reject(loadError);
            }
          };

          // 添加消息处理器
          workerRef.current.addEventListener("message", messageHandler);

          // 发送加载模型消息，包含模型URL和配置
          workerRef.current.postMessage({
            type: "LOAD_MODEL",
            data: {
              modelUrl,
              modelConfig,
            },
          });

          // 设置超时，以防模型无法加载
          const timeout = setTimeout(() => {
            if (workerRef.current) {
              workerRef.current.removeEventListener("message", messageHandler);
            }
            reject("Model loading timed out");
          }, 30000); // 30秒超时

          // 返回清理函数
          return () => {
            clearTimeout(timeout);
            if (workerRef.current) {
              workerRef.current.removeEventListener("message", messageHandler);
            }
          };
        }
      });
    },
    [isTfInitialized]
  );

  // 处理单个视频帧
  const processFrame = useCallback(
    (videoElement) => {
      if (!workerRef.current) {
        return Promise.reject("Worker not initialized");
      }

      if (!isModelLoaded) {
        return Promise.reject("Model not loaded");
      }

      return new Promise((resolve, reject) => {
        try {
          // 创建临时画布捕获视频帧
          const canvas = document.createElement("canvas");
          const width = videoElement.videoWidth;
          const height = videoElement.videoHeight;
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(videoElement, 0, 0, width, height);

          // 获取图像数据
          const imageData = ctx.getImageData(0, 0, width, height).data;

          // 设置一次性消息处理器接收处理结果
          const messageHandler = (e) => {
            const { type, segmentation, error: workerError } = e.data;

            if (type === "SEGMENTATION_RESULT") {
              if (workerRef.current) {
                workerRef.current.removeEventListener(
                  "message",
                  messageHandler
                );
                workerRef.current.removeEventListener("error", errorHandler);
              }
              clearTimeout(timeout);

              // 确保结果中有所有需要的数据
              if (segmentation && segmentation.data) {
                resolve(segmentation);
              } else {
                reject("Invalid segmentation result received from worker");
              }
            } else if (type === "ERROR") {
              if (workerRef.current) {
                workerRef.current.removeEventListener(
                  "message",
                  messageHandler
                );
                workerRef.current.removeEventListener("error", errorHandler);
              }
              clearTimeout(timeout);
              reject(workerError);
            }
          };

          // 添加错误处理
          const errorHandler = (err) => {
            if (workerRef.current) {
              workerRef.current.removeEventListener("message", messageHandler);
              workerRef.current.removeEventListener("error", errorHandler);
            }
            clearTimeout(timeout);
            reject(`Worker error: ${err.message}`);
          };

          workerRef.current.addEventListener("message", messageHandler);
          workerRef.current.addEventListener("error", errorHandler);

          // 设置超时以防止无限等待
          const timeout = setTimeout(() => {
            if (workerRef.current) {
              workerRef.current.removeEventListener("message", messageHandler);
              workerRef.current.removeEventListener("error", errorHandler);
            }
            reject("Frame processing timed out");
          }, 5000); // 5秒超时

          // 发送图像数据到Worker
          try {
            workerRef.current.postMessage(
              {
                type: "PROCESS_FRAME",
                data: {
                  imageData: imageData.buffer,
                  width,
                  height,
                },
              },
              [imageData.buffer]
            ); // 使用transferable objects提高性能
          } catch (postError) {
            clearTimeout(timeout);
            if (workerRef.current) {
              workerRef.current.removeEventListener("message", messageHandler);
              workerRef.current.removeEventListener("error", errorHandler);
            }
            reject(`Failed to send data to worker: ${postError.message}`);
          }

          // 清理画布 - 延迟到Promise完成后
          const cleanUp = () => {
            canvas.remove();
          };

          // 确保无论成功或失败都会调用清理函数
          Promise.resolve().finally(cleanUp);
        } catch (error) {
          reject(`Error capturing frame: ${error.message}`);
        }
      });
    },
    [isModelLoaded]
  );

  return {
    status,
    error,
    isModelLoaded,
    isTfInitialized,
    loadModel,
    processFrame,
  };
};

export default useSegmentationWorker;
