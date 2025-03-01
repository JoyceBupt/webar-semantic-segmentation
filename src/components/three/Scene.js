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
  };

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
