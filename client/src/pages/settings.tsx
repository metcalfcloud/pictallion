import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Settings as SettingsIcon, 
  FileImage, 
  Sparkles, 
  Save, 
  RotateCcw,
  Calendar,
  Camera,
  Brain,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current settings
  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/settings"],
  });

  // Fetch naming patterns
  const { data: namingPatterns = [], isLoading: patternsLoading } = useQuery({
    queryKey: ["/api/settings/naming/patterns"],
  });

  // Current naming pattern from settings
  const currentNamingPattern = settings.find((s: Setting) => s.key === 'silver_naming_pattern')?.value || 'datetime';
  const customNamingPattern = settings.find((s: Setting) => s.key === 'custom_naming_pattern')?.value || '';

  const [selectedPattern, setSelectedPattern] = useState(currentNamingPattern);
  const [customPattern, setCustomPattern] = useState(customNamingPattern);

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

  if (settingsLoading || patternsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <SettingsIcon className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-gray-500 mt-1">Configure Pictallion to match your workflow preferences</p>
        </div>
      </header>

      {/* Silver Tier Naming Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            Silver Tier File Naming
          </CardTitle>
          <p className="text-sm text-gray-600">
            Configure how files are named when processed from Bronze to Silver tier.
            AI descriptions will be generated automatically when available.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pattern Selection */}
          <div className="space-y-4">
            <Label htmlFor="naming-pattern">Naming Pattern</Label>
            <Select value={selectedPattern} onValueChange={setSelectedPattern}>
              <SelectTrigger>
                <SelectValue placeholder="Select naming pattern" />
              </SelectTrigger>
              <SelectContent>
                {namingPatterns.map((pattern: NamingPattern) => (
                  <SelectItem key={pattern.id} value={pattern.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{pattern.name}</span>
                      <span className="text-xs text-gray-500">{pattern.description}</span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="custom">
                  <div className="flex flex-col">
                    <span className="font-medium">Custom Pattern</span>
                    <span className="text-xs text-gray-500">Define your own naming pattern</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pattern Details */}
          {selectedPattern !== 'custom' && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Pattern</Badge>
                  <code className="text-sm bg-white px-2 py-1 rounded">
                    {namingPatterns.find((p: NamingPattern) => p.id === selectedPattern)?.pattern}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Example</Badge>
                  <span className="text-sm text-gray-700">
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
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use placeholders like {"{year}"}, {"{month}"}, {"{day}"}, {"{hour}"}, {"{minute}"}, {"{second}"}, {"{camera}"}, {"{aiDescription}"}, {"{originalFilename}"}
                </p>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Generated filename:</span>
                <code className="text-sm bg-blue-100 px-2 py-1 rounded text-blue-800">
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
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <strong>Date & Time:</strong>
                </div>
                <div className="pl-6 space-y-1 text-gray-600">
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
                  <Camera className="h-4 w-4 text-gray-500" />
                  <strong>Camera & Content:</strong>
                </div>
                <div className="pl-6 space-y-1 text-gray-600">
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
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-1">AI Description Generation</h3>
              <p className="text-sm text-blue-800">
                When processing photos from Bronze to Silver tier, Pictallion will automatically generate 
                2-3 word AI descriptions in PascalCase format (e.g., "SunsetBeach", "FamilyDinner"). 
                These descriptions are used in the filename patterns marked with {"{aiDescription}"}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}