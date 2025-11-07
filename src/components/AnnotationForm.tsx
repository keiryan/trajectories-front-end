import { useState, useCallback, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateAnnotationNote } from "@/lib/airtable";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AnnotationFormCompletionStatus {
  answeredQuestions: number;
  totalQuestions: number;
  isComplete: boolean;
}

interface Task {
  id: string;
  fields: {
    "Task Number"?: string;
    [key: string]: any;
  };
}

interface AnnotationFormProps {
  url?: string;
  sectionIndex: number;
  prefilledData?: Record<string, any>;
  selectedTask?: Task;
  onCompletionChange?: (status: AnnotationFormCompletionStatus) => void;
  statusVariant?: "complete" | "incomplete";
}

// Extract task number from URL
// Example: https://github.com/user/repo/blob/main/123.md -> 123
const extractTaskNumber = (url: string | undefined): string | null => {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const fileName = pathParts[pathParts.length - 1];

    // Extract number from filename (e.g., "123.md" -> "123")
    const match = fileName.match(/^(\d+)\.md$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

type TimestampedValue<T> = {
  value: T;
  timestamp: number;
};

const createTimestampedValue = <T,>(value: T): TimestampedValue<T> => ({
  value,
  timestamp: Math.floor(Date.now() / 1000),
});

const unwrapTimestampedValue = <T,>(
  value: T | TimestampedValue<T> | undefined
): T | undefined => {
  if (typeof value === "object" && value !== null && "value" in value) {
    return (value as TimestampedValue<T>).value;
  }

  return value as T | undefined;
};

type ErrorFlagKey =
  | "hallucination"
  | "repetitionLoop"
  | "misdiagnosis"
  | "toolMisuse"
  | "ignoredFeedback"
  | "prematureConclusion"
  | "scopeCreep"
  | "na"
  | "other";

const createInitialErrorFlags = (): Record<ErrorFlagKey, boolean> => ({
  hallucination: false,
  repetitionLoop: false,
  misdiagnosis: false,
  toolMisuse: false,
  ignoredFeedback: false,
  prematureConclusion: false,
  scopeCreep: false,
  na: false,
  other: false,
});

export const AnnotationForm = ({
  url,
  sectionIndex,
  prefilledData = {},
  selectedTask,
  onCompletionChange,
  statusVariant = "incomplete",
}: AnnotationFormProps) => {
  const [actionCategory, setActionCategory] = useState<string>("");
  const [otherActionCategory, setOtherActionCategory] = useState<string>("");
  const [actionCorrectness, setActionCorrectness] = useState<string>("");
  const [reasoningQuality, setReasoningQuality] = useState<string>("");
  const [sandboxResponse, setSandboxResponse] = useState<string>("");

  const [errorFlags, setErrorFlags] = useState<Record<ErrorFlagKey, boolean>>(
    createInitialErrorFlags
  );
  const [otherErrorExplanation, setOtherErrorExplanation] =
    useState<string>("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPrefilled, setIsPrefilled] = useState(false);
  const onCompletionChangeRef = useRef<typeof onCompletionChange>();

  // Use ref to track previous prefilledData to avoid unnecessary resets
  const prevPrefilledDataRef = useRef<string>("");
  const prevSectionIndexRef = useRef<number>(-1);
  const prevUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    onCompletionChangeRef.current = onCompletionChange;
  }, [onCompletionChange]);

  // Get task number from selectedTask first, then fall back to URL extraction
  const taskNumber =
    selectedTask?.fields["Task Number"] || extractTaskNumber(url);

  // Reset form and prefilled state when section, URL, or prefilledData actually changes
  useEffect(() => {
    // Create a stable string representation of prefilledData for comparison
    const prefilledDataStr = JSON.stringify(prefilledData);

    // Only reset if sectionIndex, url, or prefilledData actually changed
    const sectionChanged = prevSectionIndexRef.current !== sectionIndex;
    const urlChanged = prevUrlRef.current !== url;
    const dataChanged = prevPrefilledDataRef.current !== prefilledDataStr;

    if (sectionChanged || urlChanged || dataChanged) {
      setIsPrefilled(false);

      // Reset form fields
      setActionCategory("");
      setOtherActionCategory("");
      setActionCorrectness("");
      setReasoningQuality("");
      setSandboxResponse("");
      setErrorFlags(createInitialErrorFlags());
      setOtherErrorExplanation("");

      // Update refs
      prevSectionIndexRef.current = sectionIndex;
      prevUrlRef.current = url;
      prevPrefilledDataRef.current = prefilledDataStr;
    }
  }, [sectionIndex, url, prefilledData]);

  // Apply prefilled data after reset
  useEffect(() => {
    if (!isPrefilled && Object.keys(prefilledData).length > 0) {
      // Handle actionCategory
      const prefilledActionCategory = unwrapTimestampedValue<string>(
        prefilledData.actionCategory
      );
      if (typeof prefilledActionCategory === "string") {
        const standardCategories = [
          "file-exploration",
          "code-analysis",
          "code-modification",
          "test-execution",
          "environment-setup",
        ];
        if (standardCategories.includes(prefilledActionCategory)) {
          setActionCategory(prefilledActionCategory);
        } else {
          // It's a custom "other" value
          setActionCategory("other");
          setOtherActionCategory(prefilledActionCategory);
        }
      }

      // Handle other dropdown fields
      const prefilledActionCorrectness = unwrapTimestampedValue<string>(
        prefilledData.actionCorrectness
      );
      if (typeof prefilledActionCorrectness === "string") {
        setActionCorrectness(prefilledActionCorrectness);
      }

      const prefilledReasoningQuality = unwrapTimestampedValue<string>(
        prefilledData.reasoningQuality
      );
      if (typeof prefilledReasoningQuality === "string") {
        setReasoningQuality(prefilledReasoningQuality);
      }

      const prefilledSandboxResponse = unwrapTimestampedValue<string>(
        prefilledData.sandboxResponse
      );
      if (typeof prefilledSandboxResponse === "string") {
        setSandboxResponse(prefilledSandboxResponse);
      }

      // Handle errorFlags array
      const prefilledErrorFlags = unwrapTimestampedValue<string[]>(
        prefilledData.errorFlags
      );
      if (Array.isArray(prefilledErrorFlags)) {
        const flags = createInitialErrorFlags();
        const normalizedMap: Record<string, ErrorFlagKey> = {
          hallucination: "hallucination",
          repetitionloop: "repetitionLoop",
          misdiagnosis: "misdiagnosis",
          toolmisuse: "toolMisuse",
          ignoredfeedback: "ignoredFeedback",
          prematureconclusion: "prematureConclusion",
          scopecreep: "scopeCreep",
          na: "na",
          other: "other",
        };

        prefilledErrorFlags.forEach((flag: string) => {
          const normalizedFlag = flag
            .toString()
            .trim()
            .toLowerCase();

          const lookupKey = normalizedFlag.replace(/[^a-z]/g, "");

          if (normalizedMap[lookupKey]) {
            const key = normalizedMap[lookupKey];
            flags[key] = true;
          }
        });

        setErrorFlags(flags);
      }

      const prefilledOtherErrorExplanation = unwrapTimestampedValue<string>(
        prefilledData.errorFlagOtherExplanation
      );
      if (typeof prefilledOtherErrorExplanation === "string") {
        setOtherErrorExplanation(prefilledOtherErrorExplanation);
      }

      setIsPrefilled(true);
    }
  }, [prefilledData, isPrefilled]);

  // Save to Airtable when a field changes
  const saveToAirtable = useCallback(
    async (fieldName: string, value: string | boolean | string[]) => {
      if (!taskNumber) {
        setError("Unable to determine task number");
        toast({
          title: "Error",
          description:
            "Unable to determine task number. Please ensure a task is selected.",
          variant: "destructive",
        });
        return;
      }

      setSaving(fieldName);
      setError(null);

      try {
        const jsonKey = `${taskNumber}_${sectionIndex}_${fieldName}`;
        const timestampedValue = createTimestampedValue(value);
        await updateAnnotationNote(taskNumber, jsonKey, timestampedValue);

        toast({
          title: "Saved",
          description: "Annotation saved to Airtable successfully",
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to save to Airtable";
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setSaving(null);
      }
    },
    [taskNumber, sectionIndex]
  );

  const handleActionCategoryChange = (value: string) => {
    setActionCategory(value);
    const displayValue =
      value === "other" && otherActionCategory ? otherActionCategory : value;
    saveToAirtable("actionCategory", displayValue);
  };

  const handleActionCorrectnessChange = (value: string) => {
    setActionCorrectness(value);
    saveToAirtable("actionCorrectness", value);
  };

  const handleReasoningQualityChange = (value: string) => {
    setReasoningQuality(value);
    saveToAirtable("reasoningQuality", value);
  };

  const handleSandboxResponseChange = (value: string) => {
    setSandboxResponse(value);
    saveToAirtable("sandboxResponse", value);
  };

  const toggleErrorFlag = async (flag: ErrorFlagKey) => {
    let updatedFlags: Record<ErrorFlagKey, boolean> = {
      ...errorFlags,
      [flag]: !errorFlags[flag],
    };

    let shouldClearOtherExplanation = false;

    if (flag === "na" && updatedFlags.na) {
      updatedFlags = createInitialErrorFlags();
      updatedFlags.na = true;
      shouldClearOtherExplanation = errorFlags.other;
    } else if (flag !== "na" && updatedFlags[flag]) {
      updatedFlags.na = false;
    }

    if (flag === "other" && !updatedFlags.other) {
      shouldClearOtherExplanation = true;
    }

    if (shouldClearOtherExplanation) {
      setOtherErrorExplanation("");
    }

    setErrorFlags(updatedFlags);

    const selectedFlags = Object.entries(updatedFlags)
      .filter(([, isSelected]) => isSelected)
      .map(([flagName]) => flagName);

    if (shouldClearOtherExplanation) {
      await saveToAirtable("errorFlagOtherExplanation", "");
    }

    await saveToAirtable("errorFlags", selectedFlags);
  };

  const handleOtherErrorExplanationChange = (value: string): void => {
    setOtherErrorExplanation(value);
  };

  const handleOtherErrorExplanationBlur = async (value: string): Promise<void> => {
    await saveToAirtable("errorFlagOtherExplanation", value);
  };

  const totalQuestions = 5;

  useEffect(() => {
    const hasActionCategory =
      actionCategory !== "" &&
      (actionCategory !== "other" || otherActionCategory.trim().length > 0);
    const hasActionCorrectness = actionCorrectness !== "";
    const hasReasoningQuality = reasoningQuality !== "";
    const hasSandboxResponse = sandboxResponse !== "";
    const hasAnyErrorFlag = Object.values(errorFlags).some(Boolean);
    const hasValidOtherExplanation =
      !errorFlags.other || otherErrorExplanation.trim().length > 0;

    const answeredQuestions = [
      hasActionCategory,
      hasActionCorrectness,
      hasReasoningQuality,
      hasSandboxResponse,
      hasAnyErrorFlag && hasValidOtherExplanation,
    ].filter(Boolean).length;

    const isComplete = answeredQuestions === totalQuestions;

    const callback = onCompletionChangeRef.current;
    if (callback) {
      callback({
        answeredQuestions,
        totalQuestions,
        isComplete,
      });
    }
  }, [
    actionCategory,
    otherActionCategory,
    actionCorrectness,
    reasoningQuality,
    sandboxResponse,
    errorFlags,
    otherErrorExplanation,
  ]);

  return (
    <Card
      className={cn(
        "my-8 p-6 border-2 transition-colors duration-300",
        statusVariant === "complete"
          ? "border-emerald-400/60 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/40"
          : "border-primary/20 bg-card"
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h4 className="text-lg font-semibold font-sans">
          Step-by-Step Annotation
        </h4>
        <Badge
          variant={statusVariant === "complete" ? "default" : "secondary"}
          className="whitespace-nowrap"
        >
          {statusVariant === "complete" ? "Complete" : "In Progress"}
        </Badge>
      </div>
      {!taskNumber && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/50 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-sm text-destructive font-sans">
              <strong>Warning:</strong> Unable to determine task number. Changes
              will not be saved to Airtable.
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/50 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-sm text-destructive font-sans">{error}</div>
          </div>
        </div>
      )}
      <div className="space-y-6">
        {/* Agent Action Category */}
        <div className="space-y-2">
          <Label htmlFor="action-category" className="font-sans">
            Agent Action Category
          </Label>
          <Select
            value={actionCategory}
            onValueChange={handleActionCategoryChange}
            disabled={!taskNumber || saving === "actionCategory"}
          >
            <SelectTrigger id="action-category" className="font-sans">
              <SelectValue placeholder="Select action category" />
              {saving === "actionCategory" && (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="file-exploration">
                File Exploration (reading, searching, listing)
              </SelectItem>
              <SelectItem value="code-analysis">
                Code Analysis (examining existing code)
              </SelectItem>
              <SelectItem value="code-modification">
                Code Modification (writing, editing, deleting)
              </SelectItem>
              <SelectItem value="test-execution">
                Test Execution (running tests, debugging)
              </SelectItem>
              <SelectItem value="environment-setup">
                Environment Setup (installing packages, configuring)
              </SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {actionCategory === "other" && (
            <Input
              placeholder="Specify other action category"
              value={otherActionCategory}
              onChange={(e) => setOtherActionCategory(e.target.value)}
              className="mt-2 font-sans"
            />
          )}
        </div>

        {/* Action Correctness */}
        <div className="space-y-2">
          <Label htmlFor="action-correctness" className="font-sans">
            Action Correctness
          </Label>
          <Select
            value={actionCorrectness}
            onValueChange={handleActionCorrectnessChange}
            disabled={!taskNumber || saving === "actionCorrectness"}
          >
            <SelectTrigger id="action-correctness" className="font-sans">
              <SelectValue placeholder="Select correctness level" />
              {saving === "actionCorrectness" && (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="correct">
                Correct: Appropriate action for the current state
              </SelectItem>
              <SelectItem value="suboptimal">
                Suboptimal but Valid: Correct direction but inefficient
              </SelectItem>
              <SelectItem value="incorrect">
                Incorrect: Wrong action that doesn't help or hinders progress
              </SelectItem>
              <SelectItem value="redundant">
                Redundant: Repeating a previous action unnecessarily
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reasoning Quality */}
        <div className="space-y-2">
          <Label htmlFor="reasoning-quality" className="font-sans">
            Reasoning Quality (for Agent's thinking/explanation)
          </Label>
          <Select
            value={reasoningQuality}
            onValueChange={handleReasoningQualityChange}
            disabled={!taskNumber || saving === "reasoningQuality"}
          >
            <SelectTrigger id="reasoning-quality" className="font-sans">
              <SelectValue placeholder="Select reasoning quality" />
              {saving === "reasoningQuality" && (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clear">
                Clear & Logical: Well-reasoned, shows understanding
              </SelectItem>
              <SelectItem value="partial">
                Partially Clear: Some logic but incomplete reasoning
              </SelectItem>
              <SelectItem value="unclear">
                Unclear: Vague or hard to follow
              </SelectItem>
              <SelectItem value="incorrect-reasoning">
                Incorrect: Faulty reasoning or misunderstanding
              </SelectItem>
              <SelectItem value="missing">
                Missing: No reasoning provided
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sandbox Response Interpretation */}
        <div className="space-y-2">
          <Label htmlFor="sandbox-response" className="font-sans">
            Sandbox Response Interpretation
          </Label>
          <div className="text-sm text-muted-foreground mb-2 font-sans">
            Did the agent correctly interpret the sandbox response in their next
            action?
          </div>
          <Select
            value={sandboxResponse}
            onValueChange={handleSandboxResponseChange}
            disabled={!taskNumber || saving === "sandboxResponse"}
          >
            <SelectTrigger id="sandbox-response" className="font-sans">
              <SelectValue placeholder="Select interpretation" />
              {saving === "sandboxResponse" && (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">
                Yes: Agent understood and responded appropriately
              </SelectItem>
              <SelectItem value="partial">
                Partial: Agent understood some but missed key information
              </SelectItem>
              <SelectItem value="no">
                No: Agent misunderstood or ignored important information
              </SelectItem>
              <SelectItem value="na">
                N/A: Next action not yet available
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error Flags */}
        <div className="space-y-3">
          <Label className="font-sans">
            Error Flags (check all that apply)
          </Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hallucination"
                checked={errorFlags.hallucination}
                onCheckedChange={() => toggleErrorFlag("hallucination")}
                disabled={!taskNumber || saving === "errorFlags"}
              />
              <Label
                htmlFor="hallucination"
                className="font-sans font-normal cursor-pointer"
              >
                Hallucination: Agent refers to non-existent files/functions/code
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="repetition-loop"
                checked={errorFlags.repetitionLoop}
                onCheckedChange={() => toggleErrorFlag("repetitionLoop")}
                disabled={!taskNumber || saving === "errorFlags"}
              />
              <Label
                htmlFor="repetition-loop"
                className="font-sans font-normal cursor-pointer"
              >
                Repetition Loop: Agent repeats same failed action multiple times
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="misdiagnosis"
                checked={errorFlags.misdiagnosis}
                onCheckedChange={() => toggleErrorFlag("misdiagnosis")}
                disabled={!taskNumber || saving === "errorFlags"}
              />
              <Label
                htmlFor="misdiagnosis"
                className="font-sans font-normal cursor-pointer"
              >
                Misdiagnosis: Agent incorrectly identifies the root cause
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tool-misuse"
                checked={errorFlags.toolMisuse}
                onCheckedChange={() => toggleErrorFlag("toolMisuse")}
                disabled={!taskNumber || saving === "errorFlags"}
              />
              <Label
                htmlFor="tool-misuse"
                className="font-sans font-normal cursor-pointer"
              >
                Tool Misuse: Incorrect use of available commands/tools
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ignored-feedback"
                checked={errorFlags.ignoredFeedback}
                onCheckedChange={() => toggleErrorFlag("ignoredFeedback")}
                disabled={!taskNumber || saving === "errorFlags"}
              />
              <Label
                htmlFor="ignored-feedback"
                className="font-sans font-normal cursor-pointer"
              >
                Ignored Feedback: Agent ignores clear error messages or test
                failures
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="premature-conclusion"
                checked={errorFlags.prematureConclusion}
                onCheckedChange={() => toggleErrorFlag("prematureConclusion")}
                disabled={!taskNumber || saving === "errorFlags"}
              />
              <Label
                htmlFor="premature-conclusion"
                className="font-sans font-normal cursor-pointer"
              >
                Premature Conclusion: Agent stops before fully solving the issue
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="scope-creep"
                checked={errorFlags.scopeCreep}
                onCheckedChange={() => toggleErrorFlag("scopeCreep")}
                disabled={!taskNumber || saving === "errorFlags"}
              />
              <Label
                htmlFor="scope-creep"
                className="font-sans font-normal cursor-pointer"
              >
                Scope Creep: Agent makes unrelated or unnecessary changes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="na"
                checked={errorFlags.na}
                onCheckedChange={() => toggleErrorFlag("na")}
                disabled={!taskNumber || saving === "errorFlags"}
              />
              <Label
                htmlFor="na"
                className="font-sans font-normal cursor-pointer"
              >
                N/A: No applicable errors for this step
              </Label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="other-error"
                  checked={errorFlags.other}
                  onCheckedChange={() => toggleErrorFlag("other")}
                  disabled={!taskNumber || saving === "errorFlags"}
                />
                <Label
                  htmlFor="other-error"
                  className="font-sans font-normal cursor-pointer"
                >
                  Other
                </Label>
              </div>
              {errorFlags.other && (
                <div className="space-y-2 pl-6">
                  <Label
                    htmlFor="other-error-explanation"
                    className="font-sans text-sm"
                  >
                    Please describe the issue
                  </Label>
                  <Textarea
                    id="other-error-explanation"
                    placeholder="Provide additional details"
                    value={otherErrorExplanation}
                    onChange={(event) =>
                      handleOtherErrorExplanationChange(event.target.value)
                    }
                    onBlur={(event) => {
                      void handleOtherErrorExplanationBlur(event.target.value);
                    }}
                    className="font-sans"
                    required
                    disabled={!taskNumber || saving === "errorFlagOtherExplanation"}
                  />
                  {!otherErrorExplanation.trim() && (
                    <p className="text-sm text-destructive font-sans">
                      Explanation is required when selecting "Other".
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
