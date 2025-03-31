import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * 模型管理模块
 * 负责模型的加载、切换和管理
 */
class ModelManager {
  constructor() {
    this.sceneManager = null;
    this.model = null;
    this.mixer = null;
    this.animations = [];
    this.currentModelIndex = 0;

    // 模型位置相关属性
    this.initialScale = 0.005;
    this.currentScale = this.initialScale;
    this.initialRotationY = Math.PI / 4;
    this.currentRotationY = this.initialRotationY;

    // 位置平滑过渡
    this.targetPosition = { x: 0, y: 0 };
    this.currentPosition = { x: 0, y: 0 };
    this.targetScale = this.initialScale;
    this.positionLerpFactor = 0.3;
    this.scaleLerpFactor = 0.2;

    // 添加垂直位置全局偏移量，使模型更靠上
    this.verticalOffset = 0; // 将全局偏移量修改为0，回到质心位置

    // 可选模型列表 - 调整所有yOffset值使模型显示在适当位置
    this.modelOptions = [
      {
        name: "狐狸(散步)",
        path: "/Fox.glb",
        scale: 0.005,
        yOffset: -0.3, // 调整为-0.3，适中的偏移量
        rotation: Math.PI / 4,
        defaultAnimation: 0,
        particleEffect: {
          color: [0.7, 0.3, 0.1], // 橙色粒子
          count: 200,
          size: 0.03,
          opacity: 0.7,
        },
      },
      {
        name: "狐狸(奔跑)",
        path: "/Fox.glb",
        scale: 0.005,
        yOffset: -0.3, // 调整为-0.3，适中的偏移量
        rotation: Math.PI / 4,
        defaultAnimation: 1,
        particleEffect: {
          color: [0.1, 0.5, 0.9], // 蓝色粒子
          count: 300,
          size: 0.02,
          opacity: 0.8,
        },
      },
      {
        name: "狐狸(跳跃)",
        path: "/Fox.glb",
        scale: 0.005,
        yOffset: -0.3, // 调整为-0.3，适中的偏移量
        rotation: Math.PI / 4,
        defaultAnimation: 2,
        particleEffect: {
          color: [0.2, 0.8, 0.2], // 绿色粒子
          count: 250,
          size: 0.025,
          opacity: 0.6,
        },
      },
      {
        name: "小鸟",
        path: "/Bird.glb",
        scale: 0.0002,
        yOffset: -0.2, // 调整为-0.2，适中的偏移量
        rotation: Math.PI / 2,
        defaultAnimation: 0,
        particleEffect: {
          color: [0.1, 0.3, 0.9], // 蓝色粒子
          count: 180,
          size: 0.02,
          opacity: 0.65,
        },
      },
      {
        name: "小兔子",
        path: "/bunny.glb",
        scale: 0.01,
        yOffset: -0.2, // 调整为-0.2，适中的偏移量
        rotation: Math.PI / 2,
        defaultAnimation: 0,
        particleEffect: {
          color: [0.9, 0.5, 0.7], // 粉色粒子
          count: 200,
          size: 0.02,
          opacity: 0.7,
        },
      },
      {
        name: "蒟蒻",
        path: "/konnyaku.glb",
        scale: 0.04,
        yOffset: -0.3, // 调整为-0.3，适中的偏移量
        rotation: Math.PI / 4,
        defaultAnimation: 0,
        particleEffect: {
          color: [0.6, 0.2, 0.8], // 紫色粒子
          count: 220,
          size: 0.025,
          opacity: 0.6,
        },
      },
      {
        name: "小栗子",
        path: "/little_chestnut.glb",
        scale: 0.035,
        yOffset: -0.25, // 调整为-0.25，适中的偏移量
        rotation: Math.PI / 3,
        defaultAnimation: 0,
        particleEffect: {
          color: [0.8, 0.4, 0.1], // 棕色粒子
          count: 190,
          size: 0.022,
          opacity: 0.65,
        },
      },
    ];
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
   */
  init() {
    // 加载默认模型
    this.loadModel();
  }

  /**
   * 加载3D模型
   * @param {number} modelIndex 模型索引
   */
  loadModel(modelIndex = 0) {
    // 清理之前的模型
    this.clearCurrentModel();

    // 获取选中的模型选项
    const modelOption = this.modelOptions[modelIndex] || this.modelOptions[0];
    this.currentModelIndex = modelIndex;

    // 加载GLB模型
    const loader = new GLTFLoader();
    loader.load(
      modelOption.path,
      (gltf) => {
        // 保存模型引用
        this.model = gltf.scene;

        // 应用模型选项中的缩放
        const modelScale = modelOption.scale || this.initialScale;
        this.model.scale.set(modelScale, modelScale, modelScale);
        this.currentScale = modelScale;
        this.targetScale = modelScale;

        // 应用Y轴偏移
        if (modelOption.yOffset) {
          this.model.position.y = modelOption.yOffset;
        }

        // 应用模型特定的旋转设置
        const modelRotation =
          modelOption.rotation !== undefined
            ? modelOption.rotation
            : this.initialRotationY;
        this.currentRotationY = modelRotation;
        this.model.rotation.y = this.currentRotationY;

        // 将模型添加到场景
        this.sceneManager.scene.add(this.model);

        // 处理动画
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.model);
          this.animations = gltf.animations;

          // 播放默认动画
          const defaultAnimIndex = modelOption.defaultAnimation || 0;
          if (defaultAnimIndex < this.animations.length) {
            const action = this.mixer.clipAction(
              this.animations[defaultAnimIndex]
            );
            action.play();
          }
        }

        // 创建粒子效果
        const particleSystem = this.sceneManager.getModule("particles");
        if (particleSystem) {
          particleSystem.createParticleEffect(modelOption.particleEffect);
        }
      },
      undefined,
      (error) => {
        console.error("模型加载失败:", error);
      }
    );
  }

  /**
   * 清理当前模型
   */
  clearCurrentModel() {
    if (this.model) {
      this.sceneManager.scene.remove(this.model);
      this.model = null;
    }

    if (this.mixer) {
      this.mixer = null;
    }

    this.animations = [];
  }

  /**
   * 更新模型位置
   * @param {number} x X坐标 (-1到1)
   * @param {number} y Y坐标 (-1到1)
   * @param {number} scale 缩放比例
   */
  updateModelPosition(x, y, scale) {
    if (!this.model) return;

    // 更新目标位置，添加垂直偏移使模型更靠上
    this.targetPosition.x = x;
    this.targetPosition.y = y + this.verticalOffset; // 添加垂直偏移

    // 更新目标缩放
    const modelOption = this.modelOptions[this.currentModelIndex];
    const baseScale = modelOption.scale || this.initialScale;
    this.targetScale = baseScale * scale;
  }

  /**
   * 重置模型变换
   */
  resetModelTransform() {
    if (!this.model) return;

    const modelOption = this.modelOptions[this.currentModelIndex];

    // 重置位置
    this.targetPosition.x = 0;
    this.targetPosition.y = 0;
    this.currentPosition.x = 0;
    this.currentPosition.y = 0;
    this.model.position.x = 0;

    // 重置Y轴偏移
    if (modelOption.yOffset !== undefined) {
      this.model.position.y = modelOption.yOffset;
    } else {
      this.model.position.y = 0;
    }

    // 重置缩放
    const modelScale = modelOption.scale || this.initialScale;
    this.currentScale = modelScale;
    this.targetScale = modelScale;
    this.model.scale.set(modelScale, modelScale, modelScale);

    // 重置旋转
    const modelRotation =
      modelOption.rotation !== undefined
        ? modelOption.rotation
        : this.initialRotationY;
    this.currentRotationY = modelRotation;
    this.model.rotation.y = this.currentRotationY;
  }

  /**
   * 切换到下一个模型
   */
  nextModel() {
    const nextIndex = (this.currentModelIndex + 1) % this.modelOptions.length;
    this.loadModel(nextIndex);
  }

  /**
   * 切换到特定模型
   * @param {number} index 模型索引
   */
  switchToModel(index) {
    if (index >= 0 && index < this.modelOptions.length) {
      this.loadModel(index);
    }
  }

  /**
   * 播放指定动画
   * @param {number} index 动画索引
   */
  playAnimation(index) {
    if (!this.mixer || !this.animations || index >= this.animations.length)
      return;

    // 停止所有当前动画
    this.mixer.stopAllAction();

    // 播放选中的动画
    const action = this.mixer.clipAction(this.animations[index]);
    action.play();
  }

  /**
   * 获取当前模型选项
   * @returns {Object} 当前模型选项
   */
  getCurrentModelOption() {
    return this.modelOptions[this.currentModelIndex];
  }

  /**
   * 更新模块
   * @param {number} delta 时间增量
   */
  update(delta) {
    // 更新动画混合器
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // 更新模型位置 - 平滑过渡
    if (this.model) {
      // 位置插值
      this.currentPosition.x +=
        (this.targetPosition.x - this.currentPosition.x) *
        this.positionLerpFactor;
      this.currentPosition.y +=
        (this.targetPosition.y - this.currentPosition.y) *
        this.positionLerpFactor;

      // 应用位置
      this.model.position.x = this.currentPosition.x;
      if (this.modelOptions[this.currentModelIndex].yOffset !== undefined) {
        this.model.position.y =
          this.modelOptions[this.currentModelIndex].yOffset +
          this.currentPosition.y;
      } else {
        this.model.position.y = this.currentPosition.y;
      }

      // 缩放插值
      this.currentScale +=
        (this.targetScale - this.currentScale) * this.scaleLerpFactor;

      // 应用缩放
      this.model.scale.set(
        this.currentScale,
        this.currentScale,
        this.currentScale
      );
    }
  }

  /**
   * 清理资源
   */
  dispose() {
    this.clearCurrentModel();
  }
}

export default ModelManager;
