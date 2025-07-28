import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CheckCircle2
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
  boundingBox: [number, number, number, number]; // [x, y, width, height]
  confidence: number;
  faceCropUrl?: string; // URL to cropped face image
  photo?: {
    filePath: string;
    mediaAsset: {
      originalFilename: string;
    };
  };
}

interface Person {
  id: string;
  name: string;
  faceCount: number;
  representativeFace?: string;
}

export function FaceSuggestions() {
  const [selectedAssignments, setSelectedAssignments] = useState<Array<{faceId: string, personId: string}>>([]);
  const [isCreatePersonOpen, setIsCreatePersonOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [pendingFaceId, setPendingFaceId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch face suggestions
  const { data: suggestions = [], isLoading: suggestionsLoading, refetch: refetchSuggestions } = useQuery<FaceSuggestion[]>({
    queryKey: ["/api/faces/suggestions"],
    refetchInterval: false,
  });

  // Fetch unassigned faces
  const { data: unassignedFaces = [], isLoading: facesLoading } = useQuery<Face[]>({
    queryKey: ["/api/faces/unassigned"],
    refetchInterval: false,
  });

  // Fetch people for creating new person
  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
  });

  // Reprocess faces mutation
  const reprocessMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/faces/reprocess');
    },
    onSuccess: () => {
      refetchSuggestions();
      queryClient.invalidateQueries({ queryKey: ["/api/faces/unassigned"] });
      toast({ title: "Faces reprocessed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to reprocess faces", variant: "destructive" });
    }
  });

  // Batch assign mutation
  const batchAssignMutation = useMutation({
    mutationFn: async (assignments: Array<{faceId: string, personId: string}>) => {
      return await apiRequest('POST', '/api/faces/batch-assign', { assignments });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: `Successfully assigned ${data.success} faces${data.failed > 0 ? `, ${data.failed} failed` : ''}` 
      });
      setSelectedAssignments([]);
      refetchSuggestions();
      queryClient.invalidateQueries({ queryKey: ["/api/faces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/faces/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
    },
    onError: () => {
      toast({ title: "Failed to assign faces", variant: "destructive" });
    }
  });

  // Create person mutation
  const createPersonMutation = useMutation({
    mutationFn: async (personData: { name: string }): Promise<Person> => {
      const res = await apiRequest('POST', '/api/people', personData);
      const person: Person = await res.json();
      return person;
    },
    onSuccess: (newPerson: Person) => {
      if (pendingFaceId) {
        setSelectedAssignments(prev => [
          ...prev.filter(a => a.faceId !== pendingFaceId),
          { faceId: pendingFaceId, personId: newPerson.id }
        ]);
        setPendingFaceId(null);
      }
      setNewPersonName("");
      setIsCreatePersonOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      toast({ title: `Created person: ${newPerson.name}` });
    },
    onError: () => {
      toast({ title: "Failed to create person", variant: "destructive" });
    }
  });

  const handleSuggestionAction = (faceId: string, personId: string, action: 'accept' | 'reject') => {
    if (action === 'accept') {
      setSelectedAssignments(prev => [
        ...prev.filter(a => a.faceId !== faceId),
        { faceId, personId }
      ]);
    } else {
      setSelectedAssignments(prev => prev.filter(a => a.faceId !== faceId));
    }
  };

  const handleCreateNewPerson = (faceId: string) => {
    setPendingFaceId(faceId);
    setIsCreatePersonOpen(true);
  };

  const getFaceCropUrl = (face: Face) => {
    if (!face.photo) return '';
    const [x, y, width, height] = face.boundingBox;
    return `/api/files/${face.photo.filePath}?crop=${x},${y},${width},${height}&face=true`;
  };

  const getPersonAvatarUrl = (person: { representativeFace?: string }) => {
    return person.representativeFace ? `/api/files/${person.representativeFace}` : '';
  };

  const batchAssign = () => {
    if (selectedAssignments.length > 0) {
      batchAssignMutation.mutate(selectedAssignments);
    }
  };

  const clearAssignments = () => {
    setSelectedAssignments([]);
  };

  const suggestionsWithFaces = suggestions.map(suggestion => ({
    ...suggestion,
    face: unassignedFaces.find(f => f.id === suggestion.faceId)
  })).filter(s => s.face);

  const totalUnassigned = unassignedFaces.length;
  const totalWithSuggestions = suggestions.length;
  const totalSelected = selectedAssignments.length;

  return (
    <div className="space-y-6">
      {/* Header with statistics */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-blue-500" />
            Face Suggestions
          </h2>
          <p className="text-muted-foreground">
            AI-powered suggestions to help organize unassigned faces
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={() => reprocessMutation.mutate()}
            disabled={reprocessMutation.isPending}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${reprocessMutation.isPending ? 'animate-spin' : ''}`} />
            {reprocessMutation.isPending ? 'Reprocessing...' : 'Reprocess'}
          </Button>
        </div>
      </div>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Unassigned Faces</p>
                <p className="text-2xl font-bold">{totalUnassigned}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">With Suggestions</p>
                <p className="text-2xl font-bold">{totalWithSuggestions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Ready to Assign</p>
                <p className="text-2xl font-bold">{totalSelected}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Known People</p>
                <p className="text-2xl font-bold">{people.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch assignment controls */}
      {totalSelected > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    {totalSelected} face{totalSelected !== 1 ? 's' : ''} ready for assignment
                  </p>
                  <p className="text-sm text-green-600">
                    Review your selections and click "Assign All" to proceed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={clearAssignments}
                  variant="outline"
                  size="sm"
                >
                  Clear All
                </Button>
                <Button
                  onClick={batchAssign}
                  disabled={batchAssignMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {batchAssignMutation.isPending ? 'Assigning...' : `Assign All (${totalSelected})`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading states */}
      {(suggestionsLoading || facesLoading) && (
        <div className="flex justify-center py-8">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p>Loading face suggestions...</p>
          </div>
        </div>
      )}

      {/* No suggestions state */}
      {!suggestionsLoading && !facesLoading && suggestionsWithFaces.length === 0 && totalUnassigned > 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Face Suggestions Available</h3>
            <p className="text-muted-foreground mb-4">
              There are {totalUnassigned} unassigned faces, but no suggestions could be generated. 
              This usually happens when there aren't enough assigned faces to compare against.
            </p>
            <Button onClick={() => reprocessMutation.mutate()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Reprocessing
            </Button>
          </CardContent>
        </Card>
      )}

      {/* All faces assigned state */}
      {!suggestionsLoading && !facesLoading && totalUnassigned === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">All Faces Assigned!</h3>
            <p className="text-muted-foreground">
              Great job! All detected faces have been assigned to people. Upload more photos to continue organizing your collection.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Face suggestion cards */}
      <div className="space-y-4">
        {suggestionsWithFaces.map((item) => {
          const face = item.face!;
          const isSelected = selectedAssignments.some(a => a.faceId === item.faceId);
          const selectedPerson = selectedAssignments.find(a => a.faceId === item.faceId);
          
          return (
            <Card key={item.faceId} className={`transition-all ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  {/* Face crop */}
                  <div className="relative">
                    <img
                      src={face.faceCropUrl ? `/api/files/${face.faceCropUrl}` : getFaceCropUrl(face)}
                      alt="Face crop"
                      className="w-20 h-20 rounded-lg object-cover border-2 border-border"
                      onError={(e) => {
                        // First fallback to the other crop method, then to full image
                        if (face.faceCropUrl && e.currentTarget.src.includes(face.faceCropUrl)) {
                          e.currentTarget.src = getFaceCropUrl(face);
                        } else {
                          e.currentTarget.src = `/api/files/${face.photo?.filePath}`;
                        }
                      }}
                    />
                    <Badge className="absolute -top-1 -right-1 text-xs">
                      {Math.round(face.confidence)}%
                    </Badge>
                  </div>
                  
                  {/* Face info */}
                  <div className="flex-1">
                    <h3 className="font-medium">Unassigned Face</h3>
                    <p className="text-sm text-muted-foreground">
                      From: {face.photo?.mediaAsset.originalFilename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Confidence: {Math.round(face.confidence)}% • {item.suggestions.length} suggestion{item.suggestions.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Selection status */}
                  {isSelected && selectedPerson && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Will assign to: {people.find(p => p.id === selectedPerson.personId)?.name}
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">Suggested People:</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {item.suggestions.slice(0, 6).map((suggestion) => {
                      const isThisSelected = selectedPerson?.personId === suggestion.personId;
                      
                      return (
                        <div 
                          key={suggestion.personId} 
                          className={`p-3 border rounded-lg transition-all cursor-pointer hover:shadow-md ${
                            isThisSelected ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-border hover:border-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={getPersonAvatarUrl(suggestion)} />
                              <AvatarFallback>{suggestion.personName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{suggestion.personName}</p>
                              <p className="text-xs text-muted-foreground">
                                {Math.round(suggestion.confidence)}% match
                              </p>
                            </div>
                          </div>
                          
                          <Progress value={suggestion.confidence} className="h-1 mb-2" />
                          
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant={isThisSelected ? "default" : "outline"}
                              className="flex-1 text-xs"
                              onClick={() => handleSuggestionAction(item.faceId, suggestion.personId, 'accept')}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              {isThisSelected ? 'Selected' : 'Accept'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => handleSuggestionAction(item.faceId, suggestion.personId, 'reject')}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Not the right person?
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreateNewPerson(item.faceId)}
                      className="flex items-center gap-2"
                    >
                      <UserPlus className="h-3 w-3" />
                      Create New Person
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
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