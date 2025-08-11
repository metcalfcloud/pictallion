export const nets = {
  ssdMobilenetv1: {
    loadFromUri: async (path: string) => {
      void path;
    },
  },
  faceLandmark68Net: {
    loadFromUri: async (path: string) => {
      void path;
    },
  },
  faceRecognitionNet: {
    loadFromUri: async (path: string) => {
      void path;
    },
  },
};

export class SsdMobilenetv1Options {
  constructor(public opts: { minConfidence?: number } = {}) {}
}

type DetectionBox = { x: number; y: number; width: number; height: number };
type DetectionResult = { detection: { box: DetectionBox }; descriptor: Float32Array };

export function detectAllFaces(img: unknown, opts: SsdMobilenetv1Options) {
  void img;
  void opts;
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
