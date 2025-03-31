import * as THREE from "three";

/**
 * 核心场景管理器
 * 负责创建和管理Three.js场景，协调其他模块
 */
class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.isDisposed = false;
    this.animationFrameId = null;
    this.isInitialized = false;
    this.clock = new THREE.Clock();
    this.modules = new Map();
  }

  /**
   * 注册模块
   * @param {string} name 模块名称
   * @param {object} module 模块实例
   */
  registerModule(name, module) {
    this.modules.set(name, module);
    if (module.setSceneManager) {
      module.setSceneManager(this);
    }
    return this;
  }

  /**
   * 获取模块
   * @param {string} name 模块名称
   */
  getModule(name) {
    return this.modules.get(name);
  }

  /**
   * 初始化场景和所有模块
   * @param {HTMLCanvasElement} canvas 画布元素
   */
  init(canvas) {
    if (this.isInitialized) return;

    try {
      this.canvas = canvas;

      // 初始化所有模块
      for (const module of this.modules.values()) {
        if (module.init) {
          module.init(canvas);
        }
      }

      // 添加基础光源
      this.setupLights();

      this.isInitialized = true;
      this.animate();
    } catch (error) {
      console.error("Three.js 场景初始化失败:", error);
      this.dispose();
    }
  }

  /**
   * 设置场景光源
   */
  setupLights() {
    // 添加方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 0, 5);
    this.scene.add(directionalLight);

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);
  }

  /**
   * 动画循环
   */
  animate = () => {
    if (this.isDisposed) return;

    this.animationFrameId = requestAnimationFrame(this.animate);

    // 更新时钟
    const delta = this.clock.getDelta();

    // 通知所有模块更新
    for (const module of this.modules.values()) {
      if (module.update) {
        module.update(delta);
      }
    }

    // 渲染场景
    const renderer = this.getModule("renderer");
    const camera = this.getModule("camera");
    if (renderer && camera && renderer.renderer && camera.camera) {
      renderer.renderer.render(this.scene, camera.camera);
    }
  };

  /**
   * 调整场景大小
   * @param {number} width 宽度
   * @param {number} height 高度
   */
  updateSize(width, height) {
    // 通知所有模块更新尺寸
    for (const module of this.modules.values()) {
      if (module.updateSize) {
        module.updateSize(width, height);
      }
    }
  }

  /**
   * 停止渲染
   */
  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 恢复渲染
   */
  resume() {
    if (!this.animationFrameId && !this.isDisposed) {
      this.animate();
    }
  }

  /**
   * 清理资源
   */
  dispose() {
    this.isDisposed = true;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 清理所有模块
    for (const module of this.modules.values()) {
      if (module.dispose) {
        module.dispose();
      }
    }

    // 清理场景对象
    if (this.scene) {
      this.scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      this.scene = null;
    }

    this.isInitialized = false;
    this.canvas = null;
  }
}

export default SceneManager;
