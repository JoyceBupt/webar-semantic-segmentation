import SceneManager from "./core/SceneManager";
import CameraManager from "./core/CameraManager";
import RendererManager from "./core/RendererManager";
import ModelManager from "./core/ModelManager";
import ParticleSystem from "./core/ParticleSystem";
import InteractionManager from "./core/InteractionManager";

/**
 * ThreeScene 类
 * 使用模块化架构整合所有Three.js功能
 */
class ThreeScene {
  constructor(canvas) {
    // 创建场景管理器
    this.sceneManager = new SceneManager();

    // 创建所有模块
    this.cameraManager = new CameraManager();
    this.rendererManager = new RendererManager();
    this.modelManager = new ModelManager();
    this.particleSystem = new ParticleSystem();
    this.interactionManager = new InteractionManager();

    // 注册所有模块
    this.sceneManager
      .registerModule("camera", this.cameraManager)
      .registerModule("renderer", this.rendererManager)
      .registerModule("model", this.modelManager)
      .registerModule("particles", this.particleSystem)
      .registerModule("interaction", this.interactionManager);

    // 保存画布引用
    this.canvas = canvas;
    this.isInitialized = false;
    this.isDisposed = false;
  }

  /**
   * 初始化场景和所有模块
   */
  init() {
    if (!this.canvas || this.isInitialized) return;

    try {
      // 初始化场景管理器和所有模块
      this.sceneManager.init(this.canvas);
      this.isInitialized = true;
    } catch (error) {
      console.error("Three.js 场景初始化失败:", error);
      this.dispose();
    }
  }

  /**
   * 更新场景尺寸
   * @param {number} width 宽度
   * @param {number} height 高度
   */
  updateSize(width, height) {
    if (!this.isInitialized) return;
    this.sceneManager.updateSize(width, height);
  }

  /**
   * 更新模型位置
   * @param {number} x X坐标 (-1到1)
   * @param {number} y Y坐标 (-1到1)
   * @param {number} scale 缩放比例
   */
  updateModelPosition(x, y, scale) {
    if (!this.isInitialized) return;
    const modelManager = this.sceneManager.getModule("model");
    if (modelManager) {
      modelManager.updateModelPosition(x, y, scale);
    }
  }

  /**
   * 重置模型变换
   */
  resetModelTransform() {
    if (!this.isInitialized) return;
    const modelManager = this.sceneManager.getModule("model");
    if (modelManager) {
      modelManager.resetModelTransform();
    }
  }

  /**
   * 切换到特定模型
   * @param {number} index 模型索引
   */
  switchToModel(index) {
    if (!this.isInitialized) return;
    const modelManager = this.sceneManager.getModule("model");
    if (modelManager) {
      modelManager.switchToModel(index);
    }
  }

  /**
   * 播放特定动画
   * @param {number} index 动画索引
   */
  playAnimation(index) {
    if (!this.isInitialized) return;
    const modelManager = this.sceneManager.getModule("model");
    if (modelManager) {
      modelManager.playAnimation(index);
    }
  }

  /**
   * 切换粒子效果
   * @param {boolean} enabled 是否启用
   */
  toggleParticles(enabled) {
    if (!this.isInitialized) return;
    const particleSystem = this.sceneManager.getModule("particles");
    if (particleSystem) {
      particleSystem.toggleParticles(enabled);
    }
  }

  /**
   * 启用模型交互
   */
  enableInteraction() {
    if (!this.isInitialized) return;
    const interaction = this.sceneManager.getModule("interaction");
    if (interaction) {
      interaction.enable();
    }
  }

  /**
   * 禁用模型交互
   */
  disableInteraction() {
    if (!this.isInitialized) return;
    const interaction = this.sceneManager.getModule("interaction");
    if (interaction) {
      interaction.disable();
    }
  }

  /**
   * 停止渲染
   */
  stop() {
    if (!this.isInitialized) return;
    this.sceneManager.stop();
  }

  /**
   * 恢复渲染
   */
  resume() {
    if (!this.isInitialized) return;
    this.sceneManager.resume();
  }

  /**
   * 清理资源
   */
  dispose() {
    this.isDisposed = true;
    if (this.sceneManager) {
      this.sceneManager.dispose();
    }
    this.isInitialized = false;
    this.canvas = null;
  }

  /**
   * 获取可用模型选项
   * @returns {Array} 模型选项列表
   */
  get modelOptions() {
    const modelManager = this.sceneManager.getModule("model");
    return modelManager ? modelManager.modelOptions : [];
  }

  /**
   * 获取当前动画列表
   * @returns {Array} 动画列表
   */
  getAnimations() {
    const modelManager = this.sceneManager.getModule("model");
    return modelManager ? modelManager.animations : [];
  }
}

export default ThreeScene;
