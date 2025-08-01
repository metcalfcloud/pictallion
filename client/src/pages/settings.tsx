import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings as SettingsIcon, 
  FileImage, 
  Sparkles, 
  Save, 
  RotateCcw,
  Calendar,
  Camera,
  Brain,
  FileText,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import EventSettings from "@/components/event-settings";
import { AIPromptsSettings } from "@/components/ai-prompts-settings";

interface Setting {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface NamingPattern {
  id: string;
  name: string;
  description: string;
  pattern: string;
  example: string;
}

interface AIConfig {
  currentProvider: "ollama" | "openai" | "both";
  availableProviders: {
    ollama: boolean;
    openai: boolean;
  };
  config: {
    ollama: {
      baseUrl: string;
      visionModel: string;
      textModel: string;
    };
    openai: {
      model: string;
      hasApiKey: boolean;
    };
  };
}

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current settings
  const settings = (useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  }).data ?? []) as Setting[];
  const settingsLoading = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  }).isLoading;

  // Fetch naming patterns
  const namingPatterns = (useQuery<NamingPattern[]>({
    queryKey: ["/api/settings/naming/patterns"],
  }).data ?? []) as NamingPattern[];
  const patternsLoading = useQuery<NamingPattern[]>({
    queryKey: ["/api/settings/naming/patterns"],
  }).isLoading;

  // Current naming pattern from settings
  const currentNamingPattern = settings.find((s: Setting) => s.key === 'silver_naming_pattern')?.value || 'datetime';
  const customNamingPattern = settings.find((s: Setting) => s.key === 'custom_naming_pattern')?.value || '';

  const [selectedPattern, setSelectedPattern] = useState(currentNamingPattern);
  const [customPattern, setCustomPattern] = useState(customNamingPattern);
  const [originalPattern, setOriginalPattern] = useState(currentNamingPattern);
  const [originalCustomPattern, setOriginalCustomPattern] = useState(customNamingPattern);

  // AI Configuration state
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiFormData, setAiFormData] = useState({
    provider: "ollama" as "ollama" | "openai" | "both",
    ollamaBaseUrl: "http://localhost:11434",
    ollamaVisionModel: "llava:latest",
    ollamaTextModel: "llama3.2:latest",
    openaiApiKey: "",
    openaiModel: "gpt-4o"
  });

  // Update local state when settings are loaded from server
  React.useEffect(() => {
    if (settings.length > 0) {
      const savedPattern = settings.find((s: Setting) => s.key === 'silver_naming_pattern')?.value || 'datetime';
      const savedCustomPattern = settings.find((s: Setting) => s.key === 'custom_naming_pattern')?.value || '';

      setSelectedPattern(savedPattern);
      setCustomPattern(savedCustomPattern);
      setOriginalPattern(savedPattern);
      setOriginalCustomPattern(savedCustomPattern);
    }
  }, [settings]);

  // Load AI configuration
  React.useEffect(() => {
    loadAiConfig();
  }, []);

  const loadAiConfig = async () => {
    try {
      setAiLoading(true);
      const response = await fetch("/api/ai/config");
      const data = await response.json();
      setAiConfig(data);

      setAiFormData({
        provider: data.currentProvider,
        ollamaBaseUrl: data.config.ollama.baseUrl,
        ollamaVisionModel: data.config.ollama.visionModel,
        ollamaTextModel: data.config.ollama.textModel,
        openaiApiKey: "",
        openaiModel: data.config.openai.model
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load AI configuration",
        variant: "destructive"
      });
    } finally {
      setAiLoading(false);
    }
  };

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiRequest('PUT', `/api/settings/${key}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Updated",
        description: "Your settings have been saved successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Settings update error:', error);
      toast({
        title: "Error",
        description: "Failed to update settings.",
        variant: "destructive",
      });
    },
  });

  // Create setting mutation
  const createSettingMutation = useMutation({
    mutationFn: (data: { key: string; value: string; category: string; description?: string }) =>
      apiRequest('POST', '/api/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Created",
        description: "New setting has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Settings create error:', error);
      toast({
        title: "Error",
        description: "Failed to create setting.",
        variant: "destructive",
      });
    },
  });

  const handleSaveNamingSettings = async () => {
    try {
      console.log('Saving naming settings:', { selectedPattern, customPattern });

      // Update or create the silver naming pattern setting
      const existingSetting = settings.find((s: Setting) => s.key === 'silver_naming_pattern');

      if (existingSetting) {
        await updateSettingMutation.mutateAsync({ key: 'silver_naming_pattern', value: selectedPattern });
      } else {
        await createSettingMutation.mutateAsync({
          key: 'silver_naming_pattern',
          value: selectedPattern,
          category: 'naming',
          description: 'File naming pattern for Silver tier processing'
        });
      }

      // Save custom pattern if using custom
      if (selectedPattern === 'custom' && customPattern.trim()) {
        const existingCustom = settings.find((s: Setting) => s.key === 'custom_naming_pattern');
        if (existingCustom) {
          await updateSettingMutation.mutateAsync({ key: 'custom_naming_pattern', value: customPattern });
        } else {
          await createSettingMutation.mutateAsync({
            key: 'custom_naming_pattern',
            value: customPattern,
            category: 'naming',
            description: 'Custom file naming pattern template'
          });
        }
      }

      // Update original values after successful save
      setOriginalPattern(selectedPattern);
      setOriginalCustomPattern(customPattern);

      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    if (selectedPattern !== originalPattern) return true;
    if (selectedPattern === 'custom' && customPattern !== originalCustomPattern) return true;
    return false;
  };

  const resetToDefaults = () => {
    setSelectedPattern('datetime');
    setCustomPattern('');
  };

  const getPreviewFilename = () => {
    const pattern = selectedPattern === 'custom' ? customPattern : 
      namingPatterns.find((p: NamingPattern) => p.id === selectedPattern)?.pattern || '{originalFilename}';

    // Generate example based on pattern
    const now = new Date();
    let preview = pattern;

    preview = preview.replace('{year}', now.getFullYear().toString());
    preview = preview.replace('{month}', (now.getMonth() + 1).toString().padStart(2, '0'));
    preview = preview.replace('{day}', now.getDate().toString().padStart(2, '0'));
    preview = preview.replace('{hour}', now.getHours().toString().padStart(2, '0'));
    preview = preview.replace('{minute}', now.getMinutes().toString().padStart(2, '0'));
    preview = preview.replace('{second}', now.getSeconds().toString().padStart(2, '0'));
    preview = preview.replace('{camera}', 'CanonEOSR5');
    preview = preview.replace('{aiDescription}', 'SunsetBeach');
    preview = preview.replace('{originalFilename}', 'IMG_2024');

    return preview + '.jpg';
  };

  const testAiProviders = async () => {
    try {
      setAiTesting(true);
      const response = await fetch("/api/ai/test", { method: "POST" });
      const data = await response.json();

      setAiConfig(prev => prev ? {
        ...prev,
        availableProviders: data
      } : null);

      toast({
        title: "Provider Test Complete",
        description: `Ollama: ${data.ollama ? "Available" : "Unavailable"}, OpenAI: ${data.openai ? "Available" : "Unavailable"}`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test AI providers",
        variant: "destructive"
      });
    } finally {
      setAiTesting(false);
    }
  };

  const saveAiConfig = async () => {
    try {
      setAiLoading(true);

      const payload = {
        provider: aiFormData.provider,
        ollama: {
          baseUrl: aiFormData.ollamaBaseUrl,
          visionModel: aiFormData.ollamaVisionModel,
          textModel: aiFormData.ollamaTextModel
        },
        ...(aiFormData.openaiApiKey && {
          openai: {
            apiKey: aiFormData.openaiApiKey,
            model: aiFormData.openaiModel
          }
        })
      };

      const response = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "AI configuration updated successfully"
        });
        loadAiConfig();
      } else {
        throw new Error("Failed to save configuration");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save AI configuration",
        variant: "destructive"
      });
    } finally {
      setAiLoading(false);
    }
  };

  if (settingsLoading || patternsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-card-foreground dark:text-white flex items-center gap-3">
              <SettingsIcon className="h-8 w-8" />
              Settings
            </h1>
            <p className="text-muted-foreground mt-1">Configure Pictallion to match your workflow preferences</p>
          </div>
        </header>

      {/* Settings Tabs */}
      <Tabs defaultValue="naming" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="naming">File Naming</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="ai">AI Configuration</TabsTrigger>
          <TabsTrigger value="ai-prompts">AI Prompts</TabsTrigger>
          <TabsTrigger value="events">Event Detection</TabsTrigger>
        </TabsList>

        <TabsContent value="naming" className="space-y-6">
          {/* Silver Tier Naming Configuration */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            Silver Tier File Naming
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure how files are named when processed from Bronze to Silver tier.
            AI descriptions will be generated automatically when available.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pattern Selection */}
          <div className="space-y-4">
            <Label htmlFor="naming-pattern">Naming Pattern</Label>
            <Select value={selectedPattern} onValueChange={setSelectedPattern}>
              <SelectTrigger className={hasUnsavedChanges() ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800" : ""}>
                <SelectValue placeholder="Select naming pattern" />
              </SelectTrigger>
              <SelectContent>
                {namingPatterns.map((pattern: NamingPattern) => (
                  <SelectItem key={pattern.id} value={pattern.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{pattern.name}</span>
                      <span className="text-xs text-muted-foreground">{pattern.description}</span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="custom">
                  <div className="flex flex-col">
                    <span className="font-medium">Custom Pattern</span>
                    <span className="text-xs text-muted-foreground">Define your own naming pattern</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pattern Details */}
          {selectedPattern !== 'custom' && (
            <div className="p-4 bg-background rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Pattern</Badge>
                  <code className="text-sm bg-card px-2 py-1 rounded">
                    {namingPatterns.find((p: NamingPattern) => p.id === selectedPattern)?.pattern}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Example</Badge>
                  <span className="text-sm text-card-foreground">
                    {namingPatterns.find((p: NamingPattern) => p.id === selectedPattern)?.example}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Custom Pattern Input */}
          {selectedPattern === 'custom' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="custom-pattern">Custom Pattern</Label>
                <Textarea
                  id="custom-pattern"
                  value={customPattern}
                  onChange={(e) => setCustomPattern(e.target.value)}
                  placeholder="Enter your custom naming pattern using placeholders..."
                  className={`mt-1 ${selectedPattern === 'custom' && hasUnsavedChanges() ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800" : ""}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use placeholders like {"{year}"}, {"{month}"}, {"{day}"}, {"{hour}"}, {"{minute}"}, {"{second}"}, {"{camera}"}, {"{aiDescription}"}, {"{originalFilename}"}
                </p>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Generated filename:</span>
                <code className="text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                  {getPreviewFilename()}
                </code>
              </div>
            </div>
          </div>

          {/* Available Placeholders Reference */}
          <div className="space-y-3">
            <Label>Available Placeholders</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <strong>Date & Time:</strong>
                </div>
                <div className="pl-6 space-y-1 text-muted-foreground">
                  <div><code>{"{year}"}</code> - 2024</div>
                  <div><code>{"{month}"}</code> - 07</div>
                  <div><code>{"{day}"}</code> - 26</div>
                  <div><code>{"{hour}"}</code> - 14</div>
                  <div><code>{"{minute}"}</code> - 30</div>
                  <div><code>{"{second}"}</code> - 25</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <strong>Camera & Content:</strong>
                </div>
                <div className="pl-6 space-y-1 text-muted-foreground">
                  <div><code>{"{camera}"}</code> - CanonEOSR5</div>
                  <div><code>{"{lens}"}</code> - 24-70mmf28</div>
                  <div><code>{"{aiDescription}"}</code> - SunsetBeach</div>
                  <div><code>{"{originalFilename}"}</code> - IMG_2024</div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
            <Button
              onClick={handleSaveNamingSettings}
              disabled={updateSettingMutation.isPending || createSettingMutation.isPending}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {(updateSettingMutation.isPending || createSettingMutation.isPending) ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Integration Notice */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">AI Description Generation</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                When processing photos from Bronze to Silver tier, Pictallion will automatically generate 
                2-3 word AI descriptions in PascalCase format (e.g., "SunsetBeach", "FamilyDinner"). 
                These descriptions are used in the filename patterns marked with {"{aiDescription}"}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          {/* AI Provider Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Provider Status
              </CardTitle>
              <p className="text-sm text-muted-foreground">Current availability of AI providers</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiConfig && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Ollama (Local)</span>
                    {aiConfig.availableProviders.ollama ? (
                      <Badge variant="default" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                        <XCircle className="h-3 w-3 mr-1" />
                        Unavailable
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">OpenAI (Cloud)</span>
                    {aiConfig.availableProviders.openai ? (
                      <Badge variant="default" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                        <XCircle className="h-3 w-3 mr-1" />
                        {aiConfig.config.openai.hasApiKey ? "Key Invalid" : "No API Key"}
                      </Badge>
                    )}
                  </div>
                </>
              )}
              <Button onClick={testAiProviders} disabled={aiTesting} size="sm" variant="outline">
                {aiTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Test Providers
              </Button>
            </CardContent>
          </Card>

          {/* AI Provider Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Provider Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">Configure AI providers for photo analysis</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="ollama">Ollama</TabsTrigger>
                  <TabsTrigger value="openai">OpenAI</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider">Preferred AI Provider</Label>
                    <Select value={aiFormData.provider} onValueChange={(value: any) => setAiFormData(prev => ({ ...prev, provider: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ollama">Ollama Only (Local)</SelectItem>
                        <SelectItem value="openai">OpenAI Only (Cloud)</SelectItem>
                        <SelectItem value="both">Both (Ollama First, OpenAI Fallback)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Choose which AI provider to use for photo analysis. "Both" tries Ollama first, then falls back to OpenAI.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="ollama" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ollamaBaseUrl">Ollama Base URL</Label>
                    <Input
                      id="ollamaBaseUrl"
                      value={aiFormData.ollamaBaseUrl}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, ollamaBaseUrl: e.target.value }))}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ollamaVisionModel">Vision Model</Label>
                    <Input
                      id="ollamaVisionModel"
                      value={aiFormData.ollamaVisionModel}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, ollamaVisionModel: e.target.value }))}
                      placeholder="llava:latest"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ollamaTextModel">Text Model</Label>
                    <Input
                      id="ollamaTextModel"
                      value={aiFormData.ollamaTextModel}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, ollamaTextModel: e.target.value }))}
                      placeholder="llama3.2:latest"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="openai" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="openaiApiKey">API Key</Label>
                    <Input
                      id="openaiApiKey"
                      type="password"
                      value={aiFormData.openaiApiKey}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                      placeholder="Enter your OpenAI API key"
                    />
                    <p className="text-sm text-muted-foreground">
                      {aiConfig?.config.openai.hasApiKey ? "API key is configured" : "No API key set"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openaiModel">Model</Label>
                    <Select value={aiFormData.openaiModel} onValueChange={(value) => setAiFormData(prev => ({ ...prev, openaiModel: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini (Faster)</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end">
                <Button onClick={saveAiConfig} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save AI Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Display Settings Tab */}
        <TabsContent value="display" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Display Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date Format Setting */}
              <div>
                <Label htmlFor="dateFormat" className="text-sm font-semibold">Date Format on Photo Cards</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose how dates appear on your polaroid photo cards
                </p>
                <Select defaultValue="short">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select date format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (Jan 15, 2024)</SelectItem>
                    <SelectItem value="long">Long (January 15, 2024)</SelectItem>
                    <SelectItem value="numeric">Numeric (01/15/2024)</SelectItem>
                    <SelectItem value="iso">ISO Format (2024-01-15)</SelectItem>
                    <SelectItem value="relative">Relative (2 days ago)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex justify-end">
                <Button className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save Display Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Prompts Management Tab */}
        <TabsContent value="ai-prompts" className="space-y-6">
          <AIPromptsSettings />
        </TabsContent>

        {/* Event Detection Settings Tab */}
        <TabsContent value="events" className="space-y-6">
          <EventSettings />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}