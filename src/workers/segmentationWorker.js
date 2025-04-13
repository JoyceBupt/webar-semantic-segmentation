// 使用纯ES模块导入TensorFlow.js
import * as tf from "@tensorflow/tfjs";

// 初始化状态
let model = null;
let modelConfig = {
  inputShape: [256, 256], // 默认输入尺寸
  inputFormat: "NCHW", // 默认输入格式 (NCHW 或 NHWC)
};

// 初始化TensorFlow
const initialize = async () => {
  try {
    // 设置生产模式和后端
    tf.enableProdMode();
    await tf.setBackend("webgl");

    self.postMessage({
      type: "STATUS",
      status: "TF_INITIALIZED",
      backend: tf.getBackend(),
    });
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      error: "Failed to initialize TensorFlow: " + error.message,
    });
  }
};
initialize();

// 处理来自主线程的消息
self.onmessage = async function (e) {
  const { type, data } = e.data;

  switch (type) {
    case "LOAD_MODEL":
      await loadModel(data.modelUrl, data.modelConfig);
      break;

    case "PROCESS_FRAME":
      if (!model) {
        self.postMessage({ type: "ERROR", error: "Model not loaded" });
        return;
      }
      try {
        const result = await processFrame(
          data.imageData,
          data.width,
          data.height
        );
        // 不再传递transferable objects，因为序列化后的数据可能不支持
        self.postMessage({
          type: "SEGMENTATION_RESULT",
          segmentation: result,
        });
      } catch (error) {
        self.postMessage({
          type: "ERROR",
          error: error.message,
        });
      }
      break;
  }
};

// 加载模型
async function loadModel(modelUrl, config = {}) {
  try {
    if (!modelUrl) {
      throw new Error("modelUrl cannot be null");
    }

    self.postMessage({ type: "STATUS", status: "LOADING_MODEL" });

    // 更新模型配置
    modelConfig = {
      ...modelConfig,
      ...config,
    };

    // 确保TensorFlow已准备好
    await tf.ready();

    // 加载模型
    model = await tf.loadGraphModel(modelUrl);

    // 预热模型 - 使用正确的尺寸
    const [height, width] = modelConfig.inputShape;

    try {
      const dummyInput = tf.zeros([1, 3, height, width]);
      const warmupResult = model.execute({ x: dummyInput });
      tf.dispose([dummyInput, warmupResult]);

      self.postMessage({ type: "STATUS", status: "MODEL_LOADED" });
    } catch (error) {
      throw new Error(`Model warmup failed: ${error.message}`);
    }
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      error: `Failed to load model: ${error.message}`,
    });
  }
}

// 处理图像帧
async function processFrame(imageData, width, height) {
  try {
    // 使用OffscreenCanvas处理图像
    const offscreenCanvas = new OffscreenCanvas(width, height);
    const ctx = offscreenCanvas.getContext("2d");

    // 创建imageData对象
    const imgData = new ImageData(
      new Uint8ClampedArray(imageData),
      width,
      height
    );

    // 将图像数据绘制到画布
    ctx.putImageData(imgData, 0, 0);

    // 从模型配置获取正确的尺寸
    const [targetHeight, targetWidth] = modelConfig.inputShape;

    // 调整大小到模型输入尺寸
    const tempCanvas = new OffscreenCanvas(targetWidth, targetHeight);
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(
      offscreenCanvas,
      0,
      0,
      width,
      height,
      0,
      0,
      targetWidth,
      targetHeight
    );

    // 创建输入张量
    const tensor = tf.browser.fromPixels(tempCanvas);
    const normalized = tensor
      .toFloat()
      .div(tf.scalar(127.5))
      .sub(tf.scalar(1.0));

    // 根据模型配置选择正确的格式
    let formattedInput;
    if (modelConfig.inputFormat === "NCHW") {
      formattedInput = normalized.expandDims(0).transpose([0, 3, 1, 2]);
    } else {
      formattedInput = normalized.expandDims(0); // NHWC 格式
    }

    // 执行推理
    const result = model.execute({ x: formattedInput });

    // 处理分割结果
    let segmentationTensor;
    if (result.shape.length === 4) {
      // 如果结果是类别概率 [1, numClasses, H, W]，需要argmax
      segmentationTensor = tf.argMax(result, 1);
    } else {
      segmentationTensor = result;
    }

    // 获取分割数据 - 使用更简单的数据格式
    // 直接使用 uint8array 或简单数组，避免复杂对象序列化问题
    let segmentationData;
    try {
      // 对于简单模型，使用dataSync更快且避免嵌套数组问题
      segmentationData = segmentationTensor.dataSync();
      // 转换为普通数组以确保可序列化
      segmentationData = Array.from(segmentationData);
    } catch (error) {
      // 如果dataSync不可用，回退到arraySync
      console.log("dataSync failed, using arraySync instead", error);
      const arrayData = await segmentationTensor.arraySync();
      segmentationData = convertToSerializableData(arrayData[0]);
    }

    // 清理资源
    tf.dispose([
      tensor,
      normalized,
      formattedInput,
      result,
      segmentationTensor,
    ]);

    // 返回分割结果 - 确保包含所有必要信息且为可序列化格式
    return {
      width: targetWidth,
      height: targetHeight,
      data: segmentationData,
      shape:
        segmentationData.length === targetWidth * targetHeight
          ? "flat"
          : "nested", // 帮助接收端确定数据格式
    };
  } catch (error) {
    throw new Error(`Processing error: ${error.message}`);
  }
}

// 将可能的嵌套TypedArray或复杂对象转换为普通JavaScript数组
function convertToSerializableData(data) {
  // 如果是基本类型，直接返回
  if (typeof data !== "object" || data === null) {
    return data;
  }

  // 如果是数组，递归处理每个元素
  if (Array.isArray(data)) {
    return data.map((item) => convertToSerializableData(item));
  }

  // 如果是TypedArray，转换为普通数组
  if (ArrayBuffer.isView(data)) {
    return Array.from(data);
  }

  // 如果是对象，递归处理每个属性
  const result = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      result[key] = convertToSerializableData(data[key]);
    }
  }
  return result;
}
