import fs from "fs/promises";
import path from "path";
import ExifImage from "exif";
import type { ExifMetadata, CombinedMetadata } from "@shared/schema";

class FileManager {
  private dataDir = path.join(process.cwd(), 'data');
  private mediaDir = path.join(this.dataDir, 'media');

  async initializeDirectories(): Promise<void> {
    const dirs = [
      this.dataDir,
      this.mediaDir,
      path.join(this.mediaDir, 'silver'),
      path.join(this.mediaDir, 'gold'),
      path.join(this.mediaDir, 'archive'),
    ];

    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        // Removed // Created directory: ${dir}`);
      }
    }
  }

  async processToSilver(tempPath: string, originalFilename: string): Promise<string> {
    // Removed // Processing file directly to Silver: ${originalFilename} from ${tempPath}`);
    
    let photoDate: Date | null = null;
    
    try {
      if (path.extname(originalFilename).toLowerCase().match(/\.(jpg|jpeg|tiff)$/)) {
        const exifData = await this.extractExifData(tempPath);
        
        
        // Use photo's actual date from EXIF (prioritize DateTimeOriginal)
        if (exifData.dateTimeOriginal) {
          photoDate = this.parseExifDate(exifData.dateTimeOriginal);
          if (photoDate) {
            // Removed // Using photo date from EXIF DateTimeOriginal: ${photoDate.toISOString()}`);
          }
        }
        
        if (!photoDate && exifData.createDate) {
          photoDate = this.parseExifDate(exifData.createDate);
          if (photoDate) {
            // Removed // Using photo date from EXIF CreateDate: ${photoDate.toISOString()}`);
          }
        }
        
        if (!photoDate && exifData.dateTime) {
          photoDate = this.parseExifDate(exifData.dateTime);
          if (photoDate) {
            // Removed // Using photo date from EXIF DateTime: ${photoDate.toISOString()}`);
          }
        }
      }
    } catch (error) {
      // Removed // Could not extract EXIF data for ${originalFilename}:`, error);
    }
    
    // Try to extract from filename if no EXIF date found
    if (!photoDate) {
      photoDate = this.extractDateFromFilename(originalFilename);
      if (photoDate) {
        // Removed // Using date extracted from filename: ${photoDate.toISOString()}`);
      }
    }
    
    // Fall back to current date only if no date could be extracted
    if (!photoDate) {
      photoDate = new Date();
      // Removed // No date found in EXIF or filename, using current date: ${photoDate.toISOString()}`);
    }

    const year = photoDate.getFullYear();
    const month = String(photoDate.getMonth() + 1).padStart(2, '0');
    const silverDir = path.join(this.mediaDir, 'silver', String(year), month);
    
    // Removed // Target Silver directory: ${silverDir}`);

    try {
      await fs.access(silverDir);
    } catch {
      await fs.mkdir(silverDir, { recursive: true });
    }

    let silverPath = path.join(silverDir, originalFilename);
    
    // Check if file already exists and generate unique filename if needed
    try {
      await fs.access(silverPath);
      const ext = path.extname(originalFilename);
      const name = path.basename(originalFilename, ext);
      const timestamp = Date.now();
      const newFilename = `${name}_${timestamp}${ext}`;
      silverPath = path.join(silverDir, newFilename);
    } catch {
    }

    // Removed // Moving ${tempPath} to ${silverPath}`);
    await fs.rename(tempPath, silverPath);
    
    const relativePath = path.relative(this.dataDir, silverPath);
    // Removed // File moved successfully to Silver: ${relativePath}`);
    
    // Return relative path from data directory
    return relativePath;
  }

  async copyToSilver(sourcePath: string, newFilename?: string, photoDate?: Date): Promise<string> {
    const fullSourcePath = path.join(this.dataDir, sourcePath);
    
    const date = photoDate || new Date();
    const yearMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const silverDir = path.join(this.mediaDir, 'silver', yearMonth);

    try {
      await fs.access(silverDir);
    } catch {
      await fs.mkdir(silverDir, { recursive: true });
    }

    const filename = newFilename || path.basename(sourcePath);
    let silverPath = path.join(silverDir, filename);
    
    // Check if file already exists and generate unique filename if needed
    let counter = 1;
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);
    
    while (true) {
      try {
        await fs.access(silverPath);
        const uniqueFilename = `${nameWithoutExt}_${counter}${ext}`;
        silverPath = path.join(silverDir, uniqueFilename);
        counter++;
      } catch {
        // File doesn't exist, we can use this path
        break;
      }
    }
    
    await fs.copyFile(fullSourcePath, silverPath);
    
    return path.relative(this.dataDir, silverPath);
  }

  async copyToGold(silverPath: string, photoDate?: Date): Promise<string> {
    const fullSilverPath = path.join(this.dataDir, silverPath);
    
    const date = photoDate || new Date();
    const yearMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const goldDir = path.join(this.mediaDir, 'gold', yearMonth);

    try {
      await fs.access(goldDir);
    } catch {
      await fs.mkdir(goldDir, { recursive: true });
    }

    const filename = path.basename(silverPath);
    let goldPath = path.join(goldDir, filename);
    
    // Check if file already exists and generate unique filename if needed
    let counter = 1;
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);
    
    while (true) {
      try {
        await fs.access(goldPath);
        const uniqueFilename = `${nameWithoutExt}_${counter}${ext}`;
        goldPath = path.join(goldDir, uniqueFilename);
        counter++;
      } catch {
        // File doesn't exist, we can use this path
        break;
      }
    }
    
    await fs.copyFile(fullSilverPath, goldPath);
    
    return path.relative(this.dataDir, goldPath);
  }

  async extractMetadata(filePath: string): Promise<CombinedMetadata> {
    const fullPath = path.join(this.dataDir, filePath);
    
    try {
      // For now, extract basic file info
      const stats = await fs.stat(fullPath);
      const metadata: CombinedMetadata = {
        fileSize: stats.size,
        lastModified: stats.mtime,
        dimensions: { width: 0, height: 0 }
      };

      if (path.extname(fullPath).toLowerCase().match(/\.(jpg|jpeg|tiff)$/)) {
        try {
          const exifData = await this.extractExifData(fullPath);
          metadata.exif = { ...metadata.exif, ...exifData };
        } catch (exifError) {
          // Removed // No EXIF data available for ${filePath}`);
        }
      }

      return metadata;
    } catch (error) {
      // error(`Error extracting metadata for ${filePath}:`, error);
      return {};
    }
  }

  private async extractExifData(imagePath: string): Promise<ExifMetadata> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('EXIF extraction timeout'));
      }, 10000);

      try {
        new ExifImage({ image: imagePath }, (error: any, exifData: any) => {
          clearTimeout(timeout);
          
          if (error) {
            // Removed // EXIF extraction error for ${imagePath}:`, error.message);
            reject(error);
            return;
          }

          try {
            const metadata: ExifMetadata = {};

            if (exifData.image) {
              const make = this.safeGetStringField(exifData.image.Make || exifData.image.make);
              const model = this.safeGetStringField(exifData.image.Model || exifData.image.model);
              
              if (make && model) {
                metadata.camera = `${make} ${model}`;
              } else if (make) {
                metadata.camera = make;
              } else if (model) {
                metadata.camera = model;
              }
              
              // Log camera detection for imagePath
            }

            if (exifData.exif) {
              const dateTimeOriginal = this.safeGetStringField(exifData.exif.DateTimeOriginal);
              const createDate = this.safeGetStringField(exifData.exif.CreateDate);
              const dateTime = this.safeGetStringField(exifData.image?.DateTime);
              
              metadata.dateTime = dateTimeOriginal || createDate || dateTime;
              metadata.dateTimeOriginal = dateTimeOriginal;
              metadata.createDate = createDate;
              metadata.modifyDate = this.safeGetStringField(exifData.image?.ModifyDate);
              
              metadata.aperture = this.formatAperture(exifData.exif.FNumber);
              metadata.shutter = this.formatShutter(exifData.exif.ExposureTime);
              metadata.iso = this.safeGetNumberField(exifData.exif.ISO);
              metadata.focalLength = this.formatFocalLength(exifData.exif.FocalLength);
              metadata.lens = this.safeGetStringField(exifData.exif.LensModel);
            }

            if (exifData.gps && this.isValidGpsData(exifData.gps)) {
              try {
                metadata.gpsLatitude = exifData.gps.GPSLatitude ? 
                  this.convertDMSToDD(exifData.gps.GPSLatitude, exifData.gps.GPSLatitudeRef) : undefined;
                metadata.gpsLongitude = exifData.gps.GPSLongitude ? 
                  this.convertDMSToDD(exifData.gps.GPSLongitude, exifData.gps.GPSLongitudeRef) : undefined;
              } catch (gpsError) {
                // Removed // GPS extraction error for ${imagePath}:`, gpsError);
              }
            }

            resolve(metadata);
          } catch (processingError) {
            // error(`Error processing EXIF data for ${imagePath}:`, processingError);
            resolve({}); // Return empty metadata instead of rejecting
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private safeGetStringField(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    const str = String(value).trim();
    return str.length > 0 ? str : undefined;
  }

  private safeGetNumberField(value: any): string | undefined {
    if (value === null || value === undefined || isNaN(Number(value))) return undefined;
    return String(value);
  }

  private formatAperture(fNumber: any): string | undefined {
    if (fNumber === null || fNumber === undefined || isNaN(Number(fNumber))) return undefined;
    return `f/${Number(fNumber).toFixed(1)}`;
  }

  private formatShutter(exposureTime: any): string | undefined {
    if (exposureTime === null || exposureTime === undefined || isNaN(Number(exposureTime))) return undefined;
    const time = Number(exposureTime);
    if (time >= 1) return `${time}s`;
    return `1/${Math.round(1/time)}s`;
  }

  private formatFocalLength(focalLength: any): string | undefined {
    if (focalLength === null || focalLength === undefined || isNaN(Number(focalLength))) return undefined;
    return `${Number(focalLength)}mm`;
  }

  private isValidGpsData(gps: any): boolean {
    return gps && 
           Array.isArray(gps.GPSLatitude) && gps.GPSLatitude.length === 3 &&
           Array.isArray(gps.GPSLongitude) && gps.GPSLongitude.length === 3 &&
           typeof gps.GPSLatitudeRef === 'string' &&
           typeof gps.GPSLongitudeRef === 'string';
  }

  private convertDMSToDD(dms: number[], ref: string): number {
    if (!Array.isArray(dms) || dms.length !== 3) {
      throw new Error('Invalid DMS array format');
    }
    
    const [degrees, minutes, seconds] = dms.map(Number);
    
    if (isNaN(degrees) || isNaN(minutes) || isNaN(seconds)) {
      throw new Error('Invalid DMS numeric values');
    }
    
    if (minutes >= 60 || seconds >= 60 || degrees < 0 || minutes < 0 || seconds < 0) {
      throw new Error('Invalid DMS value ranges');
    }
    
    let dd = degrees + minutes/60 + seconds/3600;
    
    if (ref === "S" || ref === "W") {
      dd = dd * -1;
    }
    
    const isLatitude = ref === "N" || ref === "S";
    const maxValue = isLatitude ? 90 : 180;
    
    if (Math.abs(dd) > maxValue) {
      throw new Error(`Invalid ${isLatitude ? 'latitude' : 'longitude'} value: ${dd}`);
    }
    
    return Math.round(dd * 1000000) / 1000000; // Round to 6 decimal places
  }

  private parseExifDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    try {
      // EXIF dates are typically in format "YYYY:MM:DD HH:MM:SS"
      const normalizedDate = dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const parsedDate = new Date(normalizedDate);
      
      if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900 && parsedDate.getFullYear() < 2100) {
        return parsedDate;
      }
    } catch (error) {
    }
    
    return null;
  }

  private extractDateFromFilename(filename: string): Date | null {
    try {
      // Try to extract from filename if it has timestamp format (YYYYMMDD_HHMMSS)
      const timestampMatch = filename.match(/^(\d{8})_(\d{6})/);
      if (timestampMatch) {
        const dateStr = timestampMatch[1]; // YYYYMMDD
        const timeStr = timestampMatch[2]; // HHMMSS
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(dateStr.substring(6, 8));
        const hour = parseInt(timeStr.substring(0, 2));
        const minute = parseInt(timeStr.substring(2, 4));
        const second = parseInt(timeStr.substring(4, 6));

        const extractedDate = new Date(year, month, day, hour, minute, second);
        if (!isNaN(extractedDate.getTime()) && extractedDate.getFullYear() > 1900) {
          return extractedDate;
        }
      }
    } catch (error) {
    }
    
    return null;
  }

  getFileUrl(relativePath: string): string {
    return `/api/files/${relativePath}`;
  }
}

export const fileManager = new FileManager();
