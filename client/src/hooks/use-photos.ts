import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "./use-toast";

export function usePhotos(tier?: string) {
  const allowedTiers = ["bronze", "silver", "gold", "unprocessed", "all_versions"];
  const safeTier = allowedTiers.includes(tier as string) ? (tier as "bronze" | "silver" | "gold" | "unprocessed" | "all_versions") : undefined;
  return useQuery({
    queryKey: ["/api/photos", safeTier ? { tier: safeTier } : {}],
    queryFn: () => api.getPhotos(safeTier),
  });
}

export function useRecentPhotos(limit = 6) {
  return useQuery({
    queryKey: ["/api/photos/recent", { limit }],
    queryFn: () => api.getRecentPhotos(limit),
  });
}

export function usePhotoDetails(photoId: string) {
  return useQuery({
    queryKey: ["/api/photos", photoId],
    queryFn: () => api.getPhotoDetails(photoId),
    enabled: !!photoId,
  });
}

export function useProcessPhoto() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: api.processPhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Processing Complete",
        description: "Photo has been processed with AI and moved to Silver tier.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdatePhoto() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ photoId, metadata, isReviewed }: {
      photoId: string;
      metadata?: any;
      isReviewed?: boolean;
    }) => api.updatePhotoMetadata(photoId, metadata, isReviewed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      toast({
        title: "Photo Updated",
        description: "Photo metadata has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
