import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as semanticSegmentation from '@tensorflow-models/deeplab';
import { PASCAL_CLASSES } from '../constants/segmentationClasses';
import { useSegmentationRenderer } from '../hooks/useSegmentationRenderer';
import { useCamera } from '../hooks/useCamera';
import { useFPS } from '../hooks/useFPS';

const SemanticSegmentation = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
    const [selectedClass, setSelectedClass] = useState(null);
    const [detectedClasses, setDetectedClasses] = useState([]);
    
    const { fps, updateFPS } = useFPS();
    const { setupCamera } = useCamera(videoRef);
    const { renderSegmentation } = useSegmentationRenderer(canvasRef);

    // 监听屏幕方向变化
    useEffect(() => {
        const handleOrientationChange = () => {
            setIsPortrait(window.innerHeight > window.innerWidth);
        };
        
        window.addEventListener('resize', handleOrientationChange);
        return () => {
            window.removeEventListener('resize', handleOrientationChange);
        };
    }, []);

    // 初始化模型
    const loadModel = async () => {
        try {
            await tf.ready();
            await tf.setBackend('webgl');
            
            const model = await semanticSegmentation.load({
                base: 'pascal',
                quantizationBytes: 2
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
            await renderSegmentation(video, segmentation, PASCAL_CLASSES, selectedClass);
            
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

    useEffect(() => {
        loadModel();
    }, []);

    useEffect(() => {
        if (model) {
            startSegmentation();
        }
    }, [model]);

    return (
        <div className="segmentation-container">
            {isPortrait && (
                <div className="orientation-warning">
                    <div className="orientation-content">
                        <div className="orientation-icon">📱</div>
                        <p>建议横屏使用<br/>以获得更好的体验</p>
                        <div className="rotate-icon">🔄</div>
                    </div>
                </div>
            )}
            
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
            
            <div className="fps-display">
                FPS: {fps}
            </div>
            
            {detectedClasses.length > 0 && (
                <div className="detected-classes">
                    <h3>检测到的物体:</h3>
                    <div className="class-tags">
                        {detectedClasses.map(cls => (
                            <button 
                                key={cls.id}
                                className={`class-tag ${selectedClass === cls.id ? 'active' : ''}`}
                                onClick={() => toggleClass(cls.id)}
                            >
                                {cls.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SemanticSegmentation; 