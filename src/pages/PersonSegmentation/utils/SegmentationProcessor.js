import * as bodySegmentation from "@tensorflow-models/body-segmentation";

class SegmentationProcessor {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  async processSegmentation(people) {
    if (!people.length) return null;

    try {
      const mask = await this.createMask(people);
      const { centerX, centerY, count } = this.calculateCenter(mask);

      if (count > 0) {
        // 将坐标转换为 Three.js 坐标系统
        const x = (centerX / this.width) * 2 - 1;
        const y = -(centerY / this.height) * 2 + 1;

        // 计算人物大小比例
        const personSize = Math.sqrt(count / (this.width * this.height));
        const scale = Math.max(0.3, Math.min(1, personSize * 2));

        return {
          position: { x, y },
          scale,
        };
      }
    } catch (error) {
      console.error("处理分割结果时出错:", error);
    }

    return null;
  }

  async createMask(people) {
    const foregroundColor = { r: 255, g: 255, b: 255, a: 255 };
    const backgroundColor = { r: 0, g: 0, b: 0, a: 0 };
    return await bodySegmentation.toBinaryMask(
      people,
      foregroundColor,
      backgroundColor
    );
  }

  calculateCenter(mask) {
    let centerX = 0;
    let centerY = 0;
    let count = 0;

    const maskData = mask.data;
    for (let i = 0; i < maskData.length; i += 4) {
      if (maskData[i] === 255) {
        // 如果是前景（人物）
        const pixelIndex = i / 4;
        const x = pixelIndex % this.width;
        const y = Math.floor(pixelIndex / this.width);
        centerX += x;
        centerY += y;
        count++;
      }
    }

    if (count > 0) {
      centerX /= count;
      centerY /= count;
    }

    return { centerX, centerY, count };
  }
}

export default SegmentationProcessor;
