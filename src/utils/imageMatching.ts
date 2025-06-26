import sharp from 'sharp';

export interface ImageFeature {
  hash: string;
  averageColor: { r: number; g: number; b: number };
  edges: number;
  texture: number;
  histogram: number[];
}

export interface MatchResult {
  similarity: number;
  featureDistance: number;
  colorDistance: number;
  edgeSimilarity: number;
  textureSimilarity: number;
}

export class ImageMatcher {
  /**
   * Extract features from an image buffer using Sharp
   */
  static async extractFeatures(imageBuffer: Buffer): Promise<ImageFeature> {
    // Resize to standard size for comparison
    const resizedBuffer = await sharp(imageBuffer)
      .resize(64, 64)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { data, info } = resizedBuffer;
    
    // Calculate perceptual hash
    const hash = this.calculatePerceptualHash(data, info.width, info.height);
    
    // Calculate average color
    const averageColor = this.calculateAverageColor(data, info.width, info.height);
    
    // Calculate edge density
    const edges = this.calculateEdgeDensity(data, info.width, info.height);
    
    // Calculate texture complexity
    const texture = this.calculateTextureComplexity(data, info.width, info.height);
    
    // Calculate color histogram
    const histogram = this.calculateHistogram(data, info.width, info.height);
    
    return {
      hash,
      averageColor,
      edges,
      texture,
      histogram
    };
  }
  
  /**
   * Calculate perceptual hash
   */
  private static calculatePerceptualHash(data: Buffer, width: number, height: number): string {
    // Simple perceptual hash based on average brightness
    let totalBrightness = 0;
    const pixels = width * height;
    
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalBrightness += (r + g + b) / 3;
    }
    
    const averageBrightness = totalBrightness / pixels;
    return averageBrightness.toString(16).padStart(4, '0');
  }
  
  /**
   * Calculate average color of an image
   */
  private static calculateAverageColor(data: Buffer, width: number, height: number): { r: number; g: number; b: number } {
    let r = 0, g = 0, b = 0;
    const pixels = width * height;
    
    for (let i = 0; i < data.length; i += 3) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    
    return {
      r: r / pixels,
      g: g / pixels,
      b: b / pixels
    };
  }
  
  /**
   * Calculate edge density using simple gradient
   */
  private static calculateEdgeDensity(data: Buffer, width: number, height: number): number {
    let edgeSum = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 3;
        
        // Calculate gradient in X direction
        const leftIdx = (y * width + (x - 1)) * 3;
        const rightIdx = (y * width + (x + 1)) * 3;
        const gx = Math.abs(data[rightIdx] - data[leftIdx]);
        
        // Calculate gradient in Y direction
        const topIdx = ((y - 1) * width + x) * 3;
        const bottomIdx = ((y + 1) * width + x) * 3;
        const gy = Math.abs(data[bottomIdx] - data[topIdx]);
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edgeSum += magnitude;
      }
    }
    
    return edgeSum / (width * height);
  }
  
  /**
   * Calculate texture complexity using local variance
   */
  private static calculateTextureComplexity(data: Buffer, width: number, height: number): number {
    let textureSum = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerIdx = (y * width + x) * 3;
        const centerBrightness = (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3;
        
        let variance = 0;
        let count = 0;
        
        // Check 8 neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const neighborIdx = (ny * width + nx) * 3;
              const neighborBrightness = (data[neighborIdx] + data[neighborIdx + 1] + data[neighborIdx + 2]) / 3;
              const diff = Math.abs(centerBrightness - neighborBrightness);
              variance += diff;
              count++;
            }
          }
        }
        
        textureSum += variance / count;
      }
    }
    
    return textureSum / (width * height);
  }
  
  /**
   * Calculate color histogram
   */
  private static calculateHistogram(data: Buffer, width: number, height: number): number[] {
    const histogram = new Array(256).fill(0);
    const pixels = width * height;
    
    for (let i = 0; i < data.length; i += 3) {
      const gray = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
      histogram[gray]++;
    }
    
    // Normalize histogram
    return histogram.map(count => count / pixels);
  }
  
  /**
   * Compare two images and return similarity score
   */
  static async compareImages(image1Buffer: Buffer, image2Buffer: Buffer): Promise<MatchResult> {
    const features1 = await this.extractFeatures(image1Buffer);
    const features2 = await this.extractFeatures(image2Buffer);
    
    // Calculate hash similarity (simple difference)
    const hashDistance = Math.abs(parseInt(features1.hash, 16) - parseInt(features2.hash, 16));
    const hashSimilarity = 1 - (hashDistance / 65535); // Max 16-bit value
    
    // Calculate color distance
    const colorDistance = this.calculateColorDistance(features1.averageColor, features2.averageColor);
    const colorSimilarity = 1 - (colorDistance / 441.67); // Max possible distance
    
    // Calculate edge similarity
    const edgeDistance = Math.abs(features1.edges - features2.edges);
    const edgeSimilarity = 1 - (edgeDistance / Math.max(features1.edges, features2.edges, 1));
    
    // Calculate texture similarity
    const textureDistance = Math.abs(features1.texture - features2.texture);
    const textureSimilarity = 1 - (textureDistance / Math.max(features1.texture, features2.texture, 1));
    
    // Calculate histogram similarity
    const histogramDistance = this.calculateHistogramDistance(features1.histogram, features2.histogram);
    const histogramSimilarity = 1 - histogramDistance;
    
    // Weighted combination of all similarities
    const similarity = (
      hashSimilarity * 0.3 +
      colorSimilarity * 0.2 +
      edgeSimilarity * 0.2 +
      textureSimilarity * 0.15 +
      histogramSimilarity * 0.15
    );
    
    return {
      similarity: Math.max(0, Math.min(1, similarity)),
      featureDistance: hashDistance,
      colorDistance,
      edgeSimilarity: Math.max(0, Math.min(1, edgeSimilarity)),
      textureSimilarity: Math.max(0, Math.min(1, textureSimilarity))
    };
  }
  
  /**
   * Calculate Euclidean distance between two colors
   */
  private static calculateColorDistance(color1: { r: number; g: number; b: number }, 
                                       color2: { r: number; g: number; b: number }): number {
    const dr = color1.r - color2.r;
    const dg = color1.g - color2.g;
    const db = color1.b - color2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
  
  /**
   * Calculate histogram intersection distance
   */
  private static calculateHistogramDistance(hist1: number[], hist2: number[]): number {
    let intersection = 0;
    let union = 0;
    
    for (let i = 0; i < hist1.length; i++) {
      intersection += Math.min(hist1[i], hist2[i]);
      union += Math.max(hist1[i], hist2[i]);
    }
    
    return 1 - (intersection / union);
  }
  
  /**
   * Find best matching visual element from a list of candidates
   */
  static async findBestMatch(targetBuffer: Buffer, candidateBuffers: Buffer[], 
                           threshold: number = 0.7): Promise<{ index: number; similarity: number } | null> {
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (let i = 0; i < candidateBuffers.length; i++) {
      const result = await this.compareImages(targetBuffer, candidateBuffers[i]);
      
      if (result.similarity > bestSimilarity && result.similarity >= threshold) {
        bestSimilarity = result.similarity;
        bestMatch = { index: i, similarity: result.similarity };
      }
    }
    
    return bestMatch;
  }
} 