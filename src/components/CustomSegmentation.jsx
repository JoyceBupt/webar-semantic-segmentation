import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { useCamera } from '../hooks/useCamera';
import { useFPS } from '../hooks/useFPS';
import { CUSTOM_CLASSES } from '../constants/customSegmentationClasses';

const CustomSegmentation = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const debugCanvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [alpha, setAlpha] = useState(0.6);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [segmentColor, setSegmentColor] = useState('#FF0000');
    const [showOriginal, setShowOriginal] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [threshold, setThreshold] = useState(0.5); // 阈值，范围0-1
    const [autoThreshold, setAutoThreshold] = useState(true); // 是否自动计算阈值
    const [minMaxValues, setMinMaxValues] = useState({ min: 0, max: 1 }); // 模型输出的最小值和最大值
    const [useBinaryMask, setUseBinaryMask] = useState(true); // 是否使用二值掩码
    const animationRef = useRef(null);
    const lastSegmentationRef = useRef(null); // 存储上一帧的分割结果
    
    const { fps, updateFPS } = useFPS();
    const { setupCamera } = useCamera(videoRef);

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

    // 可视化模型输出
    const visualizeOutput = async (segmentation, canvas) => {
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        try {
            // 获取分割掩码数据
            const segmentationData = await segmentation.array();
            
            // 检查数据形状
            if (!segmentationData || !segmentationData[0]) {
                console.error("可视化：无效的分割数据");
                // 显示错误信息
                ctx.fillStyle = 'red';
                ctx.font = '16px Arial';
                ctx.fillText('无效的分割数据', 10, 30);
                return;
            }
            
            // 获取实际尺寸
            const height = segmentationData[0].length;
            const width = segmentationData[0][0] ? segmentationData[0][0].length : 0;
            
            if (height === 0 || width === 0) {
                console.error("可视化：数据尺寸为零");
                ctx.fillStyle = 'red';
                ctx.font = '16px Arial';
                ctx.fillText('数据尺寸为零', 10, 30);
                return;
            }
            
            // 创建ImageData对象
            const imageData = ctx.createImageData(width, height);
            
            // 找出掩码中的最大值和最小值
            let minVal = Infinity;
            let maxVal = -Infinity;
            let hasUndefined = false;
            let hasNaN = false;
            let validCount = 0;
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const val = segmentationData[0][y][x];
                    if (val === undefined) {
                        hasUndefined = true;
                    } else if (isNaN(val)) {
                        hasNaN = true;
                    } else {
                        validCount++;
                        minVal = Math.min(minVal, val);
                        maxVal = Math.max(maxVal, val);
                    }
                }
            }
            
            // 如果没有有效值，使用默认值
            if (validCount === 0 || minVal === Infinity || maxVal === -Infinity) {
                minVal = 0;
                maxVal = 1;
            }
            
            // 归一化并填充ImageData
            const range = maxVal - minVal;
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelIndex = (y * width + x) * 4;
                    const val = segmentationData[0][y][x];
                    
                    // 归一化到0-255
                    let normalizedVal;
                    if (val === undefined || isNaN(val) || range === 0) {
                        normalizedVal = 0; // 无效值显示为黑色
                    } else {
                        normalizedVal = Math.round(((val - minVal) / range) * 255);
                    }
                    
                    // 使用灰度表示
                    imageData.data[pixelIndex] = normalizedVal;     // R
                    imageData.data[pixelIndex + 1] = normalizedVal; // G
                    imageData.data[pixelIndex + 2] = normalizedVal; // B
                    imageData.data[pixelIndex + 3] = 255;           // A
                }
            }
            
            // 绘制到画布
            ctx.putImageData(imageData, 0, 0);
            
            // 添加文本信息
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(`Min: ${minVal.toFixed(2)}, Max: ${maxVal.toFixed(2)}`, 10, 20);
            ctx.fillText(`Range: ${range.toFixed(2)}`, 10, 40);
            
            // 添加数据质量信息
            if (hasUndefined || hasNaN) {
                ctx.fillStyle = 'red';
                ctx.fillText(`警告: 数据包含 ${hasUndefined ? 'undefined' : ''} ${hasNaN ? 'NaN' : ''}`, 10, 60);
                ctx.fillText(`有效值: ${validCount}/${width*height}`, 10, 80);
                ctx.fillStyle = 'white';
            }
            
            // 绘制阈值线
            const thresholdValue = autoThreshold ? (minVal + maxVal) / 2 : minVal + (maxVal - minVal) * threshold;
            const thresholdY = hasUndefined || hasNaN ? 100 : 60;
            
            ctx.fillText(`Threshold: ${thresholdValue.toFixed(2)}`, 10, thresholdY);
            
            // 绘制颜色条
            const barHeight = 20;
            const barY = thresholdY + 10;
            const barWidth = canvas.width - 20;
            
            const gradient = ctx.createLinearGradient(10, 0, barWidth + 10, 0);
            gradient.addColorStop(0, 'black');
            gradient.addColorStop(1, 'white');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(10, barY, barWidth, barHeight);
            
            // 绘制阈值标记
            if (range > 0) {
                const thresholdX = 10 + (thresholdValue - minVal) / range * barWidth;
                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.moveTo(thresholdX, barY - 5);
                ctx.lineTo(thresholdX - 5, barY);
                ctx.lineTo(thresholdX + 5, barY);
                ctx.closePath();
                ctx.fill();
            }
            
            // 绘制直方图
            // 计算直方图数据
            const histogramBins = 50; // 直方图的柱数
            const histogram = new Array(histogramBins).fill(0);
            
            // 确保 range 不为 0，避免除以零错误
            if (range > 0) {
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const val = segmentationData[0][y][x];
                        // 跳过无效值
                        if (val === undefined || isNaN(val)) continue;
                        
                        // 计算该值应该落在哪个柱中
                        const binIndex = Math.min(
                            histogramBins - 1,
                            Math.floor(((val - minVal) / range) * histogramBins)
                        );
                        histogram[binIndex]++;
                    }
                }
            }
            
            // 找出直方图的最大值，用于归一化
            const maxBinValue = Math.max(...histogram);
            
            // 绘制直方图
            const histogramHeight = 80;
            const histogramY = barY + barHeight + 10;
            
            ctx.fillStyle = 'rgba(100, 149, 237, 0.7)'; // 淡蓝色
            
            for (let i = 0; i < histogramBins; i++) {
                const binHeight = maxBinValue > 0 
                    ? (histogram[i] / maxBinValue) * histogramHeight 
                    : 0;
                const binWidth = barWidth / histogramBins;
                const binX = 10 + i * binWidth;
                
                ctx.fillRect(binX, histogramY + histogramHeight - binHeight, binWidth - 1, binHeight);
            }
            
            // 在直方图上标记阈值位置
            if (range > 0) {
                const histogramThresholdX = 10 + ((thresholdValue - minVal) / range) * barWidth;
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(histogramThresholdX, histogramY);
                ctx.lineTo(histogramThresholdX, histogramY + histogramHeight);
                ctx.stroke();
            }
            
            // 添加直方图标题
            ctx.fillStyle = 'white';
            ctx.fillText('Histogram', 10, histogramY - 5);
            
        } catch (error) {
            console.error('可视化输出出错:', error);
            
            // 显示错误信息
            ctx.fillStyle = 'red';
            ctx.font = '16px Arial';
            ctx.fillText('可视化出错: ' + error.message, 10, 30);
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
                
                // 如果启用了调试模式，可视化输出
                if (showDebug && debugCanvasRef.current) {
                    await visualizeOutput(segmentation, debugCanvasRef.current);
                }
                
                // 渲染分割结果
                await renderSegmentation(video, maskToRender, canvas);
                
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

    // 组件加载时初始化模型
    useEffect(() => {
        loadModel();
        
        // 组件卸载时清理
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (lastSegmentationRef.current) {
                lastSegmentationRef.current.dispose();
            }
        };
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

    // 透明度调整处理函数
    const handleAlphaChange = (e) => {
        setAlpha(parseFloat(e.target.value));
    };
    
    // 颜色选择处理函数
    const handleColorChange = (e) => {
        setSegmentColor(e.target.value);
    };
    
    // 切换显示原始视频
    const toggleOriginal = () => {
        setShowOriginal(!showOriginal);
    };
    
    // 暂停/继续处理
    const togglePause = () => {
        setIsPaused(!isPaused);
        if (isPaused) {
            // 如果当前是暂停状态，则恢复处理
            processFrame();
        } else {
            // 如果当前是运行状态，则暂停处理
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }
    };
    
    // 下载当前画面
    const downloadImage = () => {
        if (!canvasRef.current) return;
        
        // 暂停处理
        const wasPaused = isPaused;
        if (!wasPaused) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            setIsPaused(true);
        }
        
        try {
            // 创建下载链接
            const link = document.createElement('a');
            link.download = `segmentation-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
            link.href = canvasRef.current.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('下载图片出错:', error);
        }
        
        // 如果之前不是暂停状态，则恢复处理
        if (!wasPaused) {
            setIsPaused(false);
            processFrame();
        }
    };
    
    // 切换调试视图
    const toggleDebug = () => {
        setShowDebug(!showDebug);
    };
    
    // 阈值调整处理函数
    const handleThresholdChange = (e) => {
        setThreshold(parseFloat(e.target.value));
    };
    
    // 切换自动阈值
    const toggleAutoThreshold = () => {
        setAutoThreshold(!autoThreshold);
    };
    
    // 切换二值掩码
    const toggleBinaryMask = () => {
        setUseBinaryMask(!useBinaryMask);
    };

    return (
        <div className="segmentation-container">
            {loading && (
                <div className="loading">
                    <p>自定义分割模型加载中...</p>
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
            
            {showDebug && (
                <div className="debug-container">
                    <h3>调试视图 (原始模型输出)</h3>
                    <canvas
                        ref={debugCanvasRef}
                        width="256"
                        height="144"
                        className="debug-canvas"
                    />
                </div>
            )}
            
            <div className="control-panel">
                <div className="fps-counter">FPS: {fps.toFixed(1)}</div>
                
                <div className="button-controls">
                    <button 
                        className={`control-button ${isPaused ? 'paused' : ''}`}
                        onClick={togglePause}
                    >
                        {isPaused ? '继续' : '暂停'}
                    </button>
                    
                    <button 
                        className="control-button"
                        onClick={downloadImage}
                        disabled={loading}
                    >
                        下载图片
                    </button>
                    
                    <button 
                        className={`control-button ${showDebug ? 'active' : ''}`}
                        onClick={toggleDebug}
                    >
                        {showDebug ? '隐藏调试' : '显示调试'}
                    </button>
                </div>
                
                <div className="slider-control">
                    <label htmlFor="alpha-slider">透明度: {alpha.toFixed(2)}</label>
                    <input
                        id="alpha-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={alpha}
                        onChange={handleAlphaChange}
                    />
                </div>
                
                <div className="color-control">
                    <label htmlFor="color-picker">分割颜色:</label>
                    <input
                        id="color-picker"
                        type="color"
                        value={segmentColor}
                        onChange={handleColorChange}
                    />
                </div>
                
                <div className="toggle-control">
                    <label>
                        <input
                            type="checkbox"
                            checked={showOriginal}
                            onChange={toggleOriginal}
                        />
                        显示原始视频
                    </label>
                </div>
                
                <div className="model-info">
                    <h3>模型信息</h3>
                    <p>类型: 人像分割</p>
                    <p>输入尺寸: 256x144</p>
                    <p>输入格式: NCHW [1,3,256,144]</p>
                    <p>输出尺寸: 256x144</p>
                    <p>输出格式: [1,256,144] int32</p>
                    <p>类别: {CUSTOM_CLASSES[1].name}</p>
                    <p>状态: {modelLoaded ? '已加载' : '加载中'}</p>
                </div>
            </div>
        </div>
    );
};

export default CustomSegmentation; 