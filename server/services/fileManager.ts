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
      path.join(this.mediaDir, 'dropzone'),
      path.join(this.mediaDir, 'dropzone', 'duplicates'),
      path.join(this.mediaDir, 'bronze'),
      path.join(this.mediaDir, 'silver'),
      path.join(this.mediaDir, 'gold'),
      path.join(this.mediaDir, 'archive'),
    ];

    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    }
  }

  async moveToBronze(tempPath: string, originalFilename: string): Promise<string> {
    console.log(`Moving file to Bronze: ${originalFilename} from ${tempPath}`);
    
    // Extract EXIF metadata to determine camera/device and photo date
    let cameraInfo = null;
    let photoDate = new Date(); // fallback to current date
    
    try {
      if (path.extname(originalFilename).toLowerCase().match(/\.(jpg|jpeg|tiff)$/)) {
        const exifData = await this.extractExifData(tempPath);
        cameraInfo = exifData.camera;
        
        // Use photo's actual date from EXIF (prioritize DateTimeOriginal)
        if (exifData.dateTimeOriginal) {
          const parsedDate = new Date(exifData.dateTimeOriginal);
          if (!isNaN(parsedDate.getTime())) {
            photoDate = parsedDate;
            console.log(`Using photo date from EXIF DateTimeOriginal: ${photoDate.toISOString()}`);
          }
        } else if (exifData.createDate) {
          const parsedDate = new Date(exifData.createDate);
          if (!isNaN(parsedDate.getTime())) {
            photoDate = parsedDate;
            console.log(`Using photo date from EXIF CreateDate: ${photoDate.toISOString()}`);
          }
        } else if (exifData.dateTime) {
          const parsedDate = new Date(exifData.dateTime);
          if (!isNaN(parsedDate.getTime())) {
            photoDate = parsedDate;
            console.log(`Using photo date from EXIF DateTime: ${photoDate.toISOString()}`);
          }
        } else {
          console.log(`No EXIF date found for ${originalFilename}, using current date`);
        }
      }
    } catch (error) {
      console.log(`Could not extract EXIF data for ${originalFilename}, using current date`);
    }
    
    // Ensure we have a valid date
    if (isNaN(photoDate.getTime())) {
      photoDate = new Date();
      console.log(`Invalid date detected, using current date: ${photoDate.toISOString()}`);
    }

    // Create hierarchical directory structure using photo's actual date
    const year = photoDate.getFullYear();
    const monthNum = photoDate.getMonth() + 1;
    const monthName = photoDate.toLocaleString('en-US', { month: 'long' });
    const monthFolder = `${String(monthNum).padStart(2, '0')}-${monthName}`;
    
    let deviceFolder = 'unknown_device';
    if (cameraInfo) {
      // Clean camera name for filesystem
      deviceFolder = cameraInfo.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
    }
    
    const batchName = `batch_${year}-${String(monthNum).padStart(2, '0')}-${String(photoDate.getDate()).padStart(2, '0')}`;
    
    // Create directory structure: bronze/YYYY/MM-Month/device/batch_YYYY-MM-DD/
    const batchDir = path.join(
      this.mediaDir, 
      'bronze', 
      String(year), 
      monthFolder, 
      deviceFolder, 
      batchName
    );
    
    console.log(`Target batch directory: ${batchDir}`);

    try {
      await fs.access(batchDir);
    } catch {
      await fs.mkdir(batchDir, { recursive: true });
    }

    // Generate unique filename to avoid conflicts
    const ext = path.extname(originalFilename);
    const name = path.basename(originalFilename, ext);
    const timestamp = Date.now();
    const newFilename = `${name}_${timestamp}${ext}`;
    const bronzePath = path.join(batchDir, newFilename);

    console.log(`Moving ${tempPath} to ${bronzePath}`);
    await fs.rename(tempPath, bronzePath);
    
    const relativePath = path.relative(this.dataDir, bronzePath);
    console.log(`File moved successfully to Bronze: ${relativePath}`);
    
    // Return relative path from data directory
    return relativePath;
  }

  async copyToSilver(bronzePath: string, newFilename?: string, photoDate?: Date): Promise<string> {
    const fullBronzePath = path.join(this.dataDir, bronzePath);
    
    // Use photo's actual date if provided, otherwise fall back to current date
    const date = photoDate || new Date();
    const yearMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const silverDir = path.join(this.mediaDir, 'silver', yearMonth);

    try {
      await fs.access(silverDir);
    } catch {
      await fs.mkdir(silverDir, { recursive: true });
    }

    const filename = newFilename || path.basename(bronzePath);
    let silverPath = path.join(silverDir, filename);
    
    // Check if file already exists and generate unique filename if needed
    let counter = 1;
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);
    
    while (true) {
      try {
        await fs.access(silverPath);
        // File exists, generate new name
        const uniqueFilename = `${nameWithoutExt}_${counter}${ext}`;
        silverPath = path.join(silverDir, uniqueFilename);
        counter++;
      } catch {
        // File doesn't exist, we can use this path
        break;
      }
    }
    
    await fs.copyFile(fullBronzePath, silverPath);
    
    return path.relative(this.dataDir, silverPath);
  }

  async copyToGold(silverPath: string, photoDate?: Date): Promise<string> {
    const fullSilverPath = path.join(this.dataDir, silverPath);
    
    // Use photo's actual date if provided, otherwise fall back to current date
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
        // File exists, generate new name
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

  async moveToDuplicates(tempPath: string, originalFilename: string): Promise<void> {
    const duplicatesDir = path.join(this.mediaDir, 'dropzone', 'duplicates');
    const timestamp = Date.now();
    const ext = path.extname(originalFilename);
    const name = path.basename(originalFilename, ext);
    const duplicateFilename = `${name}_duplicate_${timestamp}${ext}`;
    const duplicatePath = path.join(duplicatesDir, duplicateFilename);

    await fs.rename(tempPath, duplicatePath);
  }

  async extractMetadata(filePath: string): Promise<CombinedMetadata> {
    const fullPath = path.join(this.dataDir, filePath);
    
    try {
      // For now, extract basic file info
      const stats = await fs.stat(fullPath);
      const metadata: CombinedMetadata = {
        exif: {
          dateTime: stats.mtime.toISOString(),
        }
      };

      // Try to extract EXIF data for images
      if (path.extname(fullPath).toLowerCase().match(/\.(jpg|jpeg|tiff)$/)) {
        try {
          const exifData = await this.extractExifData(fullPath);
          metadata.exif = { ...metadata.exif, ...exifData };
        } catch (exifError) {
          console.log(`No EXIF data available for ${filePath}`);
        }
      }

      return metadata;
    } catch (error) {
      console.error(`Error extracting metadata for ${filePath}:`, error);
      return {};
    }
  }

  private async extractExifData(imagePath: string): Promise<ExifMetadata> {
    return new Promise((resolve, reject) => {
      try {
        new ExifImage({ image: imagePath }, (error: any, exifData: any) => {
          if (error) {
            reject(error);
            return;
          }

          const metadata: ExifMetadata = {};

          if (exifData.image) {
            metadata.camera = exifData.image.Make && exifData.image.Model 
              ? `${exifData.image.Make} ${exifData.image.Model}` 
              : undefined;
          }

          if (exifData.exif) {
            // Store all available date/time fields - prioritize DateTimeOriginal as main dateTime
            metadata.dateTime = exifData.exif.DateTimeOriginal || 
                               exifData.exif.CreateDate || 
                               exifData.image?.DateTime;
            
            // Store all date fields for complete information
            metadata.dateTimeOriginal = exifData.exif.DateTimeOriginal;
            metadata.createDate = exifData.exif.CreateDate;
            metadata.modifyDate = exifData.image?.ModifyDate;
            
            metadata.aperture = exifData.exif.FNumber ? `f/${exifData.exif.FNumber}` : undefined;
            metadata.shutter = exifData.exif.ExposureTime ? `1/${Math.round(1/exifData.exif.ExposureTime)}s` : undefined;
            metadata.iso = exifData.exif.ISO ? String(exifData.exif.ISO) : undefined;
            metadata.focalLength = exifData.exif.FocalLength ? `${exifData.exif.FocalLength}mm` : undefined;
            metadata.lens = exifData.exif.LensModel;
          }

          if (exifData.gps) {
            metadata.gpsLatitude = exifData.gps.GPSLatitude ? this.convertDMSToDD(exifData.gps.GPSLatitude, exifData.gps.GPSLatitudeRef) : undefined;
            metadata.gpsLongitude = exifData.gps.GPSLongitude ? this.convertDMSToDD(exifData.gps.GPSLongitude, exifData.gps.GPSLongitudeRef) : undefined;
          }

          resolve(metadata);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private convertDMSToDD(dms: number[], ref: string): number {
    let dd = dms[0] + dms[1]/60 + dms[2]/3600;
    if (ref === "S" || ref === "W") dd = dd * -1;
    return dd;
  }

  getFileUrl(relativePath: string): string {
    return `/api/files/${relativePath}`;
  }
}

export const fileManager = new FileManager();
