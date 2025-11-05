import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { MarkdownColorSettings } from "@/components/MarkdownColorSettings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Loader2,
  Github,
  AlertCircle,
  ListChecks,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowUpToLine,
  ArrowUp,
  BookmarkPlus,
  MapPin,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getRecordsByUniqueId } from "@/lib/airtable";

const USER_ID_STORAGE_KEY = "markdown_viewer_user_id";

type SectionAnchor = {
  id: string;
  title: string;
  top: number;
};

type ScrollMark = {
  anchorId: string;
  snippet: string;
  sectionTitle: string | null;
  createdAt: number;
};

const SECTION_SCROLL_OFFSET = 160;

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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [isTasksCollapsed, setIsTasksCollapsed] = useState(false);
  const [showJumpToTop, setShowJumpToTop] = useState(false);
  const [hasSectionAnchors, setHasSectionAnchors] = useState(false);
  const [marks, setMarks] = useState<ScrollMark[]>([]);

  const sectionAnchorsRef = useRef<SectionAnchor[]>([]);
  const recalcRafRef = useRef<number | null>(null);
  const markRegistryRef = useRef<Record<string, { anchor: HTMLElement; target: HTMLElement }>>({});

  // Load userId from localStorage on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem(USER_ID_STORAGE_KEY);
    if (storedUserId) {
      setUserId(storedUserId);
      setHasUserId(true);
      fetchTasksForUser(storedUserId);
    }
  }, []);

  const recalcSections = useCallback(() => {
    const article = document.querySelector<HTMLElement>(".markdown-content");

    if (!article) {
      if (sectionAnchorsRef.current.length > 0) {
        sectionAnchorsRef.current = [];
        setHasSectionAnchors(false);
      }
      return;
    }

    const headingElements = Array.from(
      article.querySelectorAll<HTMLElement>("[data-anchor-section='true']")
    );

    const sections = headingElements.map<SectionAnchor>((element) => ({
      id: element.id,
      title: element.dataset.sectionTitle?.trim() || element.textContent?.trim() || element.id,
      top: element.getBoundingClientRect().top + window.scrollY,
    }));

    sections.sort((a, b) => a.top - b.top);

    sectionAnchorsRef.current = sections;
    setHasSectionAnchors(sections.length > 0);
  }, []);

  const scheduleSectionMeasurement = useCallback(() => {
    if (recalcRafRef.current !== null) {
      cancelAnimationFrame(recalcRafRef.current);
    }

    recalcRafRef.current = window.requestAnimationFrame(() => {
      recalcSections();
      recalcRafRef.current = null;
    });
  }, [recalcSections]);

  const findSectionForOffset = useCallback((offset: number): SectionAnchor | null => {
    const sections = sectionAnchorsRef.current;
    if (sections.length === 0) {
      return null;
    }

    let candidate: SectionAnchor | null = sections[0];
    for (let i = 0; i < sections.length; i += 1) {
      const section = sections[i];
      if (section.top <= offset + SECTION_SCROLL_OFFSET) {
        candidate = section;
      } else {
        break;
      }
    }

    return candidate;
  }, []);

  const removeMarkFromDom = useCallback((anchorId: string) => {
    const entry = markRegistryRef.current[anchorId];
    if (!entry) {
      return;
    }

    const { anchor, target } = entry;

    if (target) {
      target.classList.remove("marked-scroll-target");
      if (target.getAttribute("data-mark-highlight") === anchorId) {
        target.removeAttribute("data-mark-highlight");
      }
    }

    if (anchor && anchor.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }

    delete markRegistryRef.current[anchorId];
  }, []);

  const clearMarks = useCallback(() => {
    const anchorIds = Object.keys(markRegistryRef.current);
    anchorIds.forEach((id) => removeMarkFromDom(id));

    markRegistryRef.current = {};
    setMarks((prev) => (prev.length > 0 ? [] : prev));
  }, [removeMarkFromDom]);

  useEffect(() => {
    sectionAnchorsRef.current = [];

    if (!markdown) {
      setHasSectionAnchors(false);
      clearMarks();
      setShowJumpToTop((prev) => (prev ? false : prev));
      return;
    }

    clearMarks();
    scheduleSectionMeasurement();

    window.addEventListener("resize", scheduleSectionMeasurement);

    const article = document.querySelector(".markdown-content");
    let resizeObserver: ResizeObserver | null = null;

    if (article && "ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => {
        scheduleSectionMeasurement();
      });
      resizeObserver.observe(article);
    }

    const timeoutIds = [
      window.setTimeout(scheduleSectionMeasurement, 400),
      window.setTimeout(scheduleSectionMeasurement, 1200),
    ];

    return () => {
      if (recalcRafRef.current !== null) {
        cancelAnimationFrame(recalcRafRef.current);
        recalcRafRef.current = null;
      }
      window.removeEventListener("resize", scheduleSectionMeasurement);
      timeoutIds.forEach((id) => window.clearTimeout(id));
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [markdown, clearMarks, scheduleSectionMeasurement]);

  useEffect(() => {
    if (!markdown) {
      setShowJumpToTop(false);
      return;
    }

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = window.requestAnimationFrame(() => {
        const shouldShowJumpToTop = window.scrollY > 300;
        setShowJumpToTop((prev) => (prev === shouldShowJumpToTop ? prev : shouldShowJumpToTop));
        rafId = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", handleScroll);
    };
  }, [markdown]);

  const handleJumpToSectionTop = useCallback(() => {
    if (!hasSectionAnchors) {
      return;
    }

    const activeSection = findSectionForOffset(window.scrollY);
    if (!activeSection) {
      return;
    }

    const element = document.getElementById(activeSection.id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.scrollTo({ top: activeSection.top, behavior: "smooth" });
  }, [findSectionForOffset, hasSectionAnchors]);

  const handleCreateMark = useCallback(() => {
    if (!markdown) {
      return;
    }

    const contentRoot = document.querySelector<HTMLElement>(".markdown-content");
    if (!contentRoot) {
      return;
    }

    const viewportX = window.innerWidth / 2;
    const viewportY = Math.min(window.innerHeight * 0.35, window.innerHeight - 1);
    let element = document.elementFromPoint(viewportX, viewportY) as HTMLElement | null;

    if (!element) {
      element = contentRoot.firstElementChild as HTMLElement | null;
    }

    if (!element) {
      return;
    }

    if (!contentRoot.contains(element)) {
      element = element.closest(".markdown-content *") as HTMLElement | null;
    }

    if (!element) {
      return;
    }

    while (element.parentElement && element.parentElement !== contentRoot) {
      element = element.parentElement as HTMLElement;
    }

    if (!element) {
      return;
    }

    const anchorId = `mark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const existingAnchorId = element.getAttribute("data-mark-highlight");
    if (existingAnchorId && markRegistryRef.current[existingAnchorId]) {
      toast({
        title: "Mark already exists",
        description: "This location is already bookmarked.",
      });
      return;
    }

    const anchor = document.createElement("span");
    anchor.id = anchorId;
    anchor.dataset.dynamicMarkAnchor = "true";
    anchor.style.position = "relative";
    anchor.style.display = "block";
    anchor.style.height = "0";
    anchor.style.width = "0";

    contentRoot.insertBefore(anchor, element);

    element.classList.add("marked-scroll-target");
    element.setAttribute("data-mark-highlight", anchorId);

    const snippetSource = element.textContent?.trim() ?? "";
    const snippet = snippetSource.length > 140 ? `${snippetSource.slice(0, 137)}…` : snippetSource;

    const anchorPosition = anchor.getBoundingClientRect().top + window.scrollY;
    const section = findSectionForOffset(anchorPosition);

    markRegistryRef.current[anchorId] = { anchor, target: element };

    setMarks((prev) => [
      ...prev,
      {
        anchorId,
        snippet,
        sectionTitle: section?.title ?? null,
        createdAt: Date.now(),
      },
    ]);

    toast({
      title: "Marked location",
      description: section?.title ? `Saved in section: ${section.title}` : "Bookmark added.",
    });

    scheduleSectionMeasurement();
  }, [findSectionForOffset, markdown, scheduleSectionMeasurement, toast]);

  const handleJumpToMark = useCallback((anchorId: string) => {
    const element = document.getElementById(anchorId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleRemoveMark = useCallback(
    (anchorId: string) => {
      removeMarkFromDom(anchorId);
      setMarks((prev) => prev.filter((mark) => mark.anchorId !== anchorId));
      scheduleSectionMeasurement();
    },
    [removeMarkFromDom, scheduleSectionMeasurement]
  );

  const handleClearAllMarks = useCallback(() => {
    if (marks.length === 0) {
      return;
    }
    clearMarks();
  }, [clearMarks, marks.length]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const floatingButtonClass =
    "h-12 w-12 rounded-full shadow-lg bg-background/90 backdrop-blur-sm border-2 hover:bg-background";

  const shouldShowSectionTopButton = hasSectionAnchors;
  const shouldShowMarkButton = Boolean(markdown);
  const marksSorted = useMemo(() => {
    if (marks.length <= 1) {
      return marks;
    }
    return [...marks].sort((a, b) => b.createdAt - a.createdAt);
  }, [marks]);
  const shouldShowFloatingControls =
    Boolean(markdown) && (shouldShowSectionTopButton || marksSorted.length > 0 || showJumpToTop || shouldShowMarkButton);

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
      setSelectedTask(task);
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
    setSelectedTask(null);
    setTaskError(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Github className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold font-sans text-foreground">
                Markdown Viewer
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {hasUserId && (
                <>
                  <span className="text-xs text-muted-foreground font-sans">
                    User ID:{" "}
                    {userId || localStorage.getItem(USER_ID_STORAGE_KEY)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearUserId}
                    className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
                  >
                    Change User
                  </Button>
                </>
              )}
              <MarkdownColorSettings />
            </div>
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
                      selectedTask={selectedTask || undefined}
                    />
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
      {shouldShowFloatingControls && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {marksSorted.length > 0 && (
            <Card className="w-72 shadow-xl border-border/60 bg-background/95 backdrop-blur">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold font-sans">Marks</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={handleClearAllMarks}
                        aria-label="Clear all marks"
                        disabled={marksSorted.length === 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Clear all marks</TooltipContent>
                  </Tooltip>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {marksSorted.map((mark) => (
                    <div
                      key={mark.anchorId}
                      className="rounded-md border border-border/60 bg-muted/50 p-2 space-y-2"
                    >
                      {mark.sectionTitle && (
                        <p className="text-xs font-semibold font-sans text-primary/80 truncate">
                          {mark.sectionTitle}
                        </p>
                      )}
                      <p className="text-xs font-sans text-muted-foreground line-clamp-2">
                        {mark.snippet || "Marked location"}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 px-2 font-sans text-xs"
                          onClick={() => handleJumpToMark(mark.anchorId)}
                        >
                          <MapPin className="mr-1 h-4 w-4" />
                          Jump
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveMark(mark.anchorId)}
                              aria-label="Remove mark"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Remove mark</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            {shouldShowSectionTopButton && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={floatingButtonClass}
                    onClick={handleJumpToSectionTop}
                    aria-label="Jump to top of section"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Jump to top of current section</TooltipContent>
              </Tooltip>
            )}

            {shouldShowMarkButton && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={floatingButtonClass}
                    onClick={handleCreateMark}
                    aria-label="Create mark at current position"
                  >
                    <BookmarkPlus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Save a mark at the current position</TooltipContent>
              </Tooltip>
            )}

            {showJumpToTop && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={floatingButtonClass}
                    onClick={scrollToTop}
                    aria-label="Jump to top"
                  >
                    <ArrowUpToLine className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Jump to top of document</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
