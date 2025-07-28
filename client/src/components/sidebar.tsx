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
  Users,
  Copy, // Added Copy icon
  Zap  // For burst photo icon
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

import pictallionLogo from "../assets/pictallion-logo.png";
import { ThemeToggle } from "./ui/theme-toggle";

const navigationItems = [
  { path: "/dashboard", label: "Home", icon: ChartLine },
  { path: "/gallery", label: "Photos", icon: Images },
  { path: "/upload", label: "Upload", icon: Upload },
  { path: "/collections", label: "Albums", icon: Images },
  { path: "/people", label: "People", icon: Users },
  { path: "/burst-selection", label: "Burst Photos", icon: Zap },
  { path: "/duplicates", label: "Duplicates", icon: Copy },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();


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
        <div className="flex items-center justify-between gap-2 px-4 py-6">
          <div className="flex flex-col items-center space-y-3">
            <img 
              src={pictallionLogo} 
              alt="Pictallion Logo" 
              className="w-full max-w-[200px] h-auto object-contain filter drop-shadow-sm"
            />
          </div>
          <ThemeToggle />
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


    </aside>
  );
}