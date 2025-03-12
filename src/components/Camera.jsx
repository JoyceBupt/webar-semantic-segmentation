import { useEffect, useRef, useState } from 'react';
import ThreeScene from './three/Scene';
import SegmentationProcessor from './three/SegmentationProcessor';
import { useBodySegmentation } from '../hooks/useBodySegmentation';
import { useCamera } from '../hooks/useCamera';
import { useFPS } from '../hooks/useFPS';
import UIControlPanel from './UIControlPanel';

const Camera = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const threeCanvasRef = useRef(null);
    
    const threeSceneRef = useRef(null);
    const segmentationProcessorRef = useRef(null);
    
    // 添加交互控制状态
    const [interactionEnabled, setInteractionEnabled] = useState(false);
    // 添加提示状态
    const [showTips, setShowTips] = useState(true);
    // 添加模型状态
    const [currentModelIndex, setCurrentModelIndex] = useState(0);
    const [animationIndex, setAnimationIndex] = useState(0);
    const [modelOptions, setModelOptions] = useState([]);
    const [animationOptions, setAnimationOptions] = useState([]);
    const [showEffects, setShowEffects] = useState(true);
    const [modelError, setModelError] = useState(null);
    
    const { model, loading, loadModel, segmentPeople } = useBodySegmentation();
    const { setupCamera } = useCamera(videoRef);
    const { fps, updateFPS } = useFPS();

    // 执行语义分割
    const segmentPerson = async () => {
        if (!model || !videoRef.current || !canvasRef.current) return;

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (video.readyState < 2) return;

            const people = await segmentPeople(video);
            
            if (people && people.length > 0) {
                // 处理分割结果
                const result = await segmentationProcessorRef.current?.processSegmentation(people);
                if (result) {
                    const { position, scale } = result;
                    threeSceneRef.current?.updateModelPosition(position.x, position.y, scale);
                }

                // 创建遮罩
                const mask = await segmentationProcessorRef.current?.createMask(people);
                if (!mask) return;

                // 渲染视频帧
                const offscreenCanvas = document.createElement('canvas');
                offscreenCanvas.width = canvas.width;
                offscreenCanvas.height = canvas.height;
                const offscreenCtx = offscreenCanvas.getContext('2d');
                
                offscreenCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const originalFrame = offscreenCtx.getImageData(0, 0, canvas.width, canvas.height);

                const outputImage = new ImageData(canvas.width, canvas.height);
                const data = outputImage.data;
                const maskData = mask.data;
                const originalData = originalFrame.data;

                for (let i = 0; i < data.length; i += 4) {
                    if (maskData[i] === 255) {
                        data[i] = originalData[i];
                        data[i + 1] = originalData[i + 1];
                        data[i + 2] = originalData[i + 2];
                        data[i + 3] = 255;
                    } else {
                        data[i] = 0;
                        data[i + 1] = 0;
                        data[i + 2] = 0;
                        data[i + 3] = 180;
                    }
                }

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.putImageData(outputImage, 0, 0);

                // 清理临时画布
                offscreenCanvas.remove();
            } else {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }

            updateFPS();
        } catch (error) {
            console.error("分割过程出错:", error);
        }
    };

    // 持续执行分割
    const startSegmentation = async () => {
        try {
            if (await setupCamera()) {
                const processFrame = async () => {
                    await segmentPerson();
                    requestAnimationFrame(processFrame);
                };
                processFrame();
            }
        } catch (error) {
            console.error("启动分割过程出错:", error);
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

    useEffect(() => {
        try {
            loadModel();
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
            
            segmentationProcessorRef.current = new SegmentationProcessor(canvasRef.current);

            // 处理窗口大小变化
            window.addEventListener('resize', adjustCanvasSize);

            // 清理函数
            return () => {
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

    useEffect(() => {
        if (model) {
            startSegmentation();
        }
    }, [model]);

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
            
            {/* 使用新的UI控制面板 */}
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
    );
};

export default Camera; 