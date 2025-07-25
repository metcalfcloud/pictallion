import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
// @ts-ignore - piexifjs doesn't have type definitions
import piexifjs from "piexifjs";
import type { FileVersion, CombinedMetadata, AIMetadata, ExifMetadata } from "@shared/schema";

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
    fileVersion: FileVersion, 
    metadata: CombinedMetadata,
    options: EmbeddingOptions = {}
  ): Promise<string> {
    const { preserveOriginal = true, outputPath, embedInPlace = false } = options;
    
    try {
      const inputPath = fileVersion.filePath;
      const outputFilePath = outputPath || (embedInPlace ? inputPath : this.generateGoldPath(fileVersion));
      
      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
      
      if (this.isImageFile(fileVersion.mimeType)) {
        return await this.embedImageMetadata(inputPath, outputFilePath, metadata, fileVersion);
      } else if (this.isVideoFile(fileVersion.mimeType)) {
        return await this.embedVideoMetadata(inputPath, outputFilePath, metadata, fileVersion);
      } else {
        throw new Error(`Unsupported file type for metadata embedding: ${fileVersion.mimeType}`);
      }
    } catch (error: any) {
      console.error("Metadata embedding failed:", error);
      throw new Error(`Failed to embed metadata: ${error.message}`);
    }
  }

  /**
   * Embed metadata into image files using EXIF/XMP
   */
  private async embedImageMetadata(
    inputPath: string, 
    outputPath: string, 
    metadata: CombinedMetadata,
    fileVersion: FileVersion
  ): Promise<string> {
    // Read the original image
    const imageBuffer = await fs.readFile(inputPath);
    
    // Check if it's a JPEG (piexifjs only works with JPEG)
    if (fileVersion.mimeType === "image/jpeg") {
      return await this.embedJpegMetadata(imageBuffer, outputPath, metadata, fileVersion);
    } else {
      // For other formats, use Sharp to convert to JPEG with metadata
      return await this.embedNonJpegMetadata(inputPath, outputPath, metadata, fileVersion);
    }
  }

  /**
   * Embed metadata into JPEG files using piexifjs
   */
  private async embedJpegMetadata(
    imageBuffer: Buffer,
    outputPath: string,
    metadata: CombinedMetadata,
    fileVersion: FileVersion
  ): Promise<string> {
    try {
      // Convert buffer to base64 for piexifjs
      const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
      
      // Create EXIF data object
      const exifObj = this.createExifObject(metadata, fileVersion);
      
      // Convert EXIF object to bytes
      const exifBytes = piexifjs.dump(exifObj);
      
      // Insert EXIF data into image
      const newImageDataUrl = piexifjs.insert(exifBytes, imageDataUrl);
      
      // Convert back to buffer and save
      const base64Data = newImageDataUrl.replace(/^data:image\/jpeg;base64,/, '');
      const newImageBuffer = Buffer.from(base64Data, 'base64');
      
      await fs.writeFile(outputPath, newImageBuffer);
      
      console.log(`Successfully embedded metadata into JPEG: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error("JPEG metadata embedding failed:", error);
      // Fallback to copying without embedding
      const inputBuffer = await fs.readFile(inputPath);
      await fs.writeFile(outputPath, inputBuffer);
      return outputPath;
    }
  }

  /**
   * Embed metadata into non-JPEG images using Sharp
   */
  private async embedNonJpegMetadata(
    inputPath: string,
    outputPath: string,
    metadata: CombinedMetadata,
    fileVersion: FileVersion
  ): Promise<string> {
    try {
      const exifObj = this.createExifObject(metadata, fileVersion);
      const exifBuffer = Buffer.from(piexifjs.dump(exifObj), 'binary');

      await sharp(inputPath)
        .withExif(exifObj)
        .jpeg({ quality: 95 }) // Convert to JPEG to embed EXIF
        .toFile(outputPath.replace(/\.[^.]+$/, '.jpg'));

      console.log(`Successfully embedded metadata into image: ${outputPath}`);
      return outputPath.replace(/\.[^.]+$/, '.jpg');
    } catch (error) {
      console.error("Non-JPEG metadata embedding failed:", error);
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

    // Basic image description
    if (metadata.ai?.longDescription) {
      exifObj["0th"][piexifjs.ImageIFD.ImageDescription] = metadata.ai.longDescription;
      exifObj["0th"][piexifjs.ImageIFD.XPComment] = this.stringToUTF16(metadata.ai.longDescription);
    }

    if (metadata.ai?.shortDescription) {
      exifObj["0th"][piexifjs.ImageIFD.XPSubject] = this.stringToUTF16(metadata.ai.shortDescription);
    }

    // Keywords/Tags
    if (metadata.ai?.aiTags && metadata.ai.aiTags.length > 0) {
      const keywords = metadata.ai.aiTags.join(';');
      exifObj["0th"][piexifjs.ImageIFD.XPKeywords] = this.stringToUTF16(keywords);
    }

    // Additional keywords from database
    if (fileVersion.keywords && fileVersion.keywords.length > 0) {
      const allKeywords = [...(metadata.ai?.aiTags || []), ...fileVersion.keywords].join(';');
      exifObj["0th"][piexifjs.ImageIFD.XPKeywords] = this.stringToUTF16(allKeywords);
    }

    // Rating
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

    // GPS data
    if (metadata.ai?.gpsCoordinates) {
      const { latitude, longitude } = metadata.ai.gpsCoordinates;
      exifObj["GPS"] = this.createGPSExif(latitude, longitude);
    }

    // Software signature
    exifObj["0th"][piexifjs.ImageIFD.Software] = "Pictallion Photo Manager";

    // Custom metadata in UserComment (JSON format)
    const customMetadata = {
      eventType: fileVersion.eventType,
      eventName: fileVersion.eventName,
      location: fileVersion.location,
      perceptualHash: fileVersion.perceptualHash,
      aiConfidence: metadata.ai?.aiConfidenceScores,
      detectedObjects: metadata.ai?.detectedObjects,
      detectedEvents: metadata.ai?.detectedEvents
    };

    exifObj["Exif"][piexifjs.ExifIFD.UserComment] = this.encodeUserComment(JSON.stringify(customMetadata));

    return exifObj;
  }

  /**
   * Handle video metadata embedding (sidecar files)
   */
  private async embedVideoMetadata(
    inputPath: string,
    outputPath: string,
    metadata: CombinedMetadata,
    fileVersion: FileVersion
  ): Promise<string> {
    // Copy video file
    await fs.copyFile(inputPath, outputPath);
    
    // Create XMP sidecar file
    const xmpPath = outputPath + '.xmp';
    const xmpContent = this.createXMPSidecar(metadata, fileVersion);
    await fs.writeFile(xmpPath, xmpContent);
    
    // Create JSON metadata sidecar
    const jsonPath = outputPath + '.json';
    const jsonMetadata = {
      ...metadata,
      rating: fileVersion.rating,
      keywords: fileVersion.keywords,
      eventType: fileVersion.eventType,
      eventName: fileVersion.eventName,
      location: fileVersion.location,
      perceptualHash: fileVersion.perceptualHash
    };
    await fs.writeFile(jsonPath, JSON.stringify(jsonMetadata, null, 2));
    
    console.log(`Successfully created video metadata sidecars: ${xmpPath}, ${jsonPath}`);
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
    } catch (error) {
      console.error("Failed to extract embedded metadata:", error);
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
        exif: this.parseExifData(exifObj),
        ai: this.parseAIData(exifObj)
      };
      
      return metadata;
    } catch (error) {
      console.error("Failed to extract image metadata:", error);
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
    } catch (error) {
      console.error("Failed to extract video metadata:", error);
      return null;
    }
  }

  // Utility methods
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
    // ASCII encoding identifier + actual comment
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
      camera: exifObj["0th"]?.[piexifjs.ImageIFD.Make],
      lens: exifObj["Exif"]?.[piexifjs.ExifIFD.LensModel],
      dateTime: exifObj["0th"]?.[piexifjs.ImageIFD.DateTime],
      // Add more EXIF parsing as needed
    };
  }

  private parseAIData(exifObj: any): AIMetadata | undefined {
    try {
      const userComment = exifObj["Exif"]?.[piexifjs.ExifIFD.UserComment];
      if (userComment && userComment.startsWith("ASCII\0\0\0")) {
        const jsonStr = userComment.substring(8);
        const customData = JSON.parse(jsonStr);
        
        return {
          aiTags: [],
          shortDescription: "",
          longDescription: "",
          detectedObjects: customData.detectedObjects || [],
          detectedEvents: customData.detectedEvents || [],
          perceptualHash: customData.perceptualHash,
          aiConfidenceScores: customData.aiConfidence || {}
        };
      }
    } catch (error) {
      console.error("Failed to parse AI data from EXIF:", error);
    }
    return undefined;
  }
}

export const metadataEmbedding = new MetadataEmbeddingService();