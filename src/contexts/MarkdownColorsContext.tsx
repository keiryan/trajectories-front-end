import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";

export interface MarkdownColors {
  heading: string;
  text: string;
  link: string;
  linkHover: string;
  codeBg: string;
  codeText: string;
  blockquoteBorder: string;
  blockquoteBg: string;
  tableBorder: string;
}

const DEFAULT_COLORS: MarkdownColors = {
  heading: "280 100% 85%",
  text: "220 13% 90%",
  link: "200 100% 70%",
  linkHover: "180 100% 65%",
  codeBg: "220 13% 15%",
  codeText: "150 80% 70%",
  blockquoteBorder: "280 100% 70%",
  blockquoteBg: "280 50% 10%",
  tableBorder: "220 13% 20%",
};

const STORAGE_KEY = "markdown_color_preferences";

interface MarkdownColorsContextType {
  colors: MarkdownColors;
  updateColor: (key: keyof MarkdownColors, value: string) => void;
  resetColors: () => void;
  setDarkElement: (element: HTMLElement | null) => void;
}

const MarkdownColorsContext = createContext<MarkdownColorsContextType | undefined>(undefined);

export const MarkdownColorsProvider = ({ children }: { children: ReactNode }) => {
  const darkElementRef = useRef<HTMLElement | null>(null);
  
  const [colors, setColors] = useState<MarkdownColors>(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_COLORS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_COLORS;
      }
    }
    return DEFAULT_COLORS;
  });

  // Helper to apply colors to an element
  const applyColorsToElement = useCallback((element: HTMLElement) => {
    element.style.setProperty("--markdown-heading", colors.heading, "important");
    element.style.setProperty("--markdown-text", colors.text, "important");
    element.style.setProperty("--markdown-link", colors.link, "important");
    element.style.setProperty("--markdown-link-hover", colors.linkHover, "important");
    element.style.setProperty("--markdown-code-bg", colors.codeBg, "important");
    element.style.setProperty("--markdown-code-text", colors.codeText, "important");
    element.style.setProperty("--markdown-blockquote-border", colors.blockquoteBorder, "important");
    element.style.setProperty("--markdown-blockquote-bg", colors.blockquoteBg, "important");
    element.style.setProperty("--markdown-table-border", colors.tableBorder, "important");
  }, [colors]);

  // Apply colors to CSS variables whenever they change
  useEffect(() => {
    const root = document.documentElement;
    const darkElement = darkElementRef.current || document.querySelector('.dark') as HTMLElement;
    
    // Set variables on root (for light mode if needed)
    root.style.setProperty("--markdown-heading", colors.heading);
    root.style.setProperty("--markdown-text", colors.text);
    root.style.setProperty("--markdown-link", colors.link);
    root.style.setProperty("--markdown-link-hover", colors.linkHover);
    root.style.setProperty("--markdown-code-bg", colors.codeBg);
    root.style.setProperty("--markdown-code-text", colors.codeText);
    root.style.setProperty("--markdown-blockquote-border", colors.blockquoteBorder);
    root.style.setProperty("--markdown-blockquote-bg", colors.blockquoteBg);
    root.style.setProperty("--markdown-table-border", colors.tableBorder);
    
    // Also set on .dark element to override the .dark CSS selector with important flag
    if (darkElement) {
      applyColorsToElement(darkElement);
    }
  }, [colors, applyColorsToElement]);

  const setDarkElement = (element: HTMLElement | null) => {
    darkElementRef.current = element;
    // Immediately apply colors when element is set
    if (element) {
      applyColorsToElement(element);
    }
  };

  const updateColor = (key: keyof MarkdownColors, value: string) => {
    const newColors = { ...colors, [key]: value };
    setColors(newColors);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newColors));
  };

  const resetColors = () => {
    setColors(DEFAULT_COLORS);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <MarkdownColorsContext.Provider value={{ colors, updateColor, resetColors, setDarkElement }}>
      {children}
    </MarkdownColorsContext.Provider>
  );
};

export const useMarkdownColors = () => {
  const context = useContext(MarkdownColorsContext);
  if (context === undefined) {
    throw new Error("useMarkdownColors must be used within a MarkdownColorsProvider");
  }
  return context;
};

