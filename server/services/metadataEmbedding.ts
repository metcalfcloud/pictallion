import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import piexifjs from "piexifjs";
import type { FileVersion, CombinedMetadata, AIMetadata, ExifMetadata } from "@shared/schema";
import { error, info } from "@shared/logger";

export interface EmbeddingOptions {
  preserveOriginal?: boolean;
  outputPath?: string;
  embedInPlace?: boolean;
}

class MetadataEmbeddingService {
  
  /**
   * Embed metadata into image file using EXIF/XMP standards
   */
  async embedMetadataToFile(
  ): Promise<string> {
    const { preserveOriginal = true, outputPath, embedInPlace = false } = options;
    
    try {
      const inputPath = fileVersion.filePath;
      const outputFilePath = outputPath || (embedInPlace ? inputPath : this.generateGoldPath(fileVersion));
      
      await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
      
      if (this.isImageFile(fileVersion.mimeType)) {
        return await this.embedImageMetadata(inputPath, outputFilePath, metadata, fileVersion);
      } else if (this.isVideoFile(fileVersion.mimeType)) {
        return await this.embedVideoMetadata(inputPath, outputFilePath, metadata, fileVersion);
      } else {
        throw new Error(`Unsupported file type for metadata embedding: ${fileVersion.mimeType}`);
      }
    } catch (err: any) {
      error("Metadata embedding failed", "MetadataEmbedding", { error: err.message, fileVersion: fileVersion.id });
      throw new Error(`Failed to embed metadata: ${err.message}`);
    }
  }

  /**
   * Embed metadata into image files using EXIF/XMP
   */
  private async embedImageMetadata(
  ): Promise<string> {
    const imageBuffer = await fs.readFile(inputPath);
    
    // Check if it's a JPEG (piexifjs only works with JPEG)
    if (fileVersion.mimeType === "image/jpeg") {
      return await this.embedJpegMetadata(imageBuffer, outputPath, metadata, fileVersion);
    } else {
      return await this.embedNonJpegMetadata(inputPath, outputPath, metadata, fileVersion);
    }
  }

  /**
   * Embed metadata into JPEG files using piexifjs
   */
  private async embedJpegMetadata(
  ): Promise<string> {
    try {
      const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
      
      const exifObj = this.createExifObject(metadata, fileVersion);
      
      const exifBytes = piexifjs.dump(exifObj);
      
      const newImageDataUrl = piexifjs.insert(exifBytes, imageDataUrl);
      
      const base64Data = newImageDataUrl.replace(/^data:image\/jpeg;base64,/, '');
      const newImageBuffer = Buffer.from(base64Data, 'base64');
      
      await fs.writeFile(outputPath, newImageBuffer);
      
      info(`Successfully embedded metadata into JPEG: ${outputPath}`, "MetadataEmbedding");
      return outputPath;
    } catch (embedError) {
      error("JPEG metadata embedding failed", "MetadataEmbedding", { error: embedError, outputPath });
      const inputBuffer = await fs.readFile(fileVersion.filePath);
      await fs.writeFile(outputPath, inputBuffer);
      return outputPath;
    }
  }

  /**
   * Embed metadata into non-JPEG images using Sharp
   */
  private async embedNonJpegMetadata(
  ): Promise<string> {
    try {
      const exifObj = this.createExifObject(metadata, fileVersion);
      const exifBuffer = Buffer.from(piexifjs.dump(exifObj), 'binary');

      await sharp(inputPath)
        .withExif(exifObj)
        .jpeg({ quality: 95 }) // Convert to JPEG to embed EXIF
        .toFile(outputPath.replace(/\.[^.]+$/, '.jpg'));

      info(`Successfully embedded metadata into image: ${outputPath}`, "MetadataEmbedding");
      return outputPath.replace(/\.[^.]+$/, '.jpg');
    } catch (embedError) {
      error("Non-JPEG metadata embedding failed", "MetadataEmbedding", { error: embedError, outputPath });
      // Fallback to copying original
      await fs.copyFile(inputPath, outputPath);
      return outputPath;
    }
  }

