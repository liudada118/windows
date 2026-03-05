import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import EditorPage from "./pages/EditorPage";
import ShowcasePage from "./pages/ShowcasePage";

function Router() {
  // 使用环境变量中的base路径，支持子路径部署
  const base = import.meta.env.BASE_URL.replace(/\/$/, '') || '';
  return (
    <WouterRouter base={base}>
      <Switch>
        <Route path={"/"} component={EditorPage} />
        <Route path={"/showcase"} component={ShowcasePage} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
