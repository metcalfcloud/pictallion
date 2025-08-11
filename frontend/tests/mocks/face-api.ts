export const nets = {
  ssdMobilenetv1: { loadFromUri: async (_: string) => {} },
  faceLandmark68Net: { loadFromUri: async (_: string) => {} },
  faceRecognitionNet: { loadFromUri: async (_: string) => {} },
};

export class SsdMobilenetv1Options {
  constructor(public opts: { minConfidence?: number } = {}) {}
}

type DetectionBox = { x: number; y: number; width: number; height: number };
type DetectionResult = { detection: { box: DetectionBox }; descriptor: Float32Array };

export function detectAllFaces(_img: unknown, _opts: SsdMobilenetv1Options) {
  return {
    withFaceLandmarks() {
      return {
        withFaceDescriptors(): DetectionResult[] {
          const box: DetectionBox = { x: 10, y: 10, width: 100, height: 100 };
          const descriptor = new Float32Array(128).fill(0);
          return [{ detection: { box }, descriptor }];
        },
      };
    },
  };
}