  /**
   * Create EXIF object from metadata
   */
  private createExifObject(metadata: CombinedMetadata, fileVersion: FileVersion): any {
    const exifObj: any = {
      "0th": {},
      "Exif": {},
      "GPS": {},
      "1st": {},
      "thumbnail": null
    };

    if (metadata.ai?.longDescription) {
      exifObj["0th"][piexifjs.ImageIFD.ImageDescription] = metadata.ai.longDescription;
      exifObj["0th"][piexifjs.ImageIFD.XPComment] = this.stringToUTF16(metadata.ai.longDescription);
    }

    if (metadata.ai?.shortDescription) {
      exifObj["0th"][piexifjs.ImageIFD.XPSubject] = this.stringToUTF16(metadata.ai.shortDescription);
    }

    if (metadata.ai?.aiTags && metadata.ai.aiTags.length > 0) {
      const keywords = metadata.ai.aiTags.join(';');
      exifObj["0th"][piexifjs.ImageIFD.XPKeywords] = this.stringToUTF16(keywords);
    }

    if (fileVersion.keywords && fileVersion.keywords.length > 0) {
      const allKeywords = [...(metadata.ai?.aiTags || []), ...fileVersion.keywords].join(';');
      exifObj["0th"][piexifjs.ImageIFD.XPKeywords] = this.stringToUTF16(allKeywords);
    }

    if (fileVersion.rating && fileVersion.rating > 0) {
      exifObj["0th"][piexifjs.ImageIFD.Rating] = fileVersion.rating;
    }

    // Artist (people in photo)
    if (metadata.ai?.detectedFaces && metadata.ai.detectedFaces.length > 0) {
      const peopleNames = metadata.ai.detectedFaces
        .filter(face => face.personName)
        .map(face => face.personName!)
        .join(', ');
      if (peopleNames) {
        exifObj["0th"][piexifjs.ImageIFD.Artist] = peopleNames;
        exifObj["0th"][piexifjs.ImageIFD.XPAuthor] = this.stringToUTF16(peopleNames);
      }
    }

    if (metadata.ai?.gpsCoordinates) {
      const { latitude, longitude } = metadata.ai.gpsCoordinates;
      exifObj["GPS"] = this.createGPSExif(latitude, longitude);
    }

    exifObj["0th"][piexifjs.ImageIFD.Software] = "Pictallion Photo Manager";

    // Custom metadata in UserComment (JSON format)
    const customMetadata = {
    };

    exifObj["Exif"][piexifjs.ExifIFD.UserComment] = this.encodeUserComment(JSON.stringify(customMetadata));

    return exifObj;
  }

  /**
   * Handle video metadata embedding (sidecar files)
   */
  private async embedVideoMetadata(
  ): Promise<string> {
    await fs.copyFile(inputPath, outputPath);
    
    const xmpPath = outputPath + '.xmp';
    const xmpContent = this.createXMPSidecar(metadata, fileVersion);
    await fs.writeFile(xmpPath, xmpContent);
    
    const jsonPath = outputPath + '.json';
    const jsonMetadata = {
      ...metadata,
    };
    await fs.writeFile(jsonPath, JSON.stringify(jsonMetadata, null, 2));
    
    info(`Successfully created video metadata sidecars: ${xmpPath}, ${jsonPath}`, "MetadataEmbedding");
    return outputPath;
  }

  /**
   * Extract metadata from Gold tier files for database reconstruction
   */
  async extractEmbeddedMetadata(filePath: string): Promise<CombinedMetadata | null> {
    try {
      const buffer = await fs.readFile(filePath);
      
      if (this.isImageFile(this.getMimeTypeFromPath(filePath))) {
        return await this.extractImageMetadata(buffer);
      } else if (this.isVideoFile(this.getMimeTypeFromPath(filePath))) {
        return await this.extractVideoMetadata(filePath);
      }
      
      return null;
    } catch (err) {
      error("Failed to extract embedded metadata", "MetadataEmbedding", { error: err, filePath });
      return null;
    }
  }

  /**
   * Extract metadata from image files
   */
  private async extractImageMetadata(imageBuffer: Buffer): Promise<CombinedMetadata | null> {
    try {
      const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
      const exifObj = piexifjs.load(imageDataUrl);
      
      const metadata: CombinedMetadata = {
      };
      
      return metadata;
    } catch (err) {
      error("Failed to extract image metadata", "MetadataEmbedding", { error: err });
      return null;
    }
  }

  /**
   * Extract metadata from video sidecar files
   */
  private async extractVideoMetadata(videoPath: string): Promise<CombinedMetadata | null> {
    try {
      const jsonPath = videoPath + '.json';
      const jsonContent = await fs.readFile(jsonPath, 'utf8');
      return JSON.parse(jsonContent) as CombinedMetadata;
    } catch (err) {
      error("Failed to extract video metadata", "MetadataEmbedding", { error: err });
      return null;
    }
  }

  private generateGoldPath(fileVersion: FileVersion): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const filename = path.basename(fileVersion.filePath);
    return path.join(process.cwd(), 'data', 'media', 'gold', String(year), month, filename);
  }

  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private isVideoFile(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  private getMimeTypeFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.tiff': 'image/tiff',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/avi'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private stringToUTF16(str: string): number[] {
    const utf16 = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      utf16.push(code & 0xFF, (code >> 8) & 0xFF);
    }
    utf16.push(0, 0); // null terminator
    return utf16;
  }

  private encodeUserComment(comment: string): string {
    return "ASCII\0\0\0" + comment;
  }

  private createGPSExif(latitude: number, longitude: number): any {
    const latRef = latitude >= 0 ? 'N' : 'S';
    const lonRef = longitude >= 0 ? 'E' : 'W';
    
    const latDegrees = this.decimalToDMS(Math.abs(latitude));
    const lonDegrees = this.decimalToDMS(Math.abs(longitude));
    
    return {
      [piexifjs.GPSIFD.GPSLatitudeRef]: latRef,
      [piexifjs.GPSIFD.GPSLatitude]: latDegrees,
      [piexifjs.GPSIFD.GPSLongitudeRef]: lonRef,
      [piexifjs.GPSIFD.GPSLongitude]: lonDegrees,
    };
  }

  private decimalToDMS(decimal: number): [[number, number], [number, number], [number, number]] {
    const degrees = Math.floor(decimal);
    const minutes = Math.floor((decimal - degrees) * 60);
    const seconds = ((decimal - degrees) * 60 - minutes) * 60;
    
    return [
      [degrees, 1],
      [minutes, 1],
      [Math.round(seconds * 1000), 1000]
    ];
  }

  private createXMPSidecar(metadata: CombinedMetadata, fileVersion: FileVersion): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="">
      <dc:description xmlns:dc="http://purl.org/dc/elements/1.1/">${metadata.ai?.longDescription || ''}</dc:description>
      <dc:subject xmlns:dc="http://purl.org/dc/elements/1.1/">
        <rdf:Bag>
          ${(metadata.ai?.aiTags || []).map(tag => `<rdf:li>${tag}</rdf:li>`).join('\n          ')}
        </rdf:Bag>
      </dc:subject>
      <xmp:Rating xmlns:xmp="http://ns.adobe.com/xap/1.0/">${fileVersion.rating || 0}</xmp:Rating>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
  }

  private parseExifData(exifObj: any): ExifMetadata {
    return {
    };
  }

  private parseAIData(exifObj: any): AIMetadata | undefined {
    try {
      const userComment = exifObj["Exif"]?.[piexifjs.ExifIFD.UserComment];
      if (userComment && userComment.startsWith("ASCII\0\0\0")) {
        const jsonStr = userComment.substring(8);
        const customData = JSON.parse(jsonStr);
        
        return {
        };
      }
    } catch (err) {
      error("Failed to parse AI data from EXIF", "MetadataEmbedding", { error: err });
    }
    return undefined;
  }
}

export const metadataEmbedding = new MetadataEmbeddingService();