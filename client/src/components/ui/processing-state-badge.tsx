import { Badge } from "@/components/ui/badge";
import { Check, Clock, ArrowUp, X, Users, AlertTriangle } from "lucide-react";

interface ProcessingStateBadgeProps {
  state: "unprocessed" | "processed" | "promoted" | "rejected";
  tier: "silver" | "gold";
  size?: "sm" | "md" | "lg";
  faceDetectionStatus?: "success" | "failed" | "none" | "processing";
  faceCount?: number;
}

export function ProcessingStateBadge({ state, tier, size = "sm" }: ProcessingStateBadgeProps) {
  const getBadgeConfig = () => {
    switch (state) {
      case "unprocessed":
        return {
          icon: Clock,
          label: "Unprocessed",
          variant: "secondary" as const,
          className: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
        };
      case "processed":
        return {
          icon: Check,
          label: "Processed",
          variant: "outline" as const,
          className: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
        };
      case "promoted":
        return {
          icon: ArrowUp,
          label: `Promoted to Gold`,
          variant: "default" as const,
          className: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
        };
      case "rejected":
        return {
          icon: X,
          label: "Rejected",
          variant: "destructive" as const,
          className: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
        };
      default:
        return {
          icon: Clock,
          label: "Unknown",
          variant: "secondary" as const,
          className: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;
  
  const iconSize = size === "lg" ? 16 : size === "md" ? 14 : 12;
  const textSize = size === "lg" ? "text-sm" : size === "md" ? "text-xs" : "text-xs";

  return (


// Face Detection Status Badge Component
interface FaceDetectionBadgeProps {
  status: "success" | "failed" | "none" | "processing";
  faceCount?: number;
  size?: "sm" | "md" | "lg";
}

export function FaceDetectionBadge({ status, faceCount = 0, size = "sm" }: FaceDetectionBadgeProps) {
  const getBadgeConfig = () => {
    switch (status) {
      case "success":
        return {
          icon: Users,
          label: `${faceCount} face${faceCount !== 1 ? 's' : ''} detected`,
          variant: "outline" as const,
          className: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
        };
      case "failed":
        return {
          icon: AlertTriangle,
          label: "Face detection failed",
          variant: "outline" as const,
          className: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
        };
      case "none":
        return {
          icon: Users,
          label: "No faces detected",
          variant: "outline" as const,
          className: "bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800"
        };
      case "processing":
        return {
          icon: Clock,
          label: "Detecting faces...",
          variant: "outline" as const,
          className: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
        };
      default:
        return {
          icon: Users,
          label: "Unknown status",
          variant: "secondary" as const,
          className: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;
  
  const iconSize = size === "lg" ? 16 : size === "md" ? 14 : 12;
  const textSize = size === "lg" ? "text-sm" : size === "md" ? "text-xs" : "text-xs";

  return (
    <Badge 
      variant={config.variant}
      className={`inline-flex items-center gap-1 ${textSize} ${config.className}`}
    >
      <Icon size={iconSize} />
      {config.label}
    </Badge>
  );
}

// Helper function to determine face detection status from photo data
export function getFaceDetectionStatus(photo: any): { status: "success" | "failed" | "none" | "processing", faceCount: number } {
  // Check if face detection was attempted
  const faceDetectionAttempted = photo.metadata?.faceDetection?.attempted || photo.detectedFaces !== undefined;
  
  if (!faceDetectionAttempted) {
    return { status: "processing", faceCount: 0 };
  }

  // Check for face detection failure
  const faceDetectionFailed = photo.metadata?.faceDetection?.failed || photo.metadata?.faceDetection?.error;
  if (faceDetectionFailed) {
    return { status: "failed", faceCount: 0 };
  }

  // Count detected faces
  const faceCount = photo.detectedFaces?.length || 0;
  
  if (faceCount > 0) {
    return { status: "success", faceCount };
  } else {
    return { status: "none", faceCount: 0 };
  }
}

    <Badge 
      variant={config.variant}
      className={`inline-flex items-center gap-1 ${textSize} ${config.className}`}
    >
      <Icon size={iconSize} />
      {config.label}
    </Badge>
  );
}

// Helper function to get state from photo data
export function getProcessingState(photo: any): "unprocessed" | "processed" | "promoted" | "rejected" {
  return photo.processingState || "unprocessed";
}