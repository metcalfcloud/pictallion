import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';

export interface ThumbnailOptions {
  size: number;
  quality: number;
  format?: 'jpeg' | 'webp' | 'png';
}

export class ThumbnailService {
  private cacheDir: string;

  constructor(cacheDir: string = 'uploads/thumbnails') {
    this.cacheDir = cacheDir;
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create thumbnail cache directory:', error);
    }
  }

  private getCacheKey(originalPath: string, options: ThumbnailOptions): string {
    const data = `${originalPath}-${options.size}-${options.quality}-${options.format || 'jpeg'}`;
    return createHash('md5').update(data).digest('hex');
  }

  private getCachePath(cacheKey: string, format: string = 'jpeg'): string {
    return path.join(this.cacheDir, `${cacheKey}.${format}`);
  }

  async generateThumbnail(
    originalPath: string,
    options: ThumbnailOptions
  ): Promise<string> {
    const { size, quality, format = 'jpeg' } = options;
    const cacheKey = this.getCacheKey(originalPath, options);
    const cachePath = this.getCachePath(cacheKey, format);

    try {
      // Check if cached thumbnail exists
      await fs.access(cachePath);
      return cachePath;
    } catch {
      // Generate new thumbnail
      try {
        let sharpInstance = sharp(originalPath)
          .resize(size, size, {
            fit: 'cover',
            position: 'center',
            kernel: sharp.kernel.nearest // Faster resizing
          })
          .jpeg({ 
            quality, 
            progressive: false, // Faster loading
            mozjpeg: true // Better compression
          })

        await sharpInstance.toFile(cachePath);
        return cachePath;
      } catch (error) {
        console.error('Failed to generate thumbnail:', error);
        throw new Error('Failed to generate thumbnail');
      }
    }
  }

  async getThumbnailStream(
    originalPath: string, 
    options: ThumbnailOptions
  ): Promise<NodeJS.ReadableStream> {
    const thumbnailPath = await this.generateThumbnail(originalPath, options);
    const stream = await fs.readFile(thumbnailPath);
    
    // Return a readable stream
    const { Readable } = await import('stream');
    return Readable.from(stream);
  }

  async clearCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
    } catch (error) {
      console.error('Failed to clear thumbnail cache:', error);
    }
  }

  async getCacheStats(): Promise<{ fileCount: number; totalSize: number }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      
      for (const file of files) {
        const stats = await fs.stat(path.join(this.cacheDir, file));
        totalSize += stats.size;
      }

      return {
        fileCount: files.length,
        totalSize
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { fileCount: 0, totalSize: 0 };
    }
  }

  getQualityPreset(preset: 'low' | 'medium' | 'high' | 'thumbnail'): ThumbnailOptions & { width?: number; height?: number } {
    const presets = {
      low: { size: 150, quality: 60, width: 150, height: 150 },
      medium: { size: 300, quality: 80, width: 300, height: 300 },
      high: { size: 600, quality: 95, width: 600, height: 600 },
      thumbnail: { size: 200, quality: 75, width: 200, height: 200 }
    };
    
    return presets[preset] || presets.medium;
  }

  async getThumbnail(originalPath: string, options: ThumbnailOptions & { width?: number; height?: number }): Promise<string> {
    const size = options.width || options.height || options.size;
    return this.generateThumbnail(originalPath, {
      size,
      quality: options.quality,
      format: 'jpeg'
    });
  }
}

// Export singleton instance
export const thumbnailService = new ThumbnailService();