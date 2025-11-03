import { useRef, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MarkdownColorsProvider, useMarkdownColors } from "@/contexts/MarkdownColorsContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const darkDivRef = useRef<HTMLDivElement>(null);
  const { setDarkElement } = useMarkdownColors();

  useEffect(() => {
    if (darkDivRef.current) {
      setDarkElement(darkDivRef.current);
    }
    return () => setDarkElement(null);
  }, [setDarkElement]);

  return (
    <div ref={darkDivRef} className="dark">
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <MarkdownColorsProvider>
        <AppContent />
      </MarkdownColorsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
