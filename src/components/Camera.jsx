import { useEffect, useRef, useState } from 'react';
import ThreeScene from './three/Scene';
import SegmentationProcessor from './three/SegmentationProcessor';
import { useBodySegmentation } from '../hooks/useBodySegmentation';
import { useCamera } from '../hooks/useCamera';
import { useFPS } from '../hooks/useFPS';

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
    
    const { model, loading, loadModel, segmentPeople } = useBodySegmentation();
    const { setupCamera } = useCamera(videoRef);
    const { fps, updateFPS } = useFPS();

    // 执行语义分割
    const segmentPerson = async () => {
        if (!model || !videoRef.current || !canvasRef.current) return;

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
    };

    // 持续执行分割
    const startSegmentation = async () => {
        if (await setupCamera()) {
            const processFrame = async () => {
                await segmentPerson();
                requestAnimationFrame(processFrame);
            };
            processFrame();
        }
    };
    
    // 切换交互控制
    const toggleInteraction = () => {
        if (interactionEnabled) {
            threeSceneRef.current?.disableInteraction();
        } else {
            threeSceneRef.current?.enableInteraction();
        }
        setInteractionEnabled(!interactionEnabled);
    };
    
    // 重置模型变换
    const resetModelTransform = () => {
        threeSceneRef.current?.resetModelTransform();
    };
    
    // 关闭提示
    const closeTips = () => {
        setShowTips(false);
    };

    // 调整canvas尺寸以匹配视频比例
    const adjustCanvasSize = () => {
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
    };

    // 切换模型
    const handleModelChange = (index) => {
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
    };
    
    // 切换动画
    const handleAnimationChange = (index) => {
        if (threeSceneRef.current) {
            threeSceneRef.current.playAnimation(index);
            setAnimationIndex(index);
        }
    };
    
    // 更新动画选项列表
    const updateAnimationOptions = () => {
        if (threeSceneRef.current && threeSceneRef.current.animations) {
            const animations = threeSceneRef.current.animations.map((anim, index) => ({
                name: anim.name || `动画 ${index + 1}`,
                index
            }));
            setAnimationOptions(animations);
        }
    };
    
    // 切换粒子效果
    const toggleEffects = () => {
        setShowEffects(!showEffects);
        if (threeSceneRef.current) {
            if (!showEffects) {
                threeSceneRef.current.createParticleEffect();
            } else {
                threeSceneRef.current.removeParticles();
            }
        }
    };

    // 获取模型类型列表（去重）
    const getModelTypes = () => {
        const types = {};
        if (!modelOptions || modelOptions.length === 0) return [];
        
        modelOptions.forEach(model => {
            // 获取名称中的模型类型（如"狐狸"或"小鸟"）
            const typeName = model.name.split('(')[0];
            if (!types[typeName]) {
                types[typeName] = true;
            }
        });
        
        return Object.keys(types);
    };
    
    // 按模型类型筛选模型选项
    const getModelsByType = (type) => {
        if (!modelOptions || modelOptions.length === 0) return [];
        return modelOptions.filter(model => model.name.startsWith(type));
    };
    
    // 获取当前选中模型的类型
    const getCurrentModelType = () => {
        if (!modelOptions || currentModelIndex >= modelOptions.length) return "";
        const currentModel = modelOptions[currentModelIndex];
        return currentModel.name.split('(')[0];
    };
    
    // 切换模型类型
    const handleModelTypeChange = (type) => {
        // 获取该类型的第一个模型的索引
        const modelsOfType = getModelsByType(type);
        if (modelsOfType.length > 0) {
            const index = modelOptions.findIndex(model => model.name === modelsOfType[0].name);
            if (index !== -1) {
                handleModelChange(index);
            }
        }
    };

    useEffect(() => {
        loadModel();
        threeSceneRef.current = new ThreeScene(threeCanvasRef.current);

        // 等待 canvas 准备就绪后初始化 Three.js 场景
        const initThreeScene = () => {
            if (threeCanvasRef.current) {
                threeSceneRef.current.init();
                // 获取可用模型选项
                setModelOptions(threeSceneRef.current.modelOptions);
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
        if (threeSceneRef.current && threeSceneRef.current.animations) {
            updateAnimationOptions();
        }
    }, [currentModelIndex]);

    return (
        <div className="camera-container">
            {loading && (
                <div className="loading">
                    <p>模型加载中</p>
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
            
            <div className="fps-display">
                FPS: {fps}
            </div>
            
            <div className="controls">
                <button 
                    className={`interaction-toggle ${interactionEnabled ? 'active' : ''}`}
                    onClick={toggleInteraction}
                >
                </button>
                
                {interactionEnabled && (
                    <button 
                        className="reset-model"
                        onClick={resetModelTransform}
                    >
                    </button>
                )}
            </div>
            
            <div className="ar-enhancements">
                {/* 模型类型选择 */}
                <div className="model-type-selector">
                    <h4>选择模型</h4>
                    <div className="model-type-options">
                        {getModelTypes().map((type, index) => (
                            <button
                                key={index}
                                className={`model-type-option ${getCurrentModelType() === type ? 'active' : ''}`}
                                onClick={() => handleModelTypeChange(type)}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* 当前模型的动作选择 */}
                {getCurrentModelType() === "狐狸" && (
                    <div className="model-action-selector">
                        <h4>动作</h4>
                        <div className="model-options">
                            {getModelsByType("狐狸").map((model, idx) => (
                                <button
                                    key={idx}
                                    className={`model-option ${modelOptions.indexOf(model) === currentModelIndex ? 'active' : ''}`}
                                    onClick={() => handleModelChange(modelOptions.indexOf(model))}
                                >
                                    {model.name.split('(')[1].replace(')', '')}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="effects-toggle">
                    <button
                        className={`effect-button ${showEffects ? 'active' : ''}`}
                        onClick={toggleEffects}
                    >
                    </button>
                </div>
            </div>
            
            {interactionEnabled && showTips && (
                <div className="interaction-tips">
                    <div className="tips-header">
                        <p>操作提示：</p>
                        <button className="close-tips" onClick={closeTips}>×</button>
                    </div>
                    <ul>
                        <li>单指滑动：旋转模型</li>
                        <li>双指捏合：缩放模型</li>
                        <li>可选择不同动作和特效效果</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Camera; 