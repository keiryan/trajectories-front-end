import { useState, useCallback } from "react";
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
import { updateAnnotationNote } from "@/lib/airtable";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";

interface AnnotationFormProps {
  url?: string;
  sectionIndex: number;
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

export const AnnotationForm = ({ url, sectionIndex }: AnnotationFormProps) => {
  const [actionCategory, setActionCategory] = useState<string>("");
  const [otherActionCategory, setOtherActionCategory] = useState<string>("");
  const [actionCorrectness, setActionCorrectness] = useState<string>("");
  const [reasoningQuality, setReasoningQuality] = useState<string>("");
  const [sandboxResponse, setSandboxResponse] = useState<string>("");
  const [errorFlags, setErrorFlags] = useState<Record<string, boolean>>({
    hallucination: false,
    repetitionLoop: false,
    misdiagnosis: false,
    toolMisuse: false,
    ignoredFeedback: false,
    prematureConclusion: false,
    scopeCreep: false,
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const taskNumber = extractTaskNumber(url);

  // Generate JSON key in format: {taskNumber}_{sectionIndex}_{fieldName}
  const getJsonKey = (fieldName: string) => {
    return `${taskNumber}_${sectionIndex}_${fieldName}`;
  };

  // Save to Airtable when a field changes
  const saveToAirtable = useCallback(
    async (fieldName: string, value: string | boolean | string[]) => {
      if (!taskNumber) {
        setError("Unable to extract task number from URL");
        toast({
          title: "Error",
          description:
            "Unable to extract task number from URL. Please check the URL format.",
          variant: "destructive",
        });
        return;
      }

      setSaving(fieldName);
      setError(null);

      try {
        const jsonKey = getJsonKey(fieldName);
        await updateAnnotationNote(taskNumber, jsonKey, value);

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

  const toggleErrorFlag = async (flag: string) => {
    const newValue = !errorFlags[flag];
    setErrorFlags((prev) => ({
      ...prev,
      [flag]: newValue,
    }));

    // Get all selected error flags as an array
    const selectedFlags = Object.entries({
      ...errorFlags,
      [flag]: newValue,
    })
      .filter(([, isSelected]) => isSelected)
      .map(([flagName]) => flagName);

    // Save as an array
    await saveToAirtable("errorFlags", selectedFlags);
  };

  return (
    <Card className="my-8 p-6 border-2 border-primary/20 bg-card">
      <h4 className="text-lg font-semibold mb-4 font-sans">
        Step-by-Step Annotation
      </h4>
      {!taskNumber && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/50 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-sm text-destructive font-sans">
              <strong>Warning:</strong> Unable to extract task number from URL.
              Changes will not be saved to Airtable.
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
          </div>
        </div>
      </div>
    </Card>
  );
};
