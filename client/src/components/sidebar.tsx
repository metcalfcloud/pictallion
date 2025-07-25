import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Camera, 
  ChartLine, 
  Images, 
  Upload, 
  Settings, 
  Search,
  Bell,
  Brain,
  Users
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { AISettingsModal } from "./ai-settings-modal";
import pictallionLogo from "../assets/pictallion-logo.png";

const navigationItems = [
  { path: "/dashboard", label: "Dashboard", icon: ChartLine },
  { path: "/gallery", label: "Gallery", icon: Images },
  { path: "/upload", label: "Upload", icon: Upload },
  { path: "/collections", label: "Collections", icon: Images },
  { path: "/silver-review", label: "Silver Review", icon: Camera },
  { path: "/people", label: "People & Faces", icon: Users },
  { path: "/search", label: "Search", icon: Search },
];

export default function Sidebar() {
  const [location] = useLocation();
  const [showAISettings, setShowAISettings] = useState(false);

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location === "/" || location === "/dashboard";
    }
    return location.startsWith(path);
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col items-center space-y-3">
          <img 
            src={pictallionLogo} 
            alt="Pictallion Logo" 
            className="w-full max-w-[200px] h-auto object-contain filter drop-shadow-sm"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Button
              key={item.path}
              variant={active ? "default" : "ghost"}
              className={cn(
                "w-full justify-start",
                active && "bg-primary text-primary-foreground"
              )}
              asChild
            >
              <Link href={item.path}>
                <Icon className="w-4 h-4 mr-3" />
                {item.label}
                {item.label === "Processing" && (
                  <span className="ml-auto bg-warning text-white text-xs px-2 py-1 rounded-full">
                    3
                  </span>
                )}
              </Link>
            </Button>
          );
        })}
      </nav>

      {/* AI & Settings */}
      <div className="p-4 border-t border-gray-200">
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setShowAISettings(true)}
          >
            <Brain className="w-4 h-4 mr-3" />
            AI Settings
          </Button>
        </div>
      </div>

      {/* Storage Info */}
      <div className="p-4 border-t border-gray-200">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Storage</span>
              <span className="text-sm text-gray-500">68%</span>
            </div>
            <Progress value={68} className="h-2 mb-1" />
            <p className="text-xs text-gray-500">2.1 GB of 3.0 GB used</p>
          </CardContent>
        </Card>
      </div>

      <AISettingsModal 
        open={showAISettings} 
        onOpenChange={setShowAISettings} 
      />
    </aside>
  );
}
