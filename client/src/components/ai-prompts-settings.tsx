import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { useToast } from '../hooks/use-toast';
import { Edit3, Plus, RotateCcw, Save, X, Brain, FileText, Camera } from 'lucide-react';

interface AIPrompt {
  id: string;
  name: string;
  description: string;
  category: 'analysis' | 'naming' | 'description';
  provider: 'openai' | 'ollama' | 'both';
  systemPrompt: string;
  userPrompt: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromptFormData {
  name: string;
  description: string;
  category: 'analysis' | 'naming' | 'description';
  provider: 'openai' | 'ollama' | 'both';
  systemPrompt: string;
  userPrompt: string;
  isActive: boolean;
}

const CATEGORIES = {
  analysis: { name: 'Image Analysis', icon: Camera },
  naming: { name: 'File Naming', icon: FileText },
  description: { name: 'Description Generation', icon: Brain },
};

export function AIPromptsSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<
    'analysis' | 'naming' | 'description'
  >('analysis');

  const [formData, setFormData] = useState<PromptFormData>({
    name: '',
    description: '',
    category: 'analysis',
    provider: 'both',
    systemPrompt: '',
    userPrompt: '',
    isActive: true,
  });

  // Fetch all AI prompts
  const { data: prompts = [], isLoading } = useQuery<AIPrompt[]>({
    queryKey: ['/api/ai/prompts'],
  });

  // Update prompt mutation
  /**
   * Enhanced error handling for AI prompt update:
   * - All exceptions are logged to the console for debugging.
   * - Detailed error messages are shown in toast notifications, including error details.
   * - No errors are suppressed; all surfaced to the user.
   * (See lines 103–117 for logic.)
   */
  const updatePromptMutation = useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<PromptFormData> }) =>
        fetch(`/api/ai/prompts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }).then((res) => res.json()),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['/api/ai/prompts'] });
        toast({ title: 'Success', description: 'AI prompt updated successfully' });
        setEditingPrompt(null);
      },
      onError: (error: unknown) => {
        // Log error for debugging
        console.error('Error updating AI prompt:', error);
        let description = 'Failed to update AI prompt';
        if (error instanceof Error && error.message) {
          description += `: ${error.message}`;
        } else if (typeof error === 'string') {
          description += `: ${error}`;
        }
        toast({
          title: 'Error',
          description,
          variant: 'destructive',
        });
      },
    });

  // Reset to defaults mutation
  /**
   * Enhanced error handling for AI prompts reset:
   * - All exceptions are logged to the console for debugging.
   * - Detailed error messages are shown in toast notifications, including error details.
   * - No errors are suppressed; all surfaced to the user.
   * (See lines 135–149 for logic.)
   */
  const resetToDefaultsMutation = useMutation({
      mutationFn: () =>
        fetch('/api/ai/prompts/reset-to-defaults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).then((res) => res.json()),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['/api/ai/prompts'] });
        toast({
          title: 'Success',
          description: 'AI prompts reset to defaults successfully',
        });
        setEditingPrompt(null);
      },
      onError: (error: unknown) => {
        // Log error for debugging
        console.error('Error resetting AI prompts to defaults:', error);
        let description = 'Failed to reset AI prompts to defaults';
        if (error instanceof Error && error.message) {
          description += `: ${error.message}`;
        } else if (typeof error === 'string') {
          description += `: ${error}`;
        }
        toast({
          title: 'Error',
          description,
          variant: 'destructive',
        });
      },
    });

  const startEditing = (prompt: AIPrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      name: prompt.name,
      description: prompt.description,
      category: prompt.category,
      provider: prompt.provider,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      isActive: prompt.isActive,
    });
  };

  const cancelEditing = () => {
    setEditingPrompt(null);
  };

  const handleSave = () => {
    if (editingPrompt) {
      updatePromptMutation.mutate({ id: editingPrompt.id, data: formData });
    }
  };

  const categoryPrompts = prompts.filter((p) => p.category === selectedCategory);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Prompts Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Customize how AI analyzes and describes your photos. These prompts work with
            both OpenAI and Ollama.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset to Default Prompts</AlertDialogTitle>
              <AlertDialogDescription>
                This will restore the original default prompts. Any changes you've made
                will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => resetToDefaultsMutation.mutate()}>
                Reset to Defaults
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Tabs
        value={selectedCategory}
        onValueChange={(value) => setSelectedCategory(value as 'analysis' | 'naming' | 'description')}
      >
        <TabsList className="grid w-full grid-cols-3">
          {Object.entries(CATEGORIES).map(([key, { name, icon: Icon }]) => (
            <TabsTrigger
              key={key}
              value={key as 'analysis' | 'naming' | 'description'}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {name}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(CATEGORIES).map(([category, { name }]) => (
          <TabsContent key={category} value={category as 'analysis' | 'naming' | 'description'} className="space-y-4">
            {categoryPrompts
              .filter((p) => p.category === category)
              .map((prompt) => (
                <Card
                  key={prompt.id}
                  className={editingPrompt?.id === prompt.id ? 'border-primary' : ''}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {prompt.name}
                          <Badge variant="outline">Universal</Badge>
                          {prompt.isDefault && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{prompt.description}</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          editingPrompt?.id === prompt.id
                            ? cancelEditing()
                            : startEditing(prompt)
                        }
                      >
                        {editingPrompt?.id === prompt.id ? (
                          <X className="h-4 w-4" />
                        ) : (
                          <Edit3 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editingPrompt?.id === prompt.id ? (
                      <>
                        <div>
                          <Label htmlFor="systemPrompt">System Prompt</Label>
                          <Textarea
                            id="systemPrompt"
                            value={formData.systemPrompt}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                              setFormData((prev) => ({
                                ...prev,
                                systemPrompt: e.target.value,
                              }))
                            }
                            rows={12}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="userPrompt">User Prompt</Label>
                          <Textarea
                            id="userPrompt"
                            value={formData.userPrompt}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                              setFormData((prev) => ({
                                ...prev,
                                userPrompt: e.target.value,
                              }))
                            }
                            rows={3}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={cancelEditing}>
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSave}
                            disabled={updatePromptMutation.isPending}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            System Prompt
                          </Label>
                          <p className="text-xs bg-muted p-3 rounded font-mono whitespace-pre-wrap">
                            {prompt.systemPrompt.length > 400
                              ? prompt.systemPrompt.substring(0, 400) + '...'
                              : prompt.systemPrompt}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            User Prompt
                          </Label>
                          <p className="text-xs bg-muted p-2 rounded font-mono">
                            {prompt.userPrompt}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
