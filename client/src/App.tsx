import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { ThemeProvider } from "./contexts/theme-context";
import Dashboard from "./pages/dashboard";
import Gallery from "@/pages/gallery";
import Upload from "@/pages/upload";
import Search from "@/pages/search";
import { Collections } from "./pages/collections";
import { SilverReview } from "./pages/silver-review";
import { IgnoredFaces } from "./pages/ignored-faces";
import People from "@/pages/people";
import Duplicates from "@/pages/duplicates";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/sidebar";
import BurstSelectionPage from "./pages/burst-selection";

function Router() {
  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/gallery" component={Gallery} />
          <Route path="/upload" component={Upload} />
          <Route path="/search" component={Search} />
          <Route path="/collections" component={Collections} />
          <Route path="/silver-review" component={SilverReview} />
          <Route path="/burst-selection" component={BurstSelectionPage} />
          <Route path="/ignored-faces" component={IgnoredFaces} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;