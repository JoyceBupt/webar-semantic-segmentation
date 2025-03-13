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
    this.previousMouse = null; // 添加鼠标位置跟踪
    this.initialScale = 0.005;
    this.currentScale = this.initialScale;
    this.initialRotationY = Math.PI / 4;
    this.currentRotationY = this.initialRotationY;
    this.pinchStartDistance = 0;
    this.isInteractionEnabled = false;
    this.hasParticles = true; // 默认启用粒子效果
    this.userInteracted = false; // 添加用户交互标志

    // 添加模型位置相关属性，用于平滑过渡
    this.targetPosition = { x: 0, y: 0 };
    this.currentPosition = { x: 0, y: 0 };
    this.targetScale = this.initialScale;
    this.positionLerpFactor = 0.3; // 增加位置插值因子，使跟踪更迅速
    this.scaleLerpFactor = 0.2; // 增加缩放插值因子

    // 可选模型列表 - 更新为GLB格式并添加鸟模型
    this.modelOptions = [
      {
        name: "狐狸(散步)",
        path: "/Fox.glb",
        scale: 0.005,
        yOffset: -0.5,
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
        yOffset: -0.5,
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
        yOffset: -0.5,
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
        yOffset: -0.3,
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
        yOffset: -0.4,
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
        yOffset: -0.5,
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
        yOffset: -0.45,
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
    this.currentModelIndex = 0;

    // 粒子系统
    this.particles = null;
    this.particlesCount = 200;
    this.particlesMaterial = null;
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

  loadModel(modelIndex = 0) {
    // 清理之前的模型
    if (this.model) {
      this.scene.remove(this.model);
      this.model = null;
    }

    // 如果有动画混合器，也需要清理
    if (this.mixer) {
      this.mixer = null;
    }

    // 重置动画数组
    this.animations = [];

    // 重置用户交互标志
    this.userInteracted = false;

    // 获取选中的模型选项
    const modelOption = this.modelOptions[modelIndex] || this.modelOptions[0];
    this.currentModelIndex = modelIndex;

    // 加载GLB模型 - 处理动画
    const loader = new GLTFLoader();

    loader.load(
      modelOption.path,
      (gltf) => {
        // 保存模型引用
        this.model = gltf.scene;

        // 应用模型选项中的缩放 - 这里确保使用modelOption.scale而不是this.initialScale
        // 修改这里，确保缩放正确应用
        const modelScale = modelOption.scale || this.initialScale;
        this.model.scale.set(modelScale, modelScale, modelScale);
        this.currentScale = modelScale; // 更新当前缩放值

        // 应用Y轴偏移，使模型位于地面上
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

        // 添加模型到场景
        this.scene.add(this.model);

        // 处理动画
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.model);
          this.animations = gltf.animations;

          // 播放默认动画
          const defaultAnimIndex = modelOption.defaultAnimation || 0;
          if (this.animations.length > defaultAnimIndex) {
            const action = this.mixer.clipAction(
              this.animations[defaultAnimIndex]
            );
            action.play();
          } else if (this.animations.length > 0) {
            // 如果指定的默认动画不存在但有其他动画，播放第一个动画
            const action = this.mixer.clipAction(this.animations[0]);
            action.play();
          }
        } else {
          // 如果模型没有动画，记录信息但不影响模型显示
          console.log(`模型 ${modelOption.name} 没有动画`);
        }

        // 如果模型已加载且粒子效果已启用，应用粒子效果
        if (this.hasParticles) {
          this.removeParticles(); // 先移除旧粒子
          this.createParticleEffect(); // 创建新粒子
        }
      },
      undefined,
      (error) => {
        console.error("模型加载失败:", error);
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

      // 更新粒子效果
      this.updateParticles();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  updateModelPosition(x, y, scale) {
    if (!this.model || this.isDisposed || !this.isInitialized) return;

    // 获取当前模型配置
    const modelOption = this.modelOptions[this.currentModelIndex];

    // 计算模型特定的缩放因子
    let modelSpecificScale = 0.006; // 默认缩放因子

    // 根据模型名称设置不同的缩放因子
    if (modelOption.name.includes("小鸟")) {
      modelSpecificScale = 0.0005;
    } else if (modelOption.name.includes("小兔子")) {
      modelSpecificScale = 0.3;
    } else if (modelOption.name.includes("蒟蒻")) {
      modelSpecificScale = 0.04;
    } else if (modelOption.name.includes("小栗子")) {
      modelSpecificScale = 0.03;
    }

    // 更新目标位置和缩放，而不是直接设置
    this.targetPosition.x = x;
    // 调整Y轴偏移，使模型更好地对齐人物
    this.targetPosition.y = y - 0.2; // 减小Y轴偏移量，使模型更接近人物顶部

    // 只有在用户未交互或刚刚切换模型时才更新缩放
    if (!this.userInteracted) {
      // 缩放因子微调 - 使用模型特定的缩放因子
      this.targetScale = scale * modelSpecificScale;
    }

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

    // 添加鼠标事件监听器
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("mouseup", this.handleMouseUp);
    this.canvas.addEventListener("mouseleave", this.handleMouseUp);
    this.canvas.addEventListener("wheel", this.handleMouseWheel);

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

    // 移除鼠标事件监听器
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("mouseup", this.handleMouseUp);
    this.canvas.removeEventListener("mouseleave", this.handleMouseUp);
    this.canvas.removeEventListener("wheel", this.handleMouseWheel);

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

      // 获取当前模型配置
      const modelOption = this.modelOptions[this.currentModelIndex];

      // 获取模型的缩放范围限制
      const { minScale, maxScale } = this.getModelScaleRange(modelOption.name);

      // 限制缩放范围
      const limitedScale = Math.max(minScale, Math.min(maxScale, newScale));

      // 更新目标缩放
      this.targetScale = limitedScale;

      // 标记用户已交互
      this.userInteracted = true;
    }
  };

  // 处理触摸结束事件
  handleTouchEnd = () => {
    this.isDragging = false;
    this.previousTouch = null;
  };

  // 处理鼠标按下事件
  handleMouseDown = (event) => {
    event.preventDefault();

    if (!this.model) return;

    this.isDragging = true;
    this.previousMouse = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  // 处理鼠标移动事件
  handleMouseMove = (event) => {
    event.preventDefault();

    if (!this.model || !this.isDragging || !this.previousMouse) return;

    const deltaX = event.clientX - this.previousMouse.x;

    // 根据水平移动旋转模型
    this.currentRotationY += deltaX * 0.01;
    this.model.rotation.y = this.currentRotationY;

    this.previousMouse = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  // 处理鼠标释放事件
  handleMouseUp = () => {
    this.isDragging = false;
    this.previousMouse = null;
  };

  // 获取模型的缩放范围限制
  getModelScaleRange(modelName) {
    let minScale, maxScale;

    if (modelName.includes("小鸟")) {
      minScale = 0.0001;
      maxScale = 0.001;
    } else if (modelName.includes("小兔子")) {
      minScale = 0.005;
      maxScale = 0.05;
    } else if (modelName.includes("蒟蒻")) {
      minScale = 0.01;
      maxScale = 0.1;
    } else if (modelName.includes("小栗子")) {
      minScale = 0.01;
      maxScale = 0.1;
    } else {
      // 默认值（适用于狐狸等模型）
      minScale = 0.001;
      maxScale = 0.02;
    }

    return { minScale, maxScale };
  }

  // 处理鼠标滚轮事件
  handleMouseWheel = (event) => {
    event.preventDefault();

    if (!this.model) return;

    // 获取当前模型配置
    const modelOption = this.modelOptions[this.currentModelIndex];

    // 获取滚轮方向
    const delta = Math.sign(event.deltaY) * -0.0005;

    // 计算新的缩放值
    const newScale = this.currentScale + delta;

    // 获取模型的缩放范围限制
    const { minScale, maxScale } = this.getModelScaleRange(modelOption.name);

    // 限制缩放范围
    this.targetScale = Math.max(minScale, Math.min(maxScale, newScale));

    // 标记用户已交互
    this.userInteracted = true;
  };

  // 重置模型位置和旋转
  resetModelTransform() {
    if (!this.model) return;

    // 获取当前模型配置
    const modelOption = this.modelOptions[this.currentModelIndex];
    const modelRotation =
      modelOption.rotation !== undefined
        ? modelOption.rotation
        : this.initialRotationY;
    const modelScale = modelOption.scale || this.initialScale;

    // 设置目标值，而不是直接修改
    this.targetScale = modelScale;
    this.currentRotationY = modelRotation;
    this.targetPosition.x = 0;
    this.targetPosition.y = modelOption.yOffset || -0.4; // 使用模型特定的Y轴偏移

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

    // 重置用户交互标志
    this.userInteracted = false;
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

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 清理粒子系统
    this.removeParticles();

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

    // 移除窗口大小变化监听
    window.removeEventListener("resize", this.handleResize);

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

  // 切换到下一个模型
  nextModel() {
    const nextIndex = (this.currentModelIndex + 1) % this.modelOptions.length;
    this.loadModel(nextIndex);
  }

  // 切换到特定模型
  switchToModel(index) {
    if (index >= 0 && index < this.modelOptions.length) {
      this.loadModel(index);
    }
  }

  // 切换动画
  playAnimation(index) {
    if (!this.mixer || !this.animations || this.animations.length === 0) return;

    // 停止所有当前动画
    this.mixer.stopAllAction();

    // 播放选定的动画
    const animIndex = Math.min(Math.max(0, index), this.animations.length - 1);
    const action = this.mixer.clipAction(this.animations[animIndex]);
    action.play();
  }

  // 创建粒子效果
  createParticleEffect() {
    if (!this.model) return;

    // 获取当前模型配置
    const modelConfig = this.modelOptions[this.currentModelIndex];
    if (!modelConfig.particleEffect) return;

    // 如果已有粒子系统，先移除
    this.removeParticles();

    // 使用模型配置中的粒子数量
    this.particlesCount = modelConfig.particleEffect.count || 200;

    const positions = new Float32Array(this.particlesCount * 3);
    const colors = new Float32Array(this.particlesCount * 3);
    const sizes = new Float32Array(this.particlesCount);

    // 获取颜色配置，添加一些随机变化
    const baseColor = modelConfig.particleEffect.color || [0.5, 0.5, 0.5];

    // 生成粒子数据
    for (let i = 0; i < this.particlesCount; i++) {
      // 随机位置 (球形分布)
      const radius = 0.5 + Math.random() * 0.3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) - 0.3;
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // 使用基础颜色加一些随机变化
      colors[i * 3] = baseColor[0] * (0.8 + Math.random() * 0.4);
      colors[i * 3 + 1] = baseColor[1] * (0.8 + Math.random() * 0.4);
      colors[i * 3 + 2] = baseColor[2] * (0.8 + Math.random() * 0.4);

      // 随机大小，基于配置的大小
      sizes[i] = modelConfig.particleEffect.size * (0.7 + Math.random() * 0.6);
    }

    // 创建粒子几何体
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    // 创建粒子材质
    this.particlesMaterial = new THREE.PointsMaterial({
      size: modelConfig.particleEffect.size || 0.02,
      vertexColors: true,
      transparent: true,
      opacity: modelConfig.particleEffect.opacity || 0.7,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    // 创建粒子系统
    this.particles = new THREE.Points(geometry, this.particlesMaterial);
    if (this.model) {
      this.particles.position.copy(this.model.position);
    }
    this.scene.add(this.particles);
  }

  // 更新粒子效果
  updateParticles() {
    if (!this.particles || !this.model) return;

    // 使粒子跟随模型
    this.particles.position.copy(this.model.position);

    // 添加动态效果
    const time = this.clock.getElapsedTime() * 0.5;
    const positions = this.particles.geometry.attributes.position.array;

    for (let i = 0; i < this.particlesCount; i++) {
      // 添加简单的波动动画
      const ix = i * 3;
      const iy = i * 3 + 1;
      // const iz = i * 3 + 2; // 注释掉未使用的变量

      // 应用正弦波动
      positions[iy] += Math.sin(time + positions[ix]) * 0.003;

      // 重置属性以应用更新
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }

  // 移除粒子效果
  removeParticles() {
    if (this.particles) {
      this.scene.remove(this.particles);
      if (this.particlesMaterial) {
        this.particlesMaterial.dispose();
      }
      if (this.particles.geometry) {
        this.particles.geometry.dispose();
      }
      this.particles = null;
    }
  }

  // 切换粒子效果
  toggleParticles(enabled) {
    if (enabled !== undefined) {
      this.hasParticles = enabled;
    } else {
      this.hasParticles = !this.hasParticles;
    }

    if (this.hasParticles) {
      this.createParticleEffect();
    } else {
      this.removeParticles();
    }
  }
}

export default ThreeScene;
