import { useEffect, useState } from "react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Github,
  AlertCircle,
  ListChecks,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getRecordsByUniqueId } from "@/lib/airtable";

const USER_ID_STORAGE_KEY = "markdown_viewer_user_id";

interface Task {
  id: string;
  fields: {
    "Task Number"?: string;
    "Link to Task"?: string;
    Status?: string;
    "Unique ID"?: string;
    [key: string]: any;
  };
}

const Index = () => {
  const [userId, setUserId] = useState<string>("");
  const [hasUserId, setHasUserId] = useState<boolean>(false);
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedTaskLink, setSelectedTaskLink] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [isTasksCollapsed, setIsTasksCollapsed] = useState(false);

  // Load userId from localStorage on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem(USER_ID_STORAGE_KEY);
    if (storedUserId) {
      setUserId(storedUserId);
      setHasUserId(true);
      fetchTasksForUser(storedUserId);
    }
  }, []);

  const fetchTasksForUser = async (id: string) => {
    setLoadingTasks(true);
    setTaskError(null);
    setTasks([]);

    try {
      const records = await getRecordsByUniqueId(id);
      setTasks(records);

      if (records.length === 0) {
        setTaskError("No tasks found for this user ID");
        toast({
          title: "No Tasks Found",
          description: "No tasks found for this user ID",
        });
      } else {
        toast({
          title: "Success",
          description: `Found ${records.length} task(s)`,
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch tasks";
      setTaskError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleUserIdClick = () => {
    const trimmedUserId = userId.trim();
    if (trimmedUserId) {
      localStorage.setItem(USER_ID_STORAGE_KEY, trimmedUserId);
      setHasUserId(true);
      fetchTasksForUser(trimmedUserId);
    }
  };

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
    setMarkdown("");

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
      setSelectedTaskLink(url);
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

  const handleTaskClick = (task: Task) => {
    const taskLink = task.fields["Link to Task"];
    if (taskLink) {
      fetchMarkdown(taskLink);
    } else {
      toast({
        title: "Error",
        description: "This task does not have a link",
        variant: "destructive",
      });
    }
  };

  const handleClearUserId = () => {
    localStorage.removeItem(USER_ID_STORAGE_KEY);
    setUserId("");
    setHasUserId(false);
    setTasks([]);
    setMarkdown("");
    setSelectedTaskLink(null);
    setTaskError(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <Github className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-semibold font-sans text-foreground">
                Markdown Viewer
              </h1>
            </div>

            {hasUserId && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-sans">
                  User ID: {userId || localStorage.getItem(USER_ID_STORAGE_KEY)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearUserId}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change User
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!hasUserId && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="p-6 w-full max-w-md">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  return false;
                }}
                noValidate
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="user-id" className="font-sans mb-2 block">
                    Enter User ID
                  </Label>
                  <Input
                    id="user-id"
                    type="text"
                    placeholder="Enter your User ID"
                    value={userId}
                    onChange={(e) => {
                      setUserId(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      // Prevent any form submission on keydown except explicit Enter
                      if (e.key !== "Enter") {
                        return;
                      }
                      e.preventDefault();
                      e.stopPropagation();
                      const trimmed = userId.trim();
                      if (trimmed) {
                        handleUserIdClick();
                      }
                    }}
                    className="font-sans"
                    autoComplete="off"
                    autoFocus={false}
                  />
                </div>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleUserIdClick();
                  }}
                  onMouseDown={(e) => {
                    // Prevent any form submission on button press
                    e.preventDefault();
                  }}
                  disabled={!userId.trim()}
                  className="w-full"
                >
                  Load Tasks
                </Button>
              </form>
            </Card>
          </div>
        )}

        {hasUserId && (
          <div className="flex gap-6 mb-8">
            {/* Tasks List */}
            <div
              className={`transition-all duration-300 ease-in-out shrink-0 ${
                isTasksCollapsed
                  ? "w-0 opacity-0 overflow-hidden pointer-events-none"
                  : "w-full lg:w-1/3 opacity-100"
              }`}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold font-sans">Tasks</h2>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsTasksCollapsed(true)}
                      className="h-8 w-8"
                      aria-label="Collapse tasks"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>

                  {loadingTasks && (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground font-sans">
                          Loading tasks...
                        </p>
                      </div>
                    </div>
                  )}

                  {taskError && !loadingTasks && (
                    <Card className="p-4 border-destructive/50 bg-destructive/5">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-destructive font-sans">
                          {taskError}
                        </div>
                      </div>
                    </Card>
                  )}

                  {!loadingTasks && !taskError && tasks.length > 0 && (
                    <div className="space-y-2">
                      {tasks.map((task) => {
                        const taskNumber = task.fields["Task Number"] || "N/A";
                        const taskLink = task.fields["Link to Task"];
                        const status = task.fields["Status"] || "Unknown";
                        const isSelected = selectedTaskLink === taskLink;

                        return (
                          <Card
                            key={task.id}
                            className={`p-4 cursor-pointer transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "hover:bg-accent"
                            }`}
                            onClick={() => handleTaskClick(task)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="font-semibold font-sans mb-1">
                                  Task #{taskNumber}
                                </div>
                                {taskLink && (
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <ExternalLink className="h-3 w-3" />
                                    <span className="truncate font-sans">
                                      {taskLink.length > 40
                                        ? `${taskLink.substring(0, 40)}...`
                                        : taskLink}
                                    </span>
                                  </div>
                                )}
                                {status && (
                                  <div className="mt-2">
                                    <span className="inline-block px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground font-sans">
                                      {status}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {!loadingTasks && !taskError && tasks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground font-sans">
                      No tasks available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Collapse Button when tasks are collapsed */}
            {isTasksCollapsed && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsTasksCollapsed(false)}
                className="h-10 w-10 shrink-0 self-start sticky top-8"
                aria-label="Expand tasks"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}

            {/* Markdown Viewer */}
            <div className="flex-1 min-w-0 transition-all duration-300">
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
                    Select a Task
                  </h2>
                  <p className="text-muted-foreground font-sans max-w-md mx-auto">
                    Select a task from the list on the left to view its markdown
                    content.
                  </p>
                </Card>
              )}

              {markdown && !error && (
                <Card className="p-8 md:p-12 max-w-4xl mx-auto overflow-hidden">
                  <div className="max-w-full overflow-x-auto">
                    <MarkdownViewer
                      content={markdown}
                      url={selectedTaskLink || undefined}
                    />
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
