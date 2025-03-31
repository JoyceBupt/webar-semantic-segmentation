import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import ThreeScene from './three/Scene';
import { useCamera } from '../hooks/useCamera';
import { useFPS } from '../hooks/useFPS';
import { CUSTOM_CLASSES } from '../constants/customSegmentationClasses';
import UIControlPanel from './UIControlPanel';
import { useSegmentationWorker } from '../hooks/useSegmentationWorker';

const CustomSegmentation = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const threeCanvasRef = useRef(null); // 添加Three.js画布引用
    
    const threeSceneRef = useRef(null); // 添加Three.js场景引用
    
    const [loading, setLoading] = useState(true);
    const [modelLoaded, setModelLoaded] = useState(false);
    // 保留这些状态变量，因为它们在渲染过程中仍然需要使用
    const [segmentColor, setSegmentColor] = useState('#FF0000');
    const [showOriginal, setShowOriginal] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [useBinaryMask, setUseBinaryMask] = useState(true);
    const animationRef = useRef(null);
    const lastSegmentationRef = useRef(null); // 存储上一帧的分割结果

    // 添加3D模型和UI控制面板所需的状态
    const [interactionEnabled, setInteractionEnabled] = useState(false);
    const [showTips, setShowTips] = useState(true);
    const [currentModelIndex, setCurrentModelIndex] = useState(0);
    const [animationIndex, setAnimationIndex] = useState(0);
    const [modelOptions, setModelOptions] = useState([]);
    const [animationOptions, setAnimationOptions] = useState([]);
    const [showEffects, setShowEffects] = useState(true);
    const [modelError, setModelError] = useState(null);

    const { fps, updateFPS } = useFPS();
    const { setupCamera } = useCamera(videoRef);
    
    // 使用Worker Hook替代直接的模型处理
    const { 
        status, 
        error, 
        isModelLoaded,
        isTfInitialized,
        loadModel, 
        processFrame 
    } = useSegmentationWorker();

    // 调整canvas尺寸以匹配视频比例
    const adjustCanvasSize = () => {
        try {
            if (videoRef.current && canvasRef.current && threeCanvasRef.current) {
                const videoWidth = videoRef.current.videoWidth;
                const videoHeight = videoRef.current.videoHeight;

                if (videoWidth && videoHeight) {
                    canvasRef.current.width = videoWidth;
                    canvasRef.current.height = videoHeight;
                    threeCanvasRef.current.width = videoWidth;
                    threeCanvasRef.current.height = videoHeight;
                    
                    // 如果有Three.js场景，通知其更新尺寸
                    if (threeSceneRef.current) {
                        threeSceneRef.current.updateSize(videoWidth, videoHeight);
                    }
                }
            }
        } catch (error) {
            console.error("调整画布尺寸出错:", error);
        }
    };

    // 处理窗口大小变化
    useEffect(() => {
        window.addEventListener('resize', adjustCanvasSize);
        return () => {
            window.removeEventListener('resize', adjustCanvasSize);
        };
    }, []);

    // 初始化Worker和模型
    useEffect(() => {
        // 等待TensorFlow初始化后再加载模型
        if (!isTfInitialized) {
            return;
        }
        
        const modelUrl = '/model/model.json';
        setLoading(true);
        
        // 为自定义模型提供正确的配置
        const customModelConfig = {
            inputShape: [256, 144], // 正确的输入尺寸
            inputFormat: 'NCHW'
        };
        
        loadModel(modelUrl, customModelConfig)
            .then(() => {
                setLoading(false);
                setModelLoaded(true);
            })
            .catch(error => {
                setLoading(false);
            });
    }, [loadModel, isTfInitialized]);
    
    // 处理Worker错误
    useEffect(() => {
        if (error) {
            // 此处只删除console.error，保留error状态处理逻辑
        }
    }, [error]);

    // 处理分割计算 - 使用Worker
    const processFrameWithWorker = async () => {
        if (!isModelLoaded || !videoRef.current || !canvasRef.current || isPaused) return;

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video.readyState < 2) return;

            // 开始新的帧处理前先安排下一帧，减少延迟
            animationRef.current = requestAnimationFrame(processFrameWithWorker);

            // 使用Worker处理分割
            const segmentation = await processFrame(video);
            
            if (!segmentation || !segmentation.data) {
                return;
            }
            
            // 渲染分割结果
            await renderSegmentation(video, segmentation, canvas);
            
            // 处理分割结果，更新3D模型位置
            try {
                // 从掩码数据创建position数据
                const maskData = segmentation.data;
                const isNestedArray = segmentation.shape === 'nested' || 
                    (Array.isArray(maskData) && Array.isArray(maskData[0]));
                
                // 计算质心
                let centerX = 0;
                let centerY = 0;
                let count = 0;
                
                // 获取实际尺寸
                const height = segmentation.height;
                const width = segmentation.width;

                // 处理数据
                if (isNestedArray) {
                    // 二维数组
                    for (let y = 0; y < maskData.length; y++) {
                        for (let x = 0; x < maskData[y].length; x++) {
                            if (maskData[y][x] === 1) {
                                centerX += x;
                                centerY += y;
                                count++;
                            }
                        }
                    }
                } else {
                    // 一维数组 - 扁平格式
                    for (let i = 0; i < maskData.length; i++) {
                        if (maskData[i] === 1) {
                            const x = i % width;
                            const y = Math.floor(i / width);
                            centerX += x;
                            centerY += y;
                            count++;
                        }
                    }
                }
                
                if (count > 0) {
                    centerX /= count;
                    centerY /= count;
                    
                    // 将坐标转换为 Three.js 坐标系统
                    const normalizedX = (centerX / width) * 2 - 1;
                    const normalizedY = -(centerY / height) * 2 + 1;
                    
                    // 计算物体大小比例
                    const objectSize = Math.sqrt(count / (width * height));
                    const scale = Math.max(0.3, Math.min(1, objectSize * 2));
                    
                    // 更新模型位置
                    if (threeSceneRef.current) {
                        threeSceneRef.current.updateModelPosition(normalizedX, normalizedY, scale);
                    }
                }
            } catch (error) {
                // 保留错误处理逻辑，但删除日志输出
            }

            // 存储当前分割结果，用于下一帧
            lastSegmentationRef.current = segmentation;

            // 更新FPS
            updateFPS();
        } catch (error) {
            // 如果有上一帧的分割结果，使用它
            if (lastSegmentationRef.current && canvasRef.current) {
                await renderSegmentation(videoRef.current, lastSegmentationRef.current, canvasRef.current);
            }

            // 短暂延迟后继续下一帧，避免错误循环过快
            setTimeout(() => {
                animationRef.current = requestAnimationFrame(processFrameWithWorker);
            }, 1000);
        }
    };

    // 渲染分割结果
    const renderSegmentation = async (video, segmentation, canvas) => {
        const ctx = canvas.getContext('2d');

        try {
            // 获取分割掩码数据
            const segmentationData = segmentation.data;
            const isNestedArray = segmentation.shape === 'nested' || 
                (Array.isArray(segmentationData) && Array.isArray(segmentationData[0]));
            
            // 先绘制完整视频帧到临时画布
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const videoImageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
            
            // 创建输出图像数据
            const outputImage = ctx.createImageData(canvas.width, canvas.height);
            
            // 缩放因子 - 用于将分割结果映射到画布尺寸
            const scaleX = canvas.width / segmentation.width;
            const scaleY = canvas.height / segmentation.height;
            
            // 处理数据 - 创建遮罩
            if (isNestedArray) {
                // 二维数组
                for (let y = 0; y < segmentation.height; y++) {
                    for (let x = 0; x < segmentation.width; x++) {
                        const isForeground = segmentationData[y][x] === 1; // 1表示前景（人像）
                        
                        // 计算目标画布上对应的像素区域
                        const targetStartX = Math.floor(x * scaleX);
                        const targetEndX = Math.floor((x + 1) * scaleX);
                        const targetStartY = Math.floor(y * scaleY);
                        const targetEndY = Math.floor((y + 1) * scaleY);
                        
                        // 对映射到的每个像素进行处理
                        for (let ty = targetStartY; ty < targetEndY; ty++) {
                            for (let tx = targetStartX; tx < targetEndX; tx++) {
                                // 确保在画布范围内
                                if (tx >= 0 && tx < canvas.width && ty >= 0 && ty < canvas.height) {
                                    const targetIdx = (ty * canvas.width + tx) * 4;
                                    
                                    if (isForeground) {
                                        // 对于前景（人像），保持原始视频像素
                                        outputImage.data[targetIdx] = videoImageData.data[targetIdx];
                                        outputImage.data[targetIdx + 1] = videoImageData.data[targetIdx + 1];
                                        outputImage.data[targetIdx + 2] = videoImageData.data[targetIdx + 2];
                                        outputImage.data[targetIdx + 3] = 255; // 完全不透明
                                    } else if (!showOriginal) {
                                        // 对于背景，如果不显示原始视频则使用半透明效果
                                        outputImage.data[targetIdx] = videoImageData.data[targetIdx];
                                        outputImage.data[targetIdx + 1] = videoImageData.data[targetIdx + 1];
                                        outputImage.data[targetIdx + 2] = videoImageData.data[targetIdx + 2];
                                        outputImage.data[targetIdx + 3] = 80; // 背景半透明
                                    } else {
                                        // 如果显示原始视频，则保持原始像素
                                        outputImage.data[targetIdx] = videoImageData.data[targetIdx];
                                        outputImage.data[targetIdx + 1] = videoImageData.data[targetIdx + 1];
                                        outputImage.data[targetIdx + 2] = videoImageData.data[targetIdx + 2];
                                        outputImage.data[targetIdx + 3] = 255;
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // 一维数组
                const width = segmentation.width;
                const height = segmentation.height;
                
                for (let i = 0; i < Math.min(segmentationData.length, width * height); i++) {
                    const isForeground = segmentationData[i] === 1; // 1表示前景（人像）
                    
                    // 计算源坐标
                    const x = i % width;
                    const y = Math.floor(i / width);
                    
                    // 计算目标画布上对应的像素区域
                    const targetStartX = Math.floor(x * scaleX);
                    const targetEndX = Math.floor((x + 1) * scaleX);
                    const targetStartY = Math.floor(y * scaleY);
                    const targetEndY = Math.floor((y + 1) * scaleY);
                    
                    // 对映射到的每个像素进行处理
                    for (let ty = targetStartY; ty < targetEndY; ty++) {
                        for (let tx = targetStartX; tx < targetEndX; tx++) {
                            // 确保在画布范围内
                            if (tx >= 0 && tx < canvas.width && ty >= 0 && ty < canvas.height) {
                                const targetIdx = (ty * canvas.width + tx) * 4;
                                
                                if (isForeground) {
                                    // 对于前景（人像），保持原始视频像素
                                    outputImage.data[targetIdx] = videoImageData.data[targetIdx];
                                    outputImage.data[targetIdx + 1] = videoImageData.data[targetIdx + 1];
                                    outputImage.data[targetIdx + 2] = videoImageData.data[targetIdx + 2];
                                    outputImage.data[targetIdx + 3] = 255; // 完全不透明
                                } else if (!showOriginal) {
                                    // 对于背景，如果不显示原始视频则使用半透明效果
                                    outputImage.data[targetIdx] = videoImageData.data[targetIdx];
                                    outputImage.data[targetIdx + 1] = videoImageData.data[targetIdx + 1];
                                    outputImage.data[targetIdx + 2] = videoImageData.data[targetIdx + 2];
                                    outputImage.data[targetIdx + 3] = 80; // 背景半透明
                                } else {
                                    // 如果显示原始视频，则保持原始像素
                                    outputImage.data[targetIdx] = videoImageData.data[targetIdx];
                                    outputImage.data[targetIdx + 1] = videoImageData.data[targetIdx + 1];
                                    outputImage.data[targetIdx + 2] = videoImageData.data[targetIdx + 2];
                                    outputImage.data[targetIdx + 3] = 255;
                                }
                            }
                        }
                    }
                }
            }
            
            // 清除画布
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 绘制处理后的图像
            ctx.putImageData(outputImage, 0, 0);
            
            // 清理临时画布
            tempCanvas.remove();
            
        } catch (error) {
            console.error('渲染分割结果时出错:', error);
            
            // 如果发生错误，至少显示原始视频帧
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
    };

    // 将十六进制颜色代码转换为RGB
    const hexToRgb = (hex) => {
        // 移除#号
        hex = hex.replace('#', '');
        
        // 解析RGB值
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return { r, g, b };
    };

    // 启动分割
    const startSegmentation = async () => {
        if (await setupCamera()) {
            processFrameWithWorker();
        }
    };

    // 加载模型状态变化时启动分割
    useEffect(() => {
        if (!loading && isModelLoaded) {
            startSegmentation();
        }
    }, [loading, isModelLoaded]);

    // 切换交互控制
    const toggleInteraction = () => {
        try {
            if (interactionEnabled) {
                threeSceneRef.current?.disableInteraction();
            } else {
                threeSceneRef.current?.enableInteraction();
            }
            setInteractionEnabled(!interactionEnabled);
        } catch (error) {
            console.error("切换交互控制出错:", error);
        }
    };
    
    // 重置模型变换
    const resetModelTransform = () => {
        try {
            threeSceneRef.current?.resetModelTransform();
        } catch (error) {
            console.error("重置模型变换出错:", error);
        }
    };
    
    // 关闭提示
    const closeTips = () => {
        setShowTips(false);
    };
    
    // 切换模型
    const handleModelChange = (index) => {
        try {
            if (threeSceneRef.current) {
                threeSceneRef.current.switchToModel(index);
                setCurrentModelIndex(index);
                // 重置动画索引，因为新模型可能有不同的动画集
                setAnimationIndex(0);
                // 获取新模型的动画选项
                if (threeSceneRef.current.animations) {
                    updateAnimationOptions();
                }
            }
        } catch (error) {
            console.error("切换模型出错:", error);
            setModelError("切换模型失败，请尝试其他模型");
            // 延迟清除错误信息
            setTimeout(() => setModelError(null), 3000);
        }
    };
    
    // 切换动画
    const handleAnimationChange = (index) => {
        try {
            if (threeSceneRef.current) {
                threeSceneRef.current.playAnimation(index);
                setAnimationIndex(index);
            }
        } catch (error) {
            console.error("切换动画出错:", error);
        }
    };
    
    // 更新动画选项列表
    const updateAnimationOptions = () => {
        try {
            if (threeSceneRef.current && threeSceneRef.current.animations) {
                const animations = threeSceneRef.current.animations.map((anim, index) => ({
                    name: anim.name || `动画 ${index + 1}`,
                    index
                }));
                setAnimationOptions(animations);
            }
        } catch (error) {
            console.error("更新动画选项出错:", error);
            setAnimationOptions([]);
        }
    };
    
    // 切换粒子效果
    const toggleEffects = () => {
        try {
            setShowEffects(!showEffects);
            if (threeSceneRef.current) {
                if (!showEffects) {
                    threeSceneRef.current.createParticleEffect();
                } else {
                    threeSceneRef.current.removeParticles();
                }
            }
        } catch (error) {
            console.error("切换粒子效果出错:", error);
        }
    };

    // 获取模型类型列表（去重）
    const getModelTypes = () => {
        const types = {};
        if (!modelOptions || modelOptions.length === 0) return [];
        
        modelOptions.forEach(model => {
            if (!model || !model.name) return;
            // 获取名称中的模型类型（如"狐狸"或"小鸟"）
            const typeName = model.name.split('(')[0].trim();
            if (!types[typeName]) {
                types[typeName] = true;
            }
        });
        
        return Object.keys(types);
    };
    
    // 按模型类型筛选模型选项
    const getModelsByType = (type) => {
        if (!modelOptions || modelOptions.length === 0 || !type) return [];
        return modelOptions.filter(model => model && model.name && model.name.startsWith(type));
    };
    
    // 获取当前选中模型的类型
    const getCurrentModelType = () => {
        if (!modelOptions || modelOptions.length === 0 || 
            currentModelIndex >= modelOptions.length || 
            !modelOptions[currentModelIndex] ||
            !modelOptions[currentModelIndex].name) return "";
            
        const currentModel = modelOptions[currentModelIndex];
        return currentModel.name.split('(')[0].trim();
    };
    
    // 切换模型类型
    const handleModelTypeChange = (type) => {
        try {
            // 获取该类型的第一个模型的索引
            const modelsOfType = getModelsByType(type);
            if (modelsOfType.length > 0) {
                const index = modelOptions.findIndex(model => model.name === modelsOfType[0].name);
                if (index !== -1) {
                    handleModelChange(index);
                }
            }
        } catch (error) {
            console.error("切换模型类型出错:", error);
        }
    };

    // 保留这些函数，但我们不再需要在UI中使用它们
    const toggleOriginal = () => {
        setShowOriginal(!showOriginal);
    };

    const togglePause = () => {
        setIsPaused(!isPaused);
        if (isPaused) {
            processFrameWithWorker();
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }
    };

    const handleColorChange = (e) => {
        setSegmentColor(e.target.value);
    };

    const toggleBinaryMask = () => {
        setUseBinaryMask(!useBinaryMask);
    };

    // 组件加载时初始化模型和Three.js场景
    useEffect(() => {
        try {
            // 初始化Three.js场景
            threeSceneRef.current = new ThreeScene(threeCanvasRef.current);

            // 等待 canvas 准备就绪后初始化 Three.js 场景
            const initThreeScene = () => {
                if (threeCanvasRef.current) {
                    threeSceneRef.current.init();
                    // 获取可用模型选项
                    setModelOptions(threeSceneRef.current.modelOptions || []);
                }
            };

            // 使用 requestAnimationFrame 确保 canvas 已挂载
            requestAnimationFrame(initThreeScene);
            
            // 组件卸载时清理
            return () => {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }
                if (threeSceneRef.current) {
                    threeSceneRef.current.dispose();
                }
                if (videoRef.current && videoRef.current.srcObject) {
                    const tracks = videoRef.current.srcObject.getTracks();
                    tracks.forEach(track => track.stop());
                }
                window.removeEventListener('resize', adjustCanvasSize);
            };
        } catch (error) {
            console.error("初始化组件出错:", error);
        }
    }, []);

    // 视频加载后调整canvas尺寸
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.addEventListener('loadedmetadata', adjustCanvasSize);
            return () => {
                if (videoRef.current) {
                    videoRef.current.removeEventListener('loadedmetadata', adjustCanvasSize);
                }
            };
        }
    }, [videoRef.current]);

    // 模型加载完成后获取动画选项
    useEffect(() => {
        try {
            if (threeSceneRef.current && threeSceneRef.current.animations) {
                updateAnimationOptions();
            }
        } catch (error) {
            console.error("获取动画选项出错:", error);
        }
    }, [currentModelIndex]);

    return (
        <div className="segmentation-container">
            {loading && (
                <div className="loading">
                    <p>模型加载中</p>
                </div>
            )}
            
            {modelError && (
                <div className="error-message">
                    <p>{modelError}</p>
                </div>
            )}
            
            {showTips && (
                <div className="tips-overlay">
                    <div className="tips-content">
                        <h3>交互提示</h3>
                        <p>您可以通过以下方式与模型交互：</p>
                        <ul>
                            <li>鼠标拖动：旋转模型</li>
                            <li>鼠标滚轮：缩放模型</li>
                            <li>触摸屏设备上可使用单指滑动和双指捏合</li>
                        </ul>
                        <button className="close-tips-btn" onClick={closeTips}>
                            我知道了
                        </button>
                    </div>
                </div>
            )}
            
            <div className="video-container">
                <video
                    ref={videoRef}
                    width="640"
                    height="480"
                    playsInline
                    autoPlay
                    style={{ display: 'none' }}
                />
                <canvas
                    ref={canvasRef}
                    width="640"
                    height="480"
                />
                <canvas
                    ref={threeCanvasRef}
                    width="640"
                    height="480"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        pointerEvents: interactionEnabled ? 'auto' : 'none'
                    }}
                />
            </div>
            
            <div className="segmentation-controls">
                <div className="basic-controls" style={{ margin: '10px 0', padding: '10px', background: '#f0f0f0', borderRadius: '5px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    <div className="fps-display" style={{ fontWeight: 'bold' }}>
                        FPS: {fps.toFixed(1)}
                    </div>
                </div>
                
                {/* 使用UI控制面板 */}
                <UIControlPanel 
                    fps={fps}
                    modelOptions={modelOptions}
                    currentModelIndex={currentModelIndex}
                    handleModelChange={handleModelChange}
                    animationOptions={animationOptions}
                    animationIndex={animationIndex}
                    handleAnimationChange={handleAnimationChange}
                    showEffects={showEffects}
                    toggleEffects={toggleEffects}
                    interactionEnabled={interactionEnabled}
                    toggleInteraction={toggleInteraction}
                    resetModelTransform={resetModelTransform}
                />
            </div>
        </div>
    );
};

export default CustomSegmentation; 