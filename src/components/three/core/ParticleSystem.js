import * as THREE from "three";

/**
 * 粒子系统模块
 * 负责创建和管理粒子效果
 */
class ParticleSystem {
  constructor() {
    this.sceneManager = null;
    this.particles = null;
    this.particlesMaterial = null;
    this.particlesCount = 200;
    this.isEnabled = true;
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
    // 粒子系统将在模型加载后创建
  }

  /**
   * 创建粒子效果
   * @param {Object} particleConfig 粒子配置
   */
  createParticleEffect(particleConfig) {
    if (!this.sceneManager || !this.isEnabled) return;

    // 如果已有粒子系统，先移除
    this.removeParticles();

    if (!particleConfig) return;

    // 使用配置中的粒子数量
    this.particlesCount = particleConfig.count || 200;

    const positions = new Float32Array(this.particlesCount * 3);
    const colors = new Float32Array(this.particlesCount * 3);
    const sizes = new Float32Array(this.particlesCount);

    // 获取颜色配置，添加一些随机变化
    const baseColor = particleConfig.color || [0.5, 0.5, 0.5];

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
      sizes[i] = particleConfig.size * (0.7 + Math.random() * 0.6);
    }

    // 创建粒子几何体
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    // 创建粒子材质
    this.particlesMaterial = new THREE.PointsMaterial({
      size: particleConfig.size || 0.02,
      vertexColors: true,
      transparent: true,
      opacity: particleConfig.opacity || 0.7,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    // 创建粒子系统
    this.particles = new THREE.Points(geometry, this.particlesMaterial);

    // 将粒子系统添加到场景
    this.sceneManager.scene.add(this.particles);

    // 如果有模型，同步位置
    const modelManager = this.sceneManager.getModule("model");
    if (modelManager && modelManager.model) {
      this.particles.position.copy(modelManager.model.position);
    }
  }

  /**
   * 更新粒子效果
   * @param {number} delta 时间增量
   */
  update(delta) {
    if (!this.particles || !this.isEnabled) return;

    // 旋转粒子系统，创造动态效果
    this.particles.rotation.y += delta * 0.2;

    // 如果有模型，同步粒子位置
    const modelManager = this.sceneManager.getModule("model");
    if (modelManager && modelManager.model) {
      this.particles.position.x = modelManager.model.position.x;
      this.particles.position.y = modelManager.model.position.y;
    }
  }

  /**
   * 移除粒子效果
   */
  removeParticles() {
    if (this.particles && this.sceneManager) {
      this.sceneManager.scene.remove(this.particles);

      if (this.particles.geometry) {
        this.particles.geometry.dispose();
      }

      if (this.particlesMaterial) {
        this.particlesMaterial.dispose();
      }

      this.particles = null;
      this.particlesMaterial = null;
    }
  }

  /**
   * 切换粒子效果开关
   * @param {boolean} enabled 是否启用
   */
  toggleParticles(enabled) {
    this.isEnabled = enabled;

    if (!enabled) {
      this.removeParticles();
    } else {
      // 重新创建粒子效果
      const modelManager = this.sceneManager.getModule("model");
      if (modelManager) {
        const currentModel = modelManager.getCurrentModelOption();
        if (currentModel && currentModel.particleEffect) {
          this.createParticleEffect(currentModel.particleEffect);
        }
      }
    }
  }

  /**
   * 清理资源
   */
  dispose() {
    this.removeParticles();
  }
}

export default ParticleSystem;
