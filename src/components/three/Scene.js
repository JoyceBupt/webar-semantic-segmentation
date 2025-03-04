import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

class ThreeScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.model = null;
    this.isDisposed = false;
    this.animationFrameId = null;
    this.isInitialized = false;
    this.mixer = null;
    this.clock = new THREE.Clock();
    this.animations = [];

    // 交互控制相关属性
    this.isDragging = false;
    this.previousTouch = null;
    this.initialScale = 0.005;
    this.currentScale = this.initialScale;
    this.initialRotationY = Math.PI / 4;
    this.currentRotationY = this.initialRotationY;
    this.pinchStartDistance = 0;
    this.isInteractionEnabled = false;

    // 添加模型位置相关属性，用于平滑过渡
    this.targetPosition = { x: 0, y: 0 };
    this.currentPosition = { x: 0, y: 0 };
    this.targetScale = this.initialScale;
    this.positionLerpFactor = 0.3; // 增加位置插值因子，使跟踪更迅速
    this.scaleLerpFactor = 0.2; // 增加缩放插值因子
  }

  init() {
    if (!this.canvas || this.isInitialized) return;

    try {
      // 创建场景
      this.scene = new THREE.Scene();

      // 获取容器尺寸
      const container = this.canvas.parentElement;
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

      // 创建渲染器
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      this.renderer.setSize(width, height);
      this.renderer.setClearColor(0x000000, 0);

      // 添加光源
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(0, 0, 5);
      this.scene.add(directionalLight);

      const ambientLight = new THREE.AmbientLight(0x404040);
      this.scene.add(ambientLight);

      // 加载GLTF模型
      this.loadModel();

      // 监听窗口大小变化
      window.addEventListener("resize", this.handleResize);

      this.isInitialized = true;
      this.animate();
    } catch (error) {
      console.error("Three.js 场景初始化失败:", error);
      this.dispose();
    }
  }

  loadModel() {
    const loader = new GLTFLoader();

    loader.load(
      "/Fox/glTF/Fox.gltf",
      (gltf) => {
        this.model = gltf.scene;

        // 调整模型大小和位置
        this.model.scale.set(0.005, 0.005, 0.005);
        this.model.position.set(0, -0.5, 0);
        this.model.rotation.y = Math.PI / 4;

        // 初始化当前位置和缩放
        this.currentPosition.x = this.model.position.x;
        this.currentPosition.y = this.model.position.y;
        this.currentScale = 0.005;
        this.targetPosition.x = this.currentPosition.x;
        this.targetPosition.y = this.currentPosition.y;
        this.targetScale = this.currentScale;

        this.scene.add(this.model);

        // 设置动画
        if (gltf.animations && gltf.animations.length) {
          this.mixer = new THREE.AnimationMixer(this.model);
          this.animations = gltf.animations;

          // 播放第一个动画
          const action = this.mixer.clipAction(this.animations[0]);
          action.play();
        }
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% 已加载");
      },
      (error) => {
        console.error("加载模型时出错:", error);
      }
    );
  }

  handleResize = () => {
    if (!this.canvas || !this.camera || !this.renderer) return;

    const container = this.canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;

    // 更新相机视口
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();

    // 更新渲染器尺寸
    this.renderer.setSize(width, height);

    // 强制渲染更新
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  updateSize(width, height) {
    if (!this.canvas || !this.camera || !this.renderer) return;

    const aspect = width / height;

    // 更新相机视口
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();

    // 更新渲染器尺寸
    this.renderer.setSize(width, height);

    // 强制渲染更新
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  animate = () => {
    if (this.isDisposed || !this.isInitialized) return;

    // 更新动画混合器
    if (this.mixer) {
      const delta = this.clock.getDelta();
      this.mixer.update(delta);
    }

    // 平滑过渡到目标位置和缩放
    if (this.model) {
      // 计算自上一帧以来的时间增量，用于帧率独立的平滑插值
      const deltaTime = Math.min(0.1, this.clock.getDelta());
      const smoothFactor = 1.0 - Math.pow(0.001, deltaTime);

      // 使用帧率独立的平滑因子
      const positionFactor = Math.min(
        1.0,
        this.positionLerpFactor * (1 + smoothFactor * 10)
      );
      const scaleFactor = Math.min(
        1.0,
        this.scaleLerpFactor * (1 + smoothFactor * 5)
      );

      // 位置平滑插值
      this.currentPosition.x +=
        (this.targetPosition.x - this.currentPosition.x) * positionFactor;
      this.currentPosition.y +=
        (this.targetPosition.y - this.currentPosition.y) * positionFactor;

      // 缩放平滑插值
      this.currentScale += (this.targetScale - this.currentScale) * scaleFactor;

      // 应用插值后的位置和缩放
      this.model.position.x = this.currentPosition.x;
      this.model.position.y = this.currentPosition.y;
      this.model.scale.set(
        this.currentScale,
        this.currentScale,
        this.currentScale
      );
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  updateModelPosition(x, y, scale) {
    if (!this.model || this.isDisposed || !this.isInitialized) return;

    // 更新目标位置和缩放，而不是直接设置
    this.targetPosition.x = x;
    // 调整Y轴偏移，使模型更好地对齐人物
    this.targetPosition.y = y - 0.2; // 减小Y轴偏移量，使模型更接近人物顶部
    // 缩放因子微调
    this.targetScale = scale * 0.006; // 略微增加缩放比例，让模型更贴合人物

    // 当检测到大幅度位置变化时，直接更新当前位置，避免跟踪滞后
    const positionDeltaX = Math.abs(
      this.targetPosition.x - this.currentPosition.x
    );
    const positionDeltaY = Math.abs(
      this.targetPosition.y - this.currentPosition.y
    );

    // 如果位置变化超过阈值，直接更新当前位置以避免滞后
    if (positionDeltaX > 0.3 || positionDeltaY > 0.3) {
      this.currentPosition.x = this.targetPosition.x;
      this.currentPosition.y = this.targetPosition.y;
    }
  }

  // 启用交互控制
  enableInteraction() {
    if (
      !this.canvas ||
      this.isDisposed ||
      !this.isInitialized ||
      this.isInteractionEnabled
    )
      return;

    this.isInteractionEnabled = true;

    // 添加触摸事件监听器
    this.canvas.addEventListener("touchstart", this.handleTouchStart);
    this.canvas.addEventListener("touchmove", this.handleTouchMove);
    this.canvas.addEventListener("touchend", this.handleTouchEnd);

    // 修改canvas样式，使其可以接收事件
    this.canvas.style.pointerEvents = "auto";

    console.log("模型交互控制已启用");
  }

  // 禁用交互控制
  disableInteraction() {
    if (!this.canvas || !this.isInteractionEnabled) return;

    this.isInteractionEnabled = false;

    // 移除触摸事件监听器
    this.canvas.removeEventListener("touchstart", this.handleTouchStart);
    this.canvas.removeEventListener("touchmove", this.handleTouchMove);
    this.canvas.removeEventListener("touchend", this.handleTouchEnd);

    // 恢复canvas样式
    this.canvas.style.pointerEvents = "none";

    console.log("模型交互控制已禁用");
  }

  // 处理触摸开始事件
  handleTouchStart = (event) => {
    event.preventDefault();

    if (!this.model) return;

    if (event.touches.length === 1) {
      // 单指触摸 - 准备旋转
      this.isDragging = true;
      this.previousTouch = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    } else if (event.touches.length === 2) {
      // 双指触摸 - 准备缩放
      this.isDragging = false;
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this.pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
      // 存储缩放操作开始时的当前缩放值
      this.pinchStartScale = this.currentScale;
    }
  };

  // 处理触摸移动事件
  handleTouchMove = (event) => {
    event.preventDefault();

    if (!this.model) return;

    if (this.isDragging && event.touches.length === 1) {
      // 单指移动 - 旋转模型
      const touch = event.touches[0];
      const deltaX = touch.clientX - this.previousTouch.x;

      // 根据水平移动旋转模型
      this.currentRotationY += deltaX * 0.01;
      this.model.rotation.y = this.currentRotationY;

      this.previousTouch = {
        x: touch.clientX,
        y: touch.clientY,
      };
    } else if (event.touches.length === 2) {
      // 双指移动 - 缩放模型
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 计算相对于初始双指距离的缩放比例
      const scaleFactor = distance / this.pinchStartDistance;

      // 基于初始缩放值计算新的缩放值
      const newScale = this.pinchStartScale * scaleFactor;

      // 限制缩放范围
      const limitedScale = Math.max(0.001, Math.min(0.02, newScale));

      // 更新目标缩放
      this.targetScale = limitedScale;
    }
  };

  // 处理触摸结束事件
  handleTouchEnd = () => {
    this.isDragging = false;
    this.previousTouch = null;
  };

  // 重置模型位置和旋转
  resetModelTransform() {
    if (!this.model) return;

    // 设置目标值，而不是直接修改
    this.targetScale = this.initialScale;
    this.currentRotationY = this.initialRotationY;
    this.targetPosition.x = 0;
    this.targetPosition.y = -0.4; // 调整为与新的Y轴偏移一致

    // 直接重置当前位置，确保立即响应
    this.currentPosition.x = this.targetPosition.x;
    this.currentPosition.y = this.targetPosition.y;
    this.currentScale = this.targetScale;

    // 直接设置旋转，因为旋转没有使用平滑插值
    this.model.rotation.y = this.currentRotationY;

    // 立即更新模型位置和缩放
    this.model.position.x = this.currentPosition.x;
    this.model.position.y = this.currentPosition.y;
    this.model.scale.set(
      this.currentScale,
      this.currentScale,
      this.currentScale
    );
  }

  // 停止渲染
  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // 恢复渲染
  resume() {
    if (!this.isDisposed && !this.animationFrameId && this.isInitialized) {
      this.animate();
    }
  }

  // 清理资源
  dispose() {
    this.isDisposed = true;
    this.stop();

    // 移除窗口大小变化监听
    window.removeEventListener("resize", this.handleResize);

    // 移除交互事件监听
    if (this.canvas && this.isInteractionEnabled) {
      this.canvas.removeEventListener("touchstart", this.handleTouchStart);
      this.canvas.removeEventListener("touchmove", this.handleTouchMove);
      this.canvas.removeEventListener("touchend", this.handleTouchEnd);
    }

    if (this.model) {
      this.scene.remove(this.model);
      this.model = null;
    }

    if (this.mixer) {
      this.mixer = null;
    }

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

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement = null;
      this.renderer = null;
    }

    this.camera = null;
    this.canvas = null;
    this.isInitialized = false;
  }
}

export default ThreeScene;
