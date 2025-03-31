import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { PASCAL_CLASSES } from '../constants/segmentationClasses';
import { useSegmentationRenderer } from '../hooks/useSegmentationRenderer';
import { useCamera } from '../hooks/useCamera';
import { useFPS } from '../hooks/useFPS';
import { useSegmentationWorker } from '../hooks/useSegmentationWorker';

const SemanticSegmentation = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState(null);
    const [detectedClasses, setDetectedClasses] = useState([]);
    const [modelParams] = useState({
        threshold: 0.5,
        alpha: 0.6
    });
    
    const { fps, updateFPS } = useFPS();
    const { setupCamera } = useCamera(videoRef);
    const { renderSegmentation } = useSegmentationRenderer(canvasRef);
    
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
        if (videoRef.current && canvasRef.current) {
            const videoWidth = videoRef.current.videoWidth;
            const videoHeight = videoRef.current.videoHeight;
            
            if (videoWidth && videoHeight) {
                canvasRef.current.width = videoWidth;
                canvasRef.current.height = videoHeight;
            }
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
        
        const modelUrl = '/model2/model.json';
        setLoading(true);
        
        // 为语义分割模型提供正确的配置
        const semanticModelConfig = {
            inputShape: [256, 256], // 语义分割模型的输入尺寸
            inputFormat: 'NCHW'
        };
        
        loadModel(modelUrl, semanticModelConfig)
            .then(() => {
                setLoading(false);
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

    // 执行语义分割 - 现在使用Worker
    const processFrameWithWorker = async () => {
        if (!isModelLoaded || !videoRef.current || !canvasRef.current) return;

        try {
            const video = videoRef.current;

            if (video.readyState < 2) return;

            // 使用Worker处理分割
            const segmentation = await processFrame(video);
            
            if (!segmentation || !segmentation.data) {
                requestAnimationFrame(processFrameWithWorker);
                return;
            }
            
            // 更新检测到的类别
            const detected = findDetectedClasses(segmentation);
            if (detected.length > 0) {
                setDetectedClasses(detected);
            }
            
            // 渲染分割结果
            await renderSegmentation(
                video, 
                segmentation, 
                PASCAL_CLASSES, 
                selectedClass, 
                modelParams.alpha, 
                modelParams.threshold
            );
            
            // 更新FPS
            updateFPS();
            
            // 继续下一帧
            requestAnimationFrame(processFrameWithWorker);
        } catch (error) {
            // 短暂延迟后继续下一帧，避免错误循环过快
            setTimeout(() => {
                requestAnimationFrame(processFrameWithWorker);
            }, 1000);
        }
    };
    
    // 找出检测到的类别
    const findDetectedClasses = (segmentation) => {
        const detectedIds = new Set();
        
        if (!segmentation || !segmentation.data) {
            return [];
        }
        
        try {
            // 获取分割图中的唯一类别ID
            const segmentationData = segmentation.data;
            const isNestedArray = segmentation.shape === 'nested' || 
                (Array.isArray(segmentationData) && Array.isArray(segmentationData[0]));
            
            // 处理数据
            if (isNestedArray) {
                // 如果是二维数组
                for (let i = 0; i < segmentationData.length; i++) {
                    for (let j = 0; j < segmentationData[i].length; j++) {
                        const classId = segmentationData[i][j];
                        if (classId > 0) { // 0 是背景
                            detectedIds.add(classId);
                        }
                    }
                }
            } else {
                // 如果是一维数组
                const width = segmentation.width;
                const height = segmentation.height;
                
                for (let i = 0; i < Math.min(segmentationData.length, width * height); i++) {
                    const classId = segmentationData[i];
                    if (classId > 0) { // 0 是背景
                        detectedIds.add(classId);
                    }
                }
            }
        } catch (error) {
            // 保留错误处理逻辑，但删除日志
        }
        
        // 转换为类别对象数组
        return Array.from(detectedIds).map(id => {
            const className = PASCAL_CLASSES[id] ? PASCAL_CLASSES[id].name : '未知';
            return { id, name: className };
        });
    };
    
    // 切换显示特定类别
    const toggleClass = (classId) => {
        if (selectedClass === classId) {
            setSelectedClass(null); // 再次点击取消筛选
        } else {
            setSelectedClass(classId);
        }
    };

    // 启动分割过程
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

    return (
        <div className="segmentation-container">
            {loading && (
                <div className="loading">
                    <p>语义分割模型加载中</p>
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
            </div>

            {/* FPS 显示 */}
            <div className="fps-display">
                FPS: {fps}
            </div>

            {/* 检测到的类别列表 */}
            {detectedClasses.length > 0 && (
                <div className="detected-classes">
                    <h3>检测到的类别</h3>
                    <div className="class-list">
                        {detectedClasses.map((cls) => (
                            <div 
                                key={cls.id}
                                className={`class-label ${selectedClass === cls.id ? 'selected' : ''}`}
                                onClick={() => toggleClass(cls.id)}
                            >
                                <span 
                                    className="class-color" 
                                    style={{
                                        backgroundColor: `rgb(${PASCAL_CLASSES[cls.id].color.join(',')})`
                                    }}
                                />
                                <span>{cls.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SemanticSegmentation; 