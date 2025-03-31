import * as THREE from "three";

/**
 * 相机管理模块
 * 负责创建和管理场景相机
 */
class CameraManager {
  constructor() {
    this.camera = null;
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
   * 初始化相机
   * @param {HTMLCanvasElement} canvas 画布元素
   */
  init(canvas) {
    // 获取容器尺寸
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;

    // 创建正交相机，根据容器尺寸调整视口
    this.camera = new THREE.OrthographicCamera(
      -aspect, // left
      aspect, // right
      1, // top
      -1, // bottom
      0.1, // near
      1000 // far
    );
    this.camera.position.z = 5;
  }

  /**
   * 更新相机尺寸
   * @param {number} width 宽度
   * @param {number} height 高度
   */
  updateSize(width, height) {
    if (!this.camera) return;

    const aspect = width / height;

    // 更新相机视口
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
  }

  /**
   * 获取相机实例
   * @returns {THREE.Camera} 相机实例
   */
  getCamera() {
    return this.camera;
  }

  /**
   * 清理资源
   */
  dispose() {
    this.camera = null;
  }
}

export default CameraManager;
