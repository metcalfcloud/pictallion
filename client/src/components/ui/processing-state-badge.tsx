import { Badge } from "@/components/ui/badge";
import { Check, Clock, ArrowUp, X } from "lucide-react";

interface ProcessingStateBadgeProps {
  state: "unprocessed" | "processed" | "promoted" | "rejected";
  tier: "bronze" | "silver" | "gold";
  size?: "sm" | "md" | "lg";
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
          label: `Promoted to ${tier === 'bronze' ? 'Silver' : 'Gold'}`,
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