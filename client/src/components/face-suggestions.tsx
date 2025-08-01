import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  UserPlus, 
  CheckCircle2,
  User,
  EyeOff,
  Loader2,
  Sparkles,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
  boundingBox: [number, number, number, number];
  confidence: number;
  faceCrop?: string;
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
  const [expandedFace, setExpandedFace] = useState<string | null>(null);
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
    mutationFn: async (data: { name: string }): Promise<Person> => {
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
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
    }
  });

  // Assign face mutation
  const assignFaceMutation = useMutation({
    mutationFn: async (data: { faceId: string; personId: string }) => {
      const response = await fetch('/api/face-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/face-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/people'] });
      toast({
        title: "Success",
        description: "Face assigned successfully"
      });
    }
  });

  // Ignore face mutation
  const ignoreFaceMutation = useMutation({
    mutationFn: async (faceId: string) => {
      const response = await fetch(`/api/faces/${faceId}/ignore`, {
        method: 'POST'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/face-suggestions'] });
      toast({
        title: "Success",
        description: "Face ignored successfully"
      });
    }
  });

  const handleSuggestionAction = (faceId: string, personId: string, action: 'accept' | 'reject') => {
    if (action === 'accept') {
      setSelectedAssignments(prev => {
        const filtered = prev.filter(a => a.faceId !== faceId);
        return [...filtered, { faceId, personId }];
      });
      
      assignFaceMutation.mutate({ faceId, personId });
    }
  };

  const handleCreateNewPerson = (faceId: string) => {
    setSelectedFaceForNewPerson(faceId);
    setIsCreatePersonOpen(true);
  };

  const handleFaceClick = (faceId: string) => {
    setExpandedFace(expandedFace === faceId ? null : faceId);
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

      <div style={{fontSize: 0, lineHeight: 0}}>
        {faceSuggestions.map((item) => {
          const face = faces.find(f => f.id === item.faceId);
          const isSelected = selectedAssignments.some(a => a.faceId === item.faceId);
          const selectedPerson = selectedAssignments.find(a => a.faceId === item.faceId);
          const isExpanded = expandedFace === item.faceId;

          return (
            <div key={item.faceId} style={{display: 'inline-block', width: '84px', margin: '2px', fontSize: '12px', lineHeight: '1.2'}}>
              {/* Face card - exactly the image size with no extra container */}
              <div 
                onClick={() => handleFaceClick(item.faceId)}
                className={`relative w-20 h-20 rounded-lg overflow-hidden bg-muted cursor-pointer transition-all duration-300 hover:scale-105 ${
                  isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-300'
                }`}
              >
                  {face ? (
                    <>
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
                    </>
                  ) : (
                    <User className="w-8 h-8 text-muted-foreground absolute inset-0 m-auto" />
                  )}
                  
                  {/* Selection overlay directly on face image */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-white bg-blue-600 rounded-full" />
                    </div>
                  )}
                  
                  {/* Processing overlay */}
                  {(assignFaceMutation.isPending || ignoreFaceMutation.isPending) && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </div>
                  )}
                </div>
              
              {/* Compact info below face - exactly 80px wide to match face */}
              <div className="w-20 text-center text-xs text-muted-foreground mt-1">
                <div>{item.suggestions.length} match{item.suggestions.length !== 1 ? 'es' : ''}</div>
                {isSelected && selectedPerson && (
                  <div className="text-green-600 font-medium truncate">
                    {people.find(p => p.id === selectedPerson.personId)?.name}
                  </div>
                )}
              </div>

              {/* Expanded suggestions */}
              {isExpanded && (
                <div className="absolute z-50 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-3 mt-2 min-w-48 left-0">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Suggestions:</div>
                    {item.suggestions.slice(0, 3).map((suggestion) => (
                      <div 
                        key={suggestion.personId}
                        onClick={() => handleSuggestionAction(item.faceId, suggestion.personId, 'accept')}
                        className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <div className="w-8 h-8 bg-muted rounded-full overflow-hidden">
                          {suggestion.representativeFace ? (
                            <img
                              src={`/api/files/${suggestion.representativeFace}`}
                              alt={suggestion.personName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4 text-muted-foreground m-auto mt-2" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{suggestion.personName}</div>
                          <div className="text-xs text-muted-foreground">{Math.round(suggestion.confidence)}%</div>
                        </div>
                      </div>
                    ))}
                    
                    <div 
                      onClick={() => handleCreateNewPerson(item.faceId)}
                      className="flex items-center gap-2 p-2 hover:bg-blue-50 dark:hover:bg-blue-950 rounded cursor-pointer text-blue-600"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span className="text-sm">Create New Person</span>
                    </div>
                    
                    <div 
                      onClick={() => ignoreFaceMutation.mutate(item.faceId)}
                      className="flex items-center gap-2 p-2 hover:bg-red-50 dark:hover:bg-red-950 rounded cursor-pointer text-red-600"
                    >
                      <EyeOff className="w-4 h-4" />
                      <span className="text-sm">Ignore Face</span>
                    </div>
                  </div>
                </div>
              )}
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