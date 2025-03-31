import * as THREE from "three";

/**
 * 渲染器管理模块
 * 负责创建和管理Three.js渲染器
 */
class RendererManager {
  constructor() {
    this.renderer = null;
    this.canvas = null;
    this.sceneManager = null;
  }

  /**
   * 设置场景管理器引用
   * @param {SceneManager} sceneManager 场景管理器实例
   */
  setSceneManager(sceneManager) {
    this.sceneManager = sceneManager;
  }

  /**
   * 初始化渲染器
   * @param {HTMLCanvasElement} canvas 画布元素
   */
  init(canvas) {
    this.canvas = canvas;

    // 创建WebGL渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });

    // 获取容器尺寸
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 设置渲染器尺寸和像素比
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制像素比，提高性能
    this.renderer.setClearColor(0x000000, 0); // 透明背景
  }

  /**
   * 更新渲染器尺寸
   * @param {number} width 宽度
   * @param {number} height 高度
   */
  updateSize(width, height) {
    if (!this.renderer) return;

    this.renderer.setSize(width, height);
  }

  /**
   * 获取渲染器实例
   * @returns {THREE.WebGLRenderer} 渲染器实例
   */
  getRenderer() {
    return this.renderer;
  }

  /**
   * 手动渲染场景
   */
  render() {
    if (!this.renderer || !this.sceneManager) return;

    const camera = this.sceneManager.getModule("camera");
    if (camera && camera.camera) {
      this.renderer.render(this.sceneManager.scene, camera.camera);
    }
  }

  /**
   * 清理资源
   */
  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement = null;
      this.renderer = null;
    }
    this.canvas = null;
  }
}

export default RendererManager;
