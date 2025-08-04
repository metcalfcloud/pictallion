declare module 'exif' {
  interface ExifImageConstructor {
    new (options: { image: string }, callback: (error: any, exifData: any) => void): any;
  }
  
  const ExifImage: ExifImageConstructor;
  export default ExifImage;
}