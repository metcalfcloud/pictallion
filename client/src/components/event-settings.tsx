import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Globe, Users, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface HolidaySet {
  code: string;
  name: string;
  count: number;
}

export default function EventSettings() {
  const [enabledHolidays, setEnabledHolidays] = useState<string[]>(['US']);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get available holiday sets
  const { data: holidaySets = [] } = useQuery<HolidaySet[]>({
    queryKey: ['/api/events/holiday-sets'],
  });

  // Get current holiday settings
  const { data: currentSettings } = useQuery({
    queryKey: ['/api/settings/enabled_holidays'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/settings/enabled_holidays');
        const setting = await response.json();
        return setting?.value ? JSON.parse(setting.value) : ['US'];
      } catch (error) {
        return ['US']; // Default fallback
      }
    },
  });

  // Initialize enabled holidays when settings load
  useEffect(() => {
    if (currentSettings) {
      setEnabledHolidays(currentSettings);
    }
  }, [currentSettings]);

  // Save holiday settings mutation
  const saveHolidaySettings = useMutation({
    mutationFn: async (holidays: string[]) => {
      const response = await apiRequest('PUT', '/api/settings/enabled_holidays', {
        value: JSON.stringify(holidays)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/enabled_holidays'] });
      toast({
        title: "Settings Saved",
        description: "Holiday detection settings updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save holiday settings.",
        variant: "destructive"
      });
    }
  });

  const handleHolidayToggle = (countryCode: string, enabled: boolean) => {
    if (enabled) {
      setEnabledHolidays(prev => [...prev, countryCode]);
    } else {
      setEnabledHolidays(prev => prev.filter(code => code !== countryCode));
    }
  };

  const handleSave = () => {
    saveHolidaySettings.mutate(enabledHolidays);
  };

  const hasChanges = JSON.stringify(enabledHolidays) !== JSON.stringify(currentSettings || ['US']);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Event Detection Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Holiday Detection */}
        <div>
          <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Holiday Detection
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose which country's holidays to automatically detect in your photos.
          </p>
          
          <div className="space-y-3">
            {holidaySets.map((holidaySet) => (
              <div key={holidaySet.code} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={enabledHolidays.includes(holidaySet.code)}
                    onCheckedChange={(checked) => handleHolidayToggle(holidaySet.code, checked)}
                  />
                  <div>
                    <Label className="text-sm font-medium">{holidaySet.name}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {holidaySet.count} holidays
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Birthday Detection */}
        <div>
          <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Birthday Detection
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Birthday events are automatically detected based on people's birthdate information and the photo's taken date.
          </p>
          
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Switch checked={true} disabled />
              <Label className="text-sm font-medium">Automatic Birthday Detection</Label>
              <Badge variant="outline" className="text-xs">Always On</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              This feature automatically calculates ages and detects birthday events when people have birthdate information.
            </p>
          </div>
        </div>

        <Separator />

        {/* Save Button */}
        {hasChanges && (
          <div className="flex justify-end">
            <Button 
              onClick={handleSave}
              disabled={saveHolidaySettings.isPending}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saveHolidaySettings.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}