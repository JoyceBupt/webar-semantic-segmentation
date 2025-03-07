import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import ThreeScene from './three/Scene';
import { useCamera } from '../hooks/useCamera';
import { useFPS } from '../hooks/useFPS';
import { CUSTOM_CLASSES } from '../constants/customSegmentationClasses';
import UIControlPanel from './UIControlPanel';

const CustomSegmentation = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const threeCanvasRef = useRef(null); // 添加Three.js画布引用
    
    const threeSceneRef = useRef(null); // 添加Three.js场景引用
    
    const [model, setModel] = useState(null);
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

    // 初始化模型
    const loadModel = async () => {
        try {
            setLoading(true);
            await tf.ready();
            await tf.setBackend('webgl');

            // 加载自定义模型
            const customModel = await tf.loadGraphModel('/model/model.json');

            setModel(customModel);
            setModelLoaded(true);
            setLoading(false);
        } catch (error) {
            console.error('模型加载失败:', error);
            setLoading(false);
        }
    };

    // 执行分割
    const processFrame = async () => {
        if (!model || !videoRef.current || !canvasRef.current || isPaused) return;

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video.readyState < 2) return;

            // 创建输入张量
            const videoFrame = tf.browser.fromPixels(video);

            // 调整大小为模型输入尺寸 - 注意这里改为 256x144
            const resizedFrame = tf.image.resizeBilinear(videoFrame, [256, 144]);

            // 归一化像素值 (0-255 -> 0-1)
            const normalizedFrame = resizedFrame.div(255.0);

            // 添加批次维度
            const batchedFrame = normalizedFrame.expandDims(0);

            // 将 NHWC 格式 [1, 256, 144, 3] 转换为 NCHW 格式 [1, 3, 256, 144]
            const transposedFrame = tf.transpose(batchedFrame, [0, 3, 1, 2]);

            // 执行模型推理
            let segmentation;
            try {
                segmentation = await model.predict(transposedFrame);

                // 如果模型返回的是数组，选择第一个输出
                if (Array.isArray(segmentation)) {
                    segmentation = segmentation[0];
                }

                // 检查输出数据类型
                const dataType = segmentation.dtype;

                // 根据用户选择决定是否使用二值掩码
                let maskToRender;
                if (useBinaryMask) {
                    // 尝试将输出转换为二值掩码
                    maskToRender = tf.tidy(() => {
                        // 如果输出是浮点数，使用阈值 0.5 进行二值化
                        if (dataType === 'float32' || dataType === 'float64') {
                            return segmentation.greater(0.5);
                        } else {
                            // 如果输出是整数，假设 1 表示前景，0 表示背景
                            return segmentation.equal(1);
                        }
                    });
                } else {
                    // 直接使用原始输出
                    maskToRender = segmentation;
                }

                // 渲染分割结果
                await renderSegmentation(video, maskToRender, canvas);
                
                // 处理分割结果，更新3D模型位置
                try {
                    // 从掩码数据创建position数据
                    const maskData = await maskToRender.array();
                    
                    // 计算质心
                    let centerX = 0;
                    let centerY = 0;
                    let count = 0;
                    
                    // 获取实际尺寸
                    const height = maskData[0].length;
                    const width = maskData[0][0] ? maskData[0][0].length : 0;

                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            if (maskData[0][y][x] === 1) {
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
                    console.error("处理分割结果出错:", error);
                }

                // 存储当前分割结果，用于下一帧
                if (lastSegmentationRef.current) {
                    lastSegmentationRef.current.dispose();
                }
                lastSegmentationRef.current = maskToRender.clone();

                // 如果使用了二值掩码，清理资源
                if (useBinaryMask && maskToRender !== segmentation) {
                    maskToRender.dispose();
                }
            } catch (error) {
                console.error("模型预测错误:", error);

                // 如果有上一帧的分割结果，使用它
                if (lastSegmentationRef.current) {
                    await renderSegmentation(video, lastSegmentationRef.current, canvas);
                }
            }

            // 更新FPS
            updateFPS();

            // 清理资源
            videoFrame.dispose();
            resizedFrame.dispose();
            normalizedFrame.dispose();
            batchedFrame.dispose();
            transposedFrame.dispose();
            if (Array.isArray(segmentation)) {
                segmentation.forEach(t => t.dispose());
            } else if (segmentation) {
                segmentation.dispose();
            }

            // 继续下一帧
            animationRef.current = requestAnimationFrame(processFrame);
        } catch (error) {
            console.error('分割过程出错:', error);

            // 如果有上一帧的分割结果，使用它
            if (lastSegmentationRef.current && canvasRef.current) {
                await renderSegmentation(videoRef.current, lastSegmentationRef.current, canvasRef.current);
            }

            // 继续下一帧
            animationRef.current = requestAnimationFrame(processFrame);
        }
    };

    // 渲染分割结果
    const renderSegmentation = async (video, segmentation, canvas) => {
        const ctx = canvas.getContext('2d');

        try {
            // 获取分割掩码数据
            const segmentationData = await segmentation.array();

            // 检查数据形状
            if (!segmentationData || !segmentationData[0]) {
                console.error("无效的分割数据");
                // 仅绘制原始视频帧
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                return;
            }

            // 获取实际尺寸
            const height = segmentationData[0].length;
            const width = segmentationData[0][0] ? segmentationData[0][0].length : 0;

            if (height === 0 || width === 0) {
                console.error("数据尺寸为零");
                // 仅绘制原始视频帧
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                return;
            }

            // 如果选择显示原始视频，则直接显示
            if (showOriginal) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                return;
            }

            // 创建临时画布用于处理原始视频
            const tempVideoCanvas = document.createElement('canvas');
            tempVideoCanvas.width = canvas.width;
            tempVideoCanvas.height = canvas.height;
            const tempVideoCtx = tempVideoCanvas.getContext('2d');
            tempVideoCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const videoImageData = tempVideoCtx.getImageData(0, 0, canvas.width, canvas.height);

            // 创建临时画布用于处理分割结果
            const tempMaskCanvas = document.createElement('canvas');
            tempMaskCanvas.width = width;
            tempMaskCanvas.height = height;
            const tempMaskCtx = tempMaskCanvas.getContext('2d');
            const maskImageData = tempMaskCtx.createImageData(width, height);

            // 解析颜色
            const colorHex = segmentColor.replace('#', '');
            const r = parseInt(colorHex.substring(0, 2), 16);
            const g = parseInt(colorHex.substring(2, 4), 16);
            const b = parseInt(colorHex.substring(4, 6), 16);

            // 更新自定义类别的颜色
            CUSTOM_CLASSES[1].color = [r, g, b];

            // 创建最终输出画布
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = canvas.width;
            outputCanvas.height = canvas.height;
            const outputCtx = outputCanvas.getContext('2d');

            // 首先绘制一个透明背景
            outputCtx.clearRect(0, 0, canvas.width, canvas.height);

            // 处理分割数据 - 创建掩码
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelIndex = (y * width + x) * 4;
                    const maskValue = segmentationData[0][y][x];

                    // 设置掩码像素 (1表示前景，0表示背景)
                    if (maskValue === 1) {
                        maskImageData.data[pixelIndex] = 255;     // R
                        maskImageData.data[pixelIndex + 1] = 255; // G
                        maskImageData.data[pixelIndex + 2] = 255; // B
                        maskImageData.data[pixelIndex + 3] = 255; // A (完全不透明)
                    } else {
                        // 背景透明
                        maskImageData.data[pixelIndex] = 0;     // R
                        maskImageData.data[pixelIndex + 1] = 0; // G
                        maskImageData.data[pixelIndex + 2] = 0; // B
                        maskImageData.data[pixelIndex + 3] = 0; // A (完全透明)
                    }
                }
            }

            // 将掩码应用到临时画布
            tempMaskCtx.putImageData(maskImageData, 0, 0);

            // 绘制原始视频到输出画布
            outputCtx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // 设置全局合成操作，只保留掩码区域
            outputCtx.globalCompositeOperation = 'destination-in';
            outputCtx.drawImage(tempMaskCanvas, 0, 0, canvas.width, canvas.height);

            // 重置合成操作
            outputCtx.globalCompositeOperation = 'source-over';

            // 将结果绘制到主画布
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(outputCanvas, 0, 0);

            // 清理临时画布
            tempVideoCanvas.remove();
            tempMaskCanvas.remove();
            outputCanvas.remove();
        } catch (error) {
            console.error('渲染分割结果出错:', error);
            // 出错时仅显示原始视频
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
    };

    // 启动分割过程
    const startSegmentation = async () => {
        if (await setupCamera()) {
            processFrame();
        }
    };
    
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
            processFrame();
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
            // 初始化自定义分割模型
            loadModel();
            
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
                if (lastSegmentationRef.current) {
                    lastSegmentationRef.current.dispose();
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

    // 模型加载后启动分割
    useEffect(() => {
        if (modelLoaded) {
            startSegmentation();
        }
    }, [modelLoaded]);

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
        <div className="camera-container">
            {loading && (
                <div className="loading">
                    <p>自定义分割模型加载中...</p>
                </div>
            )}
            
            {modelError && (
                <div className="error-message">
                    <p>{modelError}</p>
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