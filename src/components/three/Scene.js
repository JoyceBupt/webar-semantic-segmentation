import * as THREE from "three";

class ThreeScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cube = null;

    this.init();
  }

  init() {
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

    // 开始动画循环
    this.animate();
  }

  animate = () => {
    if (this.cube) {
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.01;
      this.renderer.render(this.scene, this.camera);
    }
    requestAnimationFrame(this.animate);
  };

  updateCubePosition(x, y, scale) {
    if (!this.cube) return;

    this.cube.position.x = x;
    this.cube.position.y = y;
    this.cube.scale.set(scale, scale, scale);

    // 强制渲染更新
    this.renderer.render(this.scene, this.camera);
  }
}

export default ThreeScene;
