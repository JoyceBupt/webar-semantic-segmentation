import { useEffect, useRef } from 'react';
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
                threeSceneRef.current?.updateCubePosition(position.x, position.y, scale);
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
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.fillText(`FPS: ${fps}`, 10, 30);
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

    useEffect(() => {
        loadModel();
        threeSceneRef.current = new ThreeScene(threeCanvasRef.current);

        // 等待 canvas 准备就绪后初始化 Three.js 场景
        const initThreeScene = () => {
            if (threeCanvasRef.current) {
                threeSceneRef.current.init();
            }
        };

        // 使用 requestAnimationFrame 确保 canvas 已挂载
        requestAnimationFrame(initThreeScene);
        
        segmentationProcessorRef.current = new SegmentationProcessor(canvasRef.current);

        // 清理函数
        return () => {
            if (threeSceneRef.current) {
                threeSceneRef.current.dispose();
            }
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        if (model) {
            startSegmentation();
        }
    }, [model]);

    return (
        <div className="camera-container">
            {loading && (
                <div className="loading">
                    <p>模型加载中...</p>
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
                        pointerEvents: 'none'
                    }}
                />
            </div>
            <div className="fps-display">
                FPS: {fps}
            </div>
        </div>
    );
};

export default Camera; 