import * as faceapi from "@vladmandic/face-api";
import { toViewSrc } from "./tauriApi";

let modelsLoaded = false;

export async function loadModels(baseUrl = "/models"): Promise<void> {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(baseUrl),
    faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl),
    faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl),
  ]);
  modelsLoaded = true;
}

export type LocalDetection = {
  boundingBox: [number, number, number, number];
  embedding: number[];
};

export async function detectFacesOnPath(
  filePath: string,
): Promise<LocalDetection[]> {
  await loadModels();
  const url = await toViewSrc(filePath);
  const img = await loadImage(url);
  const results = await faceapi
    .detectAllFaces(
      img,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  return results.map((r) => {
    const box = r.detection.box;
    return {
      boundingBox: [box.x, box.y, box.width, box.height],
      embedding: Array.from(r.descriptor as Float32Array),
    };
  });
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}
