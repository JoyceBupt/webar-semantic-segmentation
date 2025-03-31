/**
 * 交互管理模块
 * 处理用户与3D模型的交互
 */
class InteractionManager {
  constructor() {
    this.sceneManager = null;
    this.canvas = null;

    // 交互控制相关属性
    this.isDragging = false;
    this.previousTouch = null;
    this.previousMouse = null;
    this.pinchStartDistance = 0;
    this.isEnabled = false;
    this.userInteracted = false;
  }

  /**
   * 设置场景管理器引用
   * @param {SceneManager} sceneManager 场景管理器实例
   */
  setSceneManager(sceneManager) {
    this.sceneManager = sceneManager;
  }

  /**
   * 初始化模块
   * @param {HTMLCanvasElement} canvas 画布元素
   */
  init(canvas) {
    this.canvas = canvas;
  }

  /**
   * 启用交互控制
   */
  enable() {
    if (this.isEnabled || !this.canvas) return;

    this.isEnabled = true;

    // 监听触摸事件
    this.canvas.addEventListener("touchstart", this.handleTouchStart);
    this.canvas.addEventListener("touchmove", this.handleTouchMove);
    this.canvas.addEventListener("touchend", this.handleTouchEnd);

    // 监听鼠标事件
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("mouseup", this.handleMouseUp);
    this.canvas.addEventListener("wheel", this.handleMouseWheel);
  }

  /**
   * 禁用交互控制
   */
  disable() {
    if (!this.isEnabled || !this.canvas) return;

    this.isEnabled = false;

    // 移除触摸事件监听
    this.canvas.removeEventListener("touchstart", this.handleTouchStart);
    this.canvas.removeEventListener("touchmove", this.handleTouchMove);
    this.canvas.removeEventListener("touchend", this.handleTouchEnd);

    // 移除鼠标事件监听
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("mouseup", this.handleMouseUp);
    this.canvas.removeEventListener("wheel", this.handleMouseWheel);
  }

  /**
   * 处理触摸开始事件
   * @param {TouchEvent} event 触摸事件
   */
  handleTouchStart = (event) => {
    event.preventDefault();
    this.userInteracted = true;

    if (event.touches.length === 1) {
      // 单指触摸 - 用于旋转
      this.isDragging = true;
      this.previousTouch = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    } else if (event.touches.length === 2) {
      // 双指触摸 - 用于缩放
      this.pinchStartDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
    }
  };

  /**
   * 处理触摸移动事件
   * @param {TouchEvent} event 触摸事件
   */
  handleTouchMove = (event) => {
    event.preventDefault();

    const modelManager = this.sceneManager.getModule("model");
    if (!modelManager || !modelManager.model) return;

    if (event.touches.length === 1 && this.isDragging && this.previousTouch) {
      // 单指拖动 - 旋转
      const touch = event.touches[0];
      const deltaX = touch.clientX - this.previousTouch.x;

      // 应用旋转
      modelManager.model.rotation.y += deltaX * 0.01;
      modelManager.currentRotationY = modelManager.model.rotation.y;

      // 更新触摸位置
      this.previousTouch = {
        x: touch.clientX,
        y: touch.clientY,
      };
    } else if (event.touches.length === 2) {
      // 双指缩放
      const currentDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );

      if (this.pinchStartDistance > 0) {
        // 计算缩放比例
        const scaleFactor = currentDistance / this.pinchStartDistance;

        // 获取当前模型选项
        const modelOption = modelManager.getCurrentModelOption();
        const baseScale = modelOption.scale || modelManager.initialScale;

        // 应用有限缩放
        const minScale = baseScale * 0.5;
        const maxScale = baseScale * 2.0;
        const newScale = Math.max(
          minScale,
          Math.min(maxScale, baseScale * scaleFactor)
        );

        // 应用缩放
        modelManager.model.scale.set(newScale, newScale, newScale);
        modelManager.currentScale = newScale;
        modelManager.targetScale = newScale;
      }

      // 更新起始距离
      this.pinchStartDistance = currentDistance;
    }
  };

  /**
   * 处理触摸结束事件
   */
  handleTouchEnd = () => {
    this.isDragging = false;
    this.previousTouch = null;
    this.pinchStartDistance = 0;
  };

  /**
   * 处理鼠标按下事件
   * @param {MouseEvent} event 鼠标事件
   */
  handleMouseDown = (event) => {
    event.preventDefault();
    this.userInteracted = true;
    this.isDragging = true;
    this.previousMouse = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  /**
   * 处理鼠标移动事件
   * @param {MouseEvent} event 鼠标事件
   */
  handleMouseMove = (event) => {
    if (!this.isDragging || !this.previousMouse) return;

    const modelManager = this.sceneManager.getModule("model");
    if (!modelManager || !modelManager.model) return;

    const deltaX = event.clientX - this.previousMouse.x;

    // 应用旋转
    modelManager.model.rotation.y += deltaX * 0.01;
    modelManager.currentRotationY = modelManager.model.rotation.y;

    // 更新鼠标位置
    this.previousMouse = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  /**
   * 处理鼠标释放事件
   */
  handleMouseUp = () => {
    this.isDragging = false;
    this.previousMouse = null;
  };

  /**
   * 获取模型缩放范围
   * @param {string} modelName 模型名称
   * @returns {Object} 缩放范围对象
   */
  getModelScaleRange(modelName) {
    // 默认缩放范围
    const defaultRange = { min: 0.0025, max: 0.01 };

    // 根据模型名称返回不同的缩放范围
    if (modelName.includes("狐狸")) {
      return { min: 0.0025, max: 0.01 };
    } else if (modelName.includes("小鸟")) {
      return { min: 0.0001, max: 0.0004 };
    } else if (modelName.includes("小兔子")) {
      return { min: 0.005, max: 0.02 };
    } else if (modelName.includes("蒟蒻")) {
      return { min: 0.02, max: 0.08 };
    } else if (modelName.includes("小栗子")) {
      return { min: 0.0175, max: 0.07 };
    }

    return defaultRange;
  }

  /**
   * 处理鼠标滚轮事件
   * @param {WheelEvent} event 滚轮事件
   */
  handleMouseWheel = (event) => {
    event.preventDefault();
    this.userInteracted = true;

    const modelManager = this.sceneManager.getModule("model");
    if (!modelManager || !modelManager.model) return;

    // 获取当前模型选项
    const modelOption = modelManager.getCurrentModelOption();
    const baseScale = modelOption.scale || modelManager.initialScale;

    // 根据滚轮方向调整缩放
    const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;

    // 应用有限缩放
    const minScale = baseScale * 0.5;
    const maxScale = baseScale * 2.0;
    const newScale = Math.max(
      minScale,
      Math.min(maxScale, modelManager.currentScale * scaleFactor)
    );

    // 应用缩放
    modelManager.model.scale.set(newScale, newScale, newScale);
    modelManager.currentScale = newScale;
    modelManager.targetScale = newScale;
  };

  /**
   * 更新模块
   */
  update() {
    // 交互管理模块不需要每帧更新
  }

  /**
   * 清理资源
   */
  dispose() {
    this.disable();
    this.canvas = null;
  }
}

export default InteractionManager;
