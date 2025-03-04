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

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  updateModelPosition(x, y, scale) {
    if (!this.model || this.isDisposed || !this.isInitialized) return;

    this.model.position.x = x;
    this.model.position.y = y - 0.3; // 稍微下移模型以便更好地显示
    this.model.scale.set(scale * 0.005, scale * 0.005, scale * 0.005);

    // 保存当前缩放值
    this.currentScale = scale * 0.005;

    // 强制渲染更新
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
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

      // 强制渲染更新
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    } else if (event.touches.length === 2) {
      // 双指移动 - 缩放模型
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 计算缩放比例
      const scale = distance / this.pinchStartDistance;
      const newScale = this.currentScale * scale;

      // 限制缩放范围
      const limitedScale = Math.max(0.001, Math.min(0.02, newScale));

      // 应用缩放
      this.model.scale.set(limitedScale, limitedScale, limitedScale);

      // 更新起始距离
      this.pinchStartDistance = distance;
      this.currentScale = limitedScale;

      // 强制渲染更新
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
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

    this.currentScale = this.initialScale;
    this.currentRotationY = this.initialRotationY;

    this.model.scale.set(
      this.currentScale,
      this.currentScale,
      this.currentScale
    );
    this.model.rotation.y = this.currentRotationY;

    // 强制渲染更新
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
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
