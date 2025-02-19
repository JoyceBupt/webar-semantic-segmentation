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
    
    const { fps, updateFPS } = useFPS();
    const { setupCamera } = useCamera(videoRef);
    const { renderSegmentation } = useSegmentationRenderer(canvasRef);

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
            
            // 渲染分割结果
            await renderSegmentation(video, segmentation, PASCAL_CLASSES);
            
            // 更新FPS
            updateFPS();
            
            // 清理资源
            tf.dispose(segmentation.segmentationMap);
            
            // 继续下一帧
            requestAnimationFrame(processFrame);
        } catch (error) {
            console.error('分割过程出错:', error);
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
            {loading && (
                <div className="loading">
                    <p>语义分割模型加载中...</p>
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
        </div>
    );
};

export default SemanticSegmentation; 