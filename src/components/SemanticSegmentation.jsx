import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { PASCAL_CLASSES } from '../constants/segmentationClasses';
import { useSegmentationRenderer } from '../hooks/useSegmentationRenderer';
import { useCamera } from '../hooks/useCamera';
import { useFPS } from '../hooks/useFPS';

const SemanticSegmentation = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
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
            
            const modelUrl = '/model2/model.json';
            console.log('开始加载模型:', modelUrl);
            const model = await tf.loadGraphModel(modelUrl);
            console.log('模型加载完成, 输入:', model.inputs);
            
            // 预热模型
            try {
                const dummyInput = tf.zeros([1, 3, 256, 256]); 
                console.log('模型预热输入形状:', dummyInput.shape);
                const warmupResult = model.execute({x: dummyInput});
                console.log('模型预热输出形状:', warmupResult.shape);
                tf.dispose([dummyInput, warmupResult]);
            } catch (error) {
                console.warn('模型预热失败, 但不影响后续使用:', error);
            }
            
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

            // 从视频帧创建输入张量
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            
            // 创建一个临时画布来调整视频大小
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 256;
            tempCanvas.height = 256;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(video, 0, 0, videoWidth, videoHeight, 0, 0, 256, 256);
            
            // 从调整大小后的图像创建输入张量
            const imageData = tempCtx.getImageData(0, 0, 256, 256);
            let input;
            try {
                input = tf.tidy(() => {
                    // 将像素数据转换为张量并归一化
                    const tensor = tf.browser.fromPixels(imageData);
                    // 确保张量有3个通道
                    console.log('输入图像形状:', tensor.shape);
                    const normalized = tensor.toFloat().div(tf.scalar(127.5)).sub(tf.scalar(1.0));
                    // 添加批次维度并转换为NCHW格式 (从NHWC转换为NCHW)
                    const transposed = normalized.expandDims(0).transpose([0, 3, 1, 2]);
                    console.log('转换后输入形状:', transposed.shape);
                    return transposed;
                });
            } catch (error) {
                console.error('准备输入数据时出错:', error);
                tempCanvas.remove();
                requestAnimationFrame(processFrame);
                return;
            }
            
            try {
                // 执行推理
                const result = model.execute({x: input});
                console.log('模型输出形状:', result.shape);
                
                // 处理分割结果
                let segmentationArray;
                if (result.shape.length === 4) {
                    // 如果结果是类别概率 [1, numClasses, H, W]，需要argmax
                    const segmentationTensor = tf.argMax(result, 1);
                    segmentationArray = await segmentationTensor.array();
                    tf.dispose(segmentationTensor);
                } else if (result.shape.length === 3) {
                    // 如果结果已经是分类结果 [1, H, W]
                    segmentationArray = await result.array();
                } else {
                    console.error('不支持的输出形状:', result.shape);
                    tf.dispose([input, result]);
                    tempCanvas.remove();
                    requestAnimationFrame(processFrame);
                    return;
                }
                
                console.log('分割结果示例:', 
                    segmentationArray[0] ? 
                    (segmentationArray[0][0] ? 
                        segmentationArray[0][0].slice(0, 5) : 
                        'undefined') : 
                    'undefined');
                
                // 创建符合渲染器期望格式的分割结果对象
                const segmentation = {
                    width: 256,
                    height: 256,
                    segmentationMap: segmentationArray[0]
                };
                
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
                
                // 清理资源
                tf.dispose([input, result]);
                tempCanvas.remove();
            } catch (error) {
                console.error('执行推理时出错:', error);
                if (input) tf.dispose(input);
                tempCanvas.remove();
            }
            
            // 继续下一帧
            requestAnimationFrame(processFrame);
        } catch (error) {
            console.error('分割过程出错:', error);
            // 尝试继续下一帧
            requestAnimationFrame(processFrame);
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
            const segmentationData = segmentation.segmentationMap;
            
            // 处理二维数组
            for (let i = 0; i < segmentationData.length; i++) {
                for (let j = 0; j < segmentationData[i].length; j++) {
                    const classId = segmentationData[i][j];
                    if (classId > 0) { // 0 是背景
                        detectedIds.add(classId);
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

    // 加载模型
    useEffect(() => {
        loadModel();
        // 组件卸载时清理资源
        return () => {
            if (model) {
                model.dispose();
            }
        };
    }, []);

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