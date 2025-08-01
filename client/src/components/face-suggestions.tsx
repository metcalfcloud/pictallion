import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  RefreshCw, 
  Users, 
  UserCheck, 
  UserPlus, 
  Check, 
  X, 
  Sparkles,
  Eye,
  AlertCircle,
  CheckCircle2,
  User,
  Search,
  EyeOff,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProcessingStateBadge } from "./ui/processing-state-badge";

interface FaceSuggestion {
  faceId: string;
  suggestions: Array<{
    personId: string;
    confidence: number;
    representativeFace?: string;
    personName: string;
  }>;
}

interface Face {
  id: string;
  photoId: string;
  boundingBox: [number, number, number, number]; // [x, y, width, height]
  confidence: number;
  faceCropUrl?: string; // URL to cropped face image
  faceCrop?: string; // filename for the face crop image
  personId?: string;
  photo?: {
    id: string;
    mediaAsset: {
      id: string;
      filename: string;
      originalFilename: string;
      width: number;
      height: number;
    };
  };
}

interface Person {
  id: string;
  name: string;
  faceCount?: number;
  representativeFace?: string;
}

interface Assignment {
  faceId: string;
  personId: string;
}

interface FaceSuggestionsProps {
  isOpen: boolean;
  faceSuggestions?: FaceSuggestion[];
  isLoading?: boolean;
  onClose?: () => void;
}

export function FaceSuggestions({ isOpen, faceSuggestions = [], isLoading = false, onClose }: FaceSuggestionsProps) {
  const [selectedAssignments, setSelectedAssignments] = useState<Assignment[]>([]);
  const [isCreatePersonOpen, setIsCreatePersonOpen] = useState(false);
  const [selectedFaceForNewPerson, setSelectedFaceForNewPerson] = useState<string | null>(null);
  const [newPersonName, setNewPersonName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load people for suggestions
  const { data: people = [], isLoading: peopleLoading } = useQuery<Person[]>({
    queryKey: ['/api/people'],
    enabled: isOpen
  });

  // Load face details for the suggested faces
  const { data: faces = [], isLoading: facesLoading } = useQuery<Face[]>({
    queryKey: ['/api/faces'],
    enabled: isOpen && faceSuggestions.length > 0
  });

  // Create person mutation
  const createPersonMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest('/api/people', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response;
    },
    onSuccess: (person: Person) => {
      if (selectedFaceForNewPerson) {
        handleSuggestionAction(selectedFaceForNewPerson, person.id, 'accept');
      }
      setIsCreatePersonOpen(false);
      setNewPersonName("");
      setSelectedFaceForNewPerson(null);
      queryClient.invalidateQueries({ queryKey: ['/api/people'] });
      toast({
        title: "Success",
        description: `Created person "${person.name}"`
      });
    },
    onError: (error: any) => {
      console.error('Error creating person:', error);
      toast({
        title: "Error",
        description: `Failed to create person: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });

  // Assign face mutation
  const assignFaceMutation = useMutation({
    mutationFn: async (data: { faceId: string; personId: string }) => {
      const response = await apiRequest('/api/face-assignments', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/face-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/people'] });
      toast({
        title: "Success",
        description: "Face assigned successfully"
      });
    },
    onError: (error: any) => {
      console.error('Error assigning face:', error);
      toast({
        title: "Error",
        description: `Failed to assign face: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });

  // Ignore face mutation
  const ignoreFaceMutation = useMutation({
    mutationFn: async (faceId: string) => {
      const response = await apiRequest(`/api/faces/${faceId}/ignore`, {
        method: 'POST'
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/face-suggestions'] });
      toast({
        title: "Success",
        description: "Face ignored successfully"
      });
    },
    onError: (error: any) => {
      console.error('Error ignoring face:', error);
      toast({
        title: "Error",
        description: `Failed to ignore face: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });

  const handleSuggestionAction = (faceId: string, personId: string, action: 'accept' | 'reject') => {
    if (action === 'accept') {
      // Update local selection
      setSelectedAssignments(prev => {
        const filtered = prev.filter(a => a.faceId !== faceId);
        return [...filtered, { faceId, personId }];
      });
      
      // Submit to server
      assignFaceMutation.mutate({ faceId, personId });
    }
  };

  const handleCreateNewPerson = (faceId: string) => {
    setSelectedFaceForNewPerson(faceId);
    setIsCreatePersonOpen(true);
  };

  if (!isOpen) return null;

  if (isLoading || facesLoading || peopleLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">AI Face Suggestions</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading face suggestions...</span>
        </div>
      </div>
    );
  }

  if (faceSuggestions.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">AI Face Suggestions</h2>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No face suggestions available at the moment.</p>
          <p className="text-sm">Upload photos with faces to get AI-powered suggestions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">AI Face Suggestions</h2>
          <Badge variant="secondary" className="ml-2">
            {faceSuggestions.length} face{faceSuggestions.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {faceSuggestions.map((item) => {
          const face = faces.find(f => f.id === item.faceId);
          const isSelected = selectedAssignments.some(a => a.faceId === item.faceId);
          const selectedPerson = selectedAssignments.find(a => a.faceId === item.faceId);

          return (
            <div 
              key={item.faceId} 
              className={`w-full rounded-xl border bg-card/50 backdrop-blur-sm shadow-lg transition-all duration-300 hover:shadow-xl ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''}`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Face crop */}
                  <div className="relative flex-shrink-0">
                    {face ? (
                      <>
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted">
                          <img
                            src={`/api/files/${face.faceCrop}`}
                            alt="Face crop"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                              if (nextElement) {
                                nextElement.classList.remove('hidden');
                              }
                            }}
                          />
                          <User className="hidden w-8 h-8 text-muted-foreground absolute inset-0 m-auto" />
                        </div>
                        
                        {/* Processing state overlay */}
                        {(assignFaceMutation.isPending || ignoreFaceMutation.isPending) && (
                          <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                          </div>
                        )}
                        
                        {/* Processing state badge */}
                        <div className="absolute -top-1 -right-1">
                          <ProcessingStateBadge 
                            isPending={assignFaceMutation.isPending || ignoreFaceMutation.isPending}
                            isSelected={isSelected}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                        <User className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Face info */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm">
                      {face ? 'Unassigned Face' : 'Face (Missing Data)'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {face?.photo?.mediaAsset.originalFilename ? 
                        `From: ${face.photo.mediaAsset.originalFilename}` : 
                        `Face ID: ${item.faceId}`
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {face ? `Confidence: ${Math.round(face.confidence)}%` : 'Face data missing'} • {item.suggestions.length} suggestion{item.suggestions.length !== 1 ? 's' : ''}
                    </p>
                    {isSelected && selectedPerson && (
                      <p className="text-xs text-green-600 font-medium">
                        → Will assign to: {people.find(p => p.id === selectedPerson.personId)?.name}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Content section */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">Suggested People:</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {item.suggestions.slice(0, 5).map((suggestion) => {
                      const isThisSelected = selectedPerson?.personId === suggestion.personId;

                      return (
                        <div 
                          key={suggestion.personId} 
                          onClick={() => handleSuggestionAction(item.faceId, suggestion.personId, 'accept')}
                          className={`p-3 border rounded-lg transition-all cursor-pointer hover:shadow-md hover:scale-105 ${
                            isThisSelected ? 'border-green-500 bg-green-50 dark:bg-green-950 ring-2 ring-green-200' : 'border-border hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/50'
                          } ${assignFaceMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                              {suggestion.representativeFace ? (
                                <img
                                  src={`/api/files/${suggestion.representativeFace}`}
                                  alt={suggestion.personName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                                    if (nextElement) {
                                      nextElement.classList.remove('hidden');
                                    }
                                  }}
                                />
                              ) : null}
                              <User className={`w-6 h-6 text-muted-foreground ${suggestion.representativeFace ? 'hidden' : ''}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm truncate">{suggestion.personName}</p>
                                {isThisSelected && <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {Math.round(suggestion.confidence)}% match
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Create new person option */}
                    <div 
                      onClick={() => handleCreateNewPerson(item.faceId)}
                      className="p-3 border border-dashed border-blue-300 rounded-lg transition-all cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/50 flex items-center gap-3"
                    >
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-blue-600 dark:text-blue-400">Create New Person</p>
                        <p className="text-xs text-muted-foreground">
                          Add as new person
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">
                        Click on a person to assign, or create new person
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => ignoreFaceMutation.mutate(item.faceId)}
                        disabled={ignoreFaceMutation.isPending}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <EyeOff className="h-3 w-3" />
                        Ignore
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create person dialog */}
      <Dialog open={isCreatePersonOpen} onOpenChange={setIsCreatePersonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Person</DialogTitle>
            <DialogDescription>
              Create a new person to assign this face to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="personName">Person Name</Label>
              <Input
                id="personName"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Enter person's name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreatePersonOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createPersonMutation.mutate({ name: newPersonName })}
                disabled={!newPersonName.trim() || createPersonMutation.isPending}
              >
                {createPersonMutation.isPending ? 'Creating...' : 'Create Person'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}