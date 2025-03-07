import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as semanticSegmentation from '@tensorflow-models/deeplab';
import { PASCAL_CLASSES } from '../constants/segmentationClasses';
import { useSegmentationRenderer } from '../hooks/useSegmentationRenderer';
import { useCamera } from '../hooks/useCamera';
import { useFPS } from '../hooks/useFPS';
import UIControlPanel from './UIControlPanel';

const SemanticSegmentation = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState(null);
    const [detectedClasses, setDetectedClasses] = useState([]);
    const [selectedModel, setSelectedModel] = useState('pascal');
    const [modelParams, setModelParams] = useState({
        quantizationBytes: 2,
        threshold: 0.5,
        alpha: 0.6
    });
    
    const { fps, updateFPS } = useFPS();
    const { setupCamera } = useCamera(videoRef);
    const { renderSegmentation } = useSegmentationRenderer(canvasRef);

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

    // 初始化模型
    const loadModel = async () => {
        try {
            setLoading(true);
            await tf.ready();
            await tf.setBackend('webgl');
            
            const model = await semanticSegmentation.load({
                base: selectedModel,
                quantizationBytes: modelParams.quantizationBytes
            });
            
            setModel(model);
            setLoading(false);
        } catch (error) {
            console.error('模型加载失败:', error);
            setLoading(false);
        }
    };

    // 执行语义分割
    const processFrame = async () => {
        if (!model || !videoRef.current || !canvasRef.current) return;

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video.readyState < 2) return;

            // 执行分割
            const segmentation = await model.segment(video);
            
            // 更新检测到的类别
            const detected = findDetectedClasses(segmentation);
            if (detected.length > 0) {
                setDetectedClasses(detected);
            }
            
            // 渲染分割结果，根据selectedClass过滤
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
            
            // 清理资源
            if (segmentation.segmentationMap instanceof tf.Tensor) {
                tf.dispose(segmentation.segmentationMap);
            }
            
            // 继续下一帧
            requestAnimationFrame(processFrame);
        } catch (error) {
            console.error('分割过程出错:', error);
        }
    };
    
    // 找出检测到的类别
    const findDetectedClasses = (segmentation) => {
        const detectedIds = new Set();
        
        if (!segmentation || !segmentation.segmentationMap) {
            return [];
        }
        
        try {
            // 获取分割图中的唯一类别ID
            // 尝试直接访问底层数据，处理不同形式的segmentationMap
            let segmentationData;
            
            if (segmentation.segmentationMap instanceof tf.Tensor) {
                // 如果是TensorFlow.js张量
                segmentationData = segmentation.segmentationMap.arraySync ? 
                    segmentation.segmentationMap.arraySync() : 
                    Array.from(segmentation.segmentationMap.dataSync());
            } else if (Array.isArray(segmentation.segmentationMap)) {
                // 如果是普通数组
                segmentationData = segmentation.segmentationMap;
            } else {
                // 如果是TypedArray
                segmentationData = Array.from(segmentation.segmentationMap);
            }
            
            // 处理一维或二维数组
            if (Array.isArray(segmentationData)) {
                if (Array.isArray(segmentationData[0])) {
                    // 二维数组
                    for (let i = 0; i < segmentationData.length; i++) {
                        for (let j = 0; j < segmentationData[i].length; j++) {
                            const classId = segmentationData[i][j];
                            if (classId > 0) { // 0 是背景
                                detectedIds.add(classId);
                            }
                        }
                    }
                } else {
                    // 一维数组
                    for (let i = 0; i < segmentationData.length; i++) {
                        const classId = segmentationData[i];
                        if (classId > 0) { // 0 是背景
                            detectedIds.add(classId);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('解析分割数据出错:', error);
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
            processFrame();
        }
    };

    // 当选择的模型或参数变化时，重新加载模型
    useEffect(() => {
        if (model) {
            // 释放旧模型资源
            model.dispose && model.dispose();
        }
        loadModel();
    }, [selectedModel, modelParams.quantizationBytes]);

    // 模型加载后启动分割
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
            
            {/* 使用新的UI控制面板 */}
            <UIControlPanel 
                fps={fps}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                modelParams={modelParams}
                setModelParams={setModelParams}
                detectedClasses={detectedClasses}
                selectedClass={selectedClass}
                toggleClass={toggleClass}
            />
        </div>
    );
};

export default SemanticSegmentation; 