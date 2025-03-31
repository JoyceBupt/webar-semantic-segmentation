# Three.js 场景管理架构

本文档描述了 WebAR 项目中采用的模块化 Three.js 场景管理架构。

## 架构概述

重构后的架构采用了模块化设计，将各个功能组件分离成独立的模块，由中央场景管理器协调。
这种设计有以下优点：

- **关注点分离**：每个模块只负责特定功能，代码更清晰易懂
- **可维护性**：模块之间松耦合，修改一处不会影响整体功能
- **可扩展性**：可以方便地添加新模块或替换现有模块
- **可测试性**：模块化设计更便于单元测试

## 核心模块

### 1. SceneManager (场景管理器)

`SceneManager.js` 是整个架构的核心，负责：

- 创建和管理 Three.js 场景
- 注册和协调各个功能模块
- 处理动画循环和渲染流程
- 管理全局资源和清理

### 2. CameraManager (相机管理器)

`CameraManager.js` 负责：

- 创建和配置相机
- 处理相机视角调整
- 响应窗口大小变化

### 3. RendererManager (渲染器管理器)

`RendererManager.js` 负责：

- 创建和配置 WebGL 渲染器
- 处理渲染设置和优化
- 适配不同设备的性能特性

### 4. ModelManager (模型管理器)

`ModelManager.js` 负责：

- 加载和管理 3D 模型
- 处理模型切换、缩放和位置更新
- 管理模型动画和混合器
- 提供模型配置和选项

### 5. ParticleSystem (粒子系统)

`ParticleSystem.js` 负责：

- 创建和管理粒子效果
- 处理粒子动画和更新
- 同步粒子与模型位置

### 6. InteractionManager (交互管理器)

`InteractionManager.js` 负责：

- 处理用户触摸和鼠标交互
- 实现模型旋转、缩放等操作
- 管理用户交互状态

## 主接口类

### ThreeScene

`ThreeScene.js` 是对外提供的主要接口类，它封装了底层模块的复杂性，提供简洁的 API。它具有以下功能：

- 初始化和配置所有模块
- 提供统一的对外接口
- 管理模块间的通信
- 与 React 组件集成

## 使用方法

```jsx
import ThreeScene from "./three/ThreeScene";

// 在组件中
const myScene = new ThreeScene(canvasElement);
myScene.init();

// 其他操作
myScene.updateModelPosition(x, y, scale);
myScene.switchToModel(modelIndex);
myScene.enableInteraction();
```

## 扩展建议

要添加新功能，可以：

1. 创建新的模块，实现 `setSceneManager`、`init`、`update` 和 `dispose` 方法
2. 在 `ThreeScene` 中注册该模块
3. 在 `ThreeScene` 类中添加对应的公共接口方法

## 性能注意事项

- 使用 `requestAnimationFrame` 进行动画循环
- 及时清理未使用的资源，避免内存泄漏
- 使用对象池和实例化技术优化频繁创建/销毁的对象
- 考虑在低性能设备上降低粒子数量或特效复杂度
