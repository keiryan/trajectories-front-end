import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Github, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState("");

  const urlParam = searchParams.get("url");

  const convertToRawUrl = (githubUrl: string): string => {
    try {
      const url = new URL(githubUrl);

      // Only process github.com URLs
      if (!url.hostname.includes("github.com")) {
        throw new Error("URL must be a GitHub URL");
      }

      // Handle blob URLs: github.com/user/repo/blob/branch/path/to/file
      if (url.pathname.includes("/blob/")) {
        const pathParts = url.pathname.split("/blob/");
        if (pathParts.length !== 2) {
          throw new Error("Invalid GitHub blob URL format");
        }
        const [repoPath, filePath] = pathParts;
        return `https://raw.githubusercontent.com${repoPath}/${filePath}`;
      }

      // Handle repository URLs without blob - default to main branch README.md
      // github.com/user/repo -> raw.githubusercontent.com/user/repo/main/README.md
      const pathMatch = url.pathname.match(/^\/([^\/]+)\/([^\/]+)/);
      if (pathMatch) {
        const [, owner, repo] = pathMatch;
        // Remove .git if present
        const cleanRepo = repo.replace(/\.git$/, "");
        return `https://raw.githubusercontent.com/${owner}/${cleanRepo}/main/README.md`;
      }

      throw new Error("Invalid GitHub URL format");
    } catch (err) {
      if (err instanceof Error && err.message.includes("Invalid")) {
        throw err;
      }
      throw new Error("Invalid URL format");
    }
  };

  const fetchMarkdown = async (url: string) => {
    setLoading(true);
    setError(null);

    try {
      const rawUrl = convertToRawUrl(url);
      const response = await fetch(rawUrl);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch markdown file: ${response.status} ${response.statusText}`
        );
      }

      const text = await response.text();
      setMarkdown(text);
      toast({
        title: "Success",
        description: "Markdown file loaded successfully",
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlParam) {
      setInputUrl(urlParam);
      fetchMarkdown(urlParam);
    }
  }, [urlParam]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl) {
      setSearchParams({ url: inputUrl });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Github className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold font-sans text-foreground">
              Markdown Viewer
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl">
            <Input
              type="url"
              placeholder="Paste GitHub markdown URL (e.g., https://github.com/user/repo/blob/main/file.md)"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="font-sans"
            />
            <Button type="submit" disabled={loading || !inputUrl}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading
                </>
              ) : (
                "Load"
              )}
            </Button>
          </form>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading && !markdown && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground font-sans">
                Loading markdown...
              </p>
            </div>
          </div>
        )}

        {error && (
          <Card className="p-6 border-destructive/50 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="font-semibold font-sans text-destructive mb-1">
                  Error Loading Markdown
                </h3>
                <p className="text-sm text-muted-foreground font-sans">
                  {error}
                </p>
              </div>
            </div>
          </Card>
        )}

        {!markdown && !loading && !error && (
          <Card className="p-12 text-center">
            <Github className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold font-sans mb-2">
              Welcome to Markdown Viewer
            </h2>
            <p className="text-muted-foreground font-sans max-w-md mx-auto">
              Paste a GitHub markdown file URL above to get started. The
              markdown will be beautifully rendered with syntax highlighting.
            </p>
          </Card>
        )}

        {markdown && !error && (
          <Card className="p-8 md:p-12 max-w-4xl mx-auto overflow-hidden">
            <div className="max-w-full overflow-x-auto">
              <MarkdownViewer content={markdown} url={urlParam || inputUrl} />
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Index;
