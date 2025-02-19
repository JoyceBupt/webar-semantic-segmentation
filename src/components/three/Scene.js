import * as THREE from "three";

class ThreeScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cube = null;
    this.isDisposed = false;
    this.animationFrameId = null;
    this.isInitialized = false;
  }

  init() {
    if (!this.canvas || this.isInitialized) return;

    try {
      // 创建场景
      this.scene = new THREE.Scene();

      // 创建正交相机
      this.camera = new THREE.OrthographicCamera(
        -1, // left
        1, // right
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
      this.renderer.setSize(640, 480);
      this.renderer.setClearColor(0x000000, 0);

      // 创建立方体
      const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const material = new THREE.MeshPhongMaterial({
        color: 0x646cff,
        transparent: true,
        opacity: 0.8,
        shininess: 100,
      });
      this.cube = new THREE.Mesh(geometry, material);
      this.cube.position.z = 0;
      this.scene.add(this.cube);

      // 添加光源
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(0, 0, 5);
      this.scene.add(directionalLight);

      const ambientLight = new THREE.AmbientLight(0x404040);
      this.scene.add(ambientLight);

      this.isInitialized = true;
      this.animate();
    } catch (error) {
      console.error("Three.js 场景初始化失败:", error);
      this.dispose();
    }
  }

  animate = () => {
    if (this.isDisposed || !this.isInitialized) return;

    if (this.cube && this.renderer && this.scene && this.camera) {
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.01;
      this.renderer.render(this.scene, this.camera);
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  updateCubePosition(x, y, scale) {
    if (!this.cube || this.isDisposed || !this.isInitialized) return;

    this.cube.position.x = x;
    this.cube.position.y = y;
    this.cube.scale.set(scale, scale, scale);

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

    if (this.cube) {
      this.scene.remove(this.cube);
      this.cube.geometry.dispose();
      this.cube.material.dispose();
      this.cube = null;
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
