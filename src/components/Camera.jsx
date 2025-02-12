import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as bodySegmentation from '@tensorflow-models/body-segmentation';
import ThreeScene from './three/Scene';
import SegmentationProcessor from './three/SegmentationProcessor';

const Camera = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const threeCanvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fps, setFps] = useState(0);
    
    const threeSceneRef = useRef(null);
    const segmentationProcessorRef = useRef(null);
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(performance.now());

    // 初始化模型
    const loadModel = async () => {
        try {
            await tf.ready();
            await tf.setBackend('webgl');
            
            const model = await bodySegmentation.createSegmenter(
                bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
                {
                    runtime: 'tfjs',
                    modelType: 'general'
                }
            );
            setModel(model);
            setLoading(false);
        } catch (error) {
            console.error('模型加载失败:', error);
            setLoading(false);
        }
    };

    // 初始化摄像头
    const setupCamera = async () => {
        if (!videoRef.current) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    facingMode: 'user'
                },
                audio: false,
            });
            
            const video = videoRef.current;
            video.srcObject = stream;
            
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });
            
            return true;
        } catch (error) {
            console.error('摄像头访问失败:', error);
            return false;
        }
    };

    // 更新FPS显示
    const updateFPS = () => {
        const now = performance.now();
        const elapsed = now - lastTimeRef.current;

        if (elapsed >= 1000) {
            setFps(Math.round((frameCountRef.current * 1000) / elapsed));
            frameCountRef.current = 0;
            lastTimeRef.current = now;
        }
        frameCountRef.current++;
    };

    // 执行语义分割
    const segmentPerson = async () => {
        if (!model || !videoRef.current || !canvasRef.current) return;

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (video.readyState < 2) return;

            const people = await model.segmentPeople(video, {
                flipHorizontal: false,
                multiSegmentation: false,
                segmentBodyParts: false
            });
            
            if (people.length > 0) {
                // 处理分割结果
                const result = await segmentationProcessorRef.current.processSegmentation(people);
                if (result) {
                    const { position, scale } = result;
                    threeSceneRef.current.updateCubePosition(position.x, position.y, scale);
                }

                // 创建遮罩
                const mask = await segmentationProcessorRef.current.createMask(people);

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
            } else {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }

            updateFPS();
            ctx.fillStyle = 'white';
            ctx.font = '24px Arial';
            ctx.fillText(`FPS: ${fps}`, 10, 30);

        } catch (error) {
            console.error('分割过程出错:', error);
        }
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
        segmentationProcessorRef.current = new SegmentationProcessor(canvasRef.current);
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