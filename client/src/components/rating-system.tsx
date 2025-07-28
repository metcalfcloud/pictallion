import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RatingSystemProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function RatingSystem({
  rating,
  onRatingChange,
  size = "md",
  interactive = true,
  showLabel = true,
  className
}: RatingSystemProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const sizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  };

  const starSize = sizes[size];
  const currentRating = hoverRating || rating;

  const handleRatingClick = (newRating: number) => {
    if (!interactive) return;
    
    // If clicking the same rating, toggle to 0 (no rating)
    const finalRating = newRating === rating ? 0 : newRating;
    onRatingChange(finalRating);
  };

  const handleMouseEnter = (hoverValue: number) => {
    if (interactive) {
      setHoverRating(hoverValue);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };

  const getRatingLabel = (rating: number): string => {
    switch (rating) {
      case 0: return "Unrated";
      case 1: return "Poor";
      case 2: return "Fair";
      case 3: return "Good";
      case 4: return "Very Good";
      case 5: return "Excellent";
      default: return "Unrated";
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Button
            key={star}
            variant="ghost"
            size="sm"
            className={cn(
              "p-0 h-auto hover:bg-transparent",
              interactive ? "cursor-pointer" : "cursor-default"
            )}
            onClick={() => handleRatingClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            onMouseLeave={handleMouseLeave}
            disabled={!interactive}
          >
            <Star
              className={cn(
                starSize,
                "transition-colors duration-150",
                star <= currentRating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300 dark:text-muted-foreground",
                interactive && "hover:text-yellow-300 hover:fill-yellow-300"
              )}
            />
          </Button>
        ))}
      </div>
      
      {showLabel && (
        <span className="text-sm text-muted-foreground min-w-[70px]">
          {getRatingLabel(currentRating)}
        </span>
      )}
    </div>
  );
}

interface QuickRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  className?: string;
}

export function QuickRating({ rating, onRatingChange, className }: QuickRatingProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Button
          key={star}
          variant="ghost"
          size="sm"
          className="p-0 h-auto hover:bg-transparent"
          onClick={() => onRatingChange(star === rating ? 0 : star)}
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors duration-150",
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300 dark:text-muted-foreground hover:text-yellow-300"
            )}
          />
        </Button>
      ))}
    </div>
  );
}

interface RatingFilterProps {
  minRating: number;
  maxRating: number;
  onRatingRangeChange: (min: number, max: number) => void;
  className?: string;
}

export function RatingFilter({ 
  minRating, 
  maxRating, 
  onRatingRangeChange, 
  className 
}: RatingFilterProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-sm font-medium">Filter by Rating</div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground w-8">Min:</span>
          <RatingSystem
            rating={minRating}
            onRatingChange={(rating) => onRatingRangeChange(rating, maxRating)}
            size="sm"
            showLabel={false}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground w-8">Max:</span>
          <RatingSystem
            rating={maxRating}
            onRatingChange={(rating) => onRatingRangeChange(minRating, rating)}
            size="sm"
            showLabel={false}
          />
        </div>
      </div>
      
      {(minRating > 0 || maxRating < 5) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRatingRangeChange(0, 5)}
          className="text-xs"
        >
          Clear Filter
        </Button>
      )}
    </div>
  );
}