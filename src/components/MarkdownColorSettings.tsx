import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings, RotateCcw } from "lucide-react";
import { useMarkdownColors } from "@/contexts/MarkdownColorsContext";

// Helper function to convert HSL string to hex for color input
const hslToHex = (hsl: string): string => {
  const [h, s, l] = hsl.split(" ").map((v) => parseFloat(v));
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  let r, g, b;
  if (sNorm === 0) {
    r = g = b = lNorm;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;
    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Helper function to convert hex to HSL string
const hexToHsl = (hex: string): string => {
  // Ensure hex has # prefix and is 6 characters
  const normalizedHex = hex.startsWith("#") ? hex : `#${hex}`;
  const hexWithoutHash = normalizedHex.slice(1);
  
  if (hexWithoutHash.length !== 6) {
    // Fallback to default blue if invalid
    return "217 100% 80%";
  }
  
  const r = parseInt(hexWithoutHash.slice(0, 2), 16) / 255;
  const g = parseInt(hexWithoutHash.slice(2, 4), 16) / 255;
  const b = parseInt(hexWithoutHash.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

interface ColorPickerProps {
  label: string;
  colorKey: keyof ReturnType<typeof useMarkdownColors>["colors"];
  description?: string;
}

const ColorPicker = ({ label, colorKey, description }: ColorPickerProps) => {
  const { colors, updateColor } = useMarkdownColors();
  const hexValue = hslToHex(colors[colorKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const hsl = hexToHsl(hex);
    updateColor(colorKey, hsl);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={colorKey} className="text-sm font-medium">
          {label}
        </Label>
        <div
          className="w-8 h-8 rounded border border-border"
          style={{ backgroundColor: `hsl(${colors[colorKey]})` }}
        />
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="flex items-center gap-2">
        <input
          id={colorKey}
          type="color"
          value={hexValue}
          onChange={handleChange}
          className="h-10 w-20 rounded border border-border cursor-pointer"
        />
        <input
          type="text"
          value={colors[colorKey]}
          onChange={(e) => {
            const value = e.target.value;
            // Basic validation: should match pattern like "217 100% 80%"
            if (value === "" || /^\d+\s+\d+%\s+\d+%$/.test(value)) {
              updateColor(colorKey, value);
            }
          }}
          className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm font-mono"
          placeholder="H S% L%"
        />
      </div>
    </div>
  );
};

export const MarkdownColorSettings = () => {
  const [open, setOpen] = useState(false);
  const { resetColors } = useMarkdownColors();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Markdown Color Settings</SheetTitle>
          <SheetDescription>
            Customize the colors used in markdown rendering. Colors are stored in HSL format (Hue Saturation% Lightness%).
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <ColorPicker
            colorKey="heading"
            label="Heading Color"
            description="Color for all markdown headings (h1-h6)"
          />
          <ColorPicker
            colorKey="text"
            label="Text Color"
            description="Color for regular markdown text"
          />
          <ColorPicker
            colorKey="link"
            label="Link Color"
            description="Color for links in markdown"
          />
          <ColorPicker
            colorKey="linkHover"
            label="Link Hover Color"
            description="Color for links when hovering"
          />
          <ColorPicker
            colorKey="codeBg"
            label="Code Background"
            description="Background color for inline code"
          />
          <ColorPicker
            colorKey="codeText"
            label="Code Text"
            description="Text color for inline code"
          />
          <ColorPicker
            colorKey="blockquoteBorder"
            label="Blockquote Border"
            description="Left border color for blockquotes"
          />
          <ColorPicker
            colorKey="blockquoteBg"
            label="Blockquote Background"
            description="Background color for blockquotes"
          />
          <ColorPicker
            colorKey="tableBorder"
            label="Table Border"
            description="Border color for tables"
          />
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                resetColors();
              }}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default Colors
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

