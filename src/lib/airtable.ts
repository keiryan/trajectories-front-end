// API base path - uses Vercel API routes
const API_BASE = "/api";

export interface AirtableUpdateFields {
  [key: string]: string | boolean | string[];
}

/**
 * Find a record in Airtable by Task Number
 */
export const findRecordByTaskNumber = async (
  taskNumber: string
): Promise<string | null> => {
  try {
    const response = await fetch(
      `${API_BASE}/record-by-task-number?taskNumber=${encodeURIComponent(
        taskNumber
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          `API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data && data.id) {
      return data.id;
    }

    return null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to search Airtable");
  }
};

/**
 * Update a record in Airtable
 */
export const updateRecord = async (
  recordId: string,
  fields: AirtableUpdateFields
): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/record/${recordId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          `API error: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to update Airtable record");
  }
};

/**
 * Find and update a record by task number
 */
export const findAndUpdateRecord = async (
  taskNumber: string,
  fields: AirtableUpdateFields
): Promise<void> => {
  const recordId = await findRecordByTaskNumber(taskNumber);

  if (!recordId) {
    throw new Error(
      `No record found in Airtable with Task Number: ${taskNumber}`
    );
  }

  await updateRecord(recordId, fields);
};

/**
 * Get a record with its current fields by task number
 */
export const getRecordByTaskNumber = async (
  taskNumber: string
): Promise<{ id: string; fields: Record<string, any> } | null> => {
  try {
    const response = await fetch(
      `${API_BASE}/record-by-task-number?taskNumber=${encodeURIComponent(
        taskNumber
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          `API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to search Airtable");
  }
};

/**
 * Get all records by Unique ID
 */
export const getRecordsByUniqueId = async (
  uniqueId: string
): Promise<Array<{ id: string; fields: Record<string, any> }>> => {
  try {
    const response = await fetch(
      `${API_BASE}/records-by-unique-id?uniqueId=${encodeURIComponent(
        uniqueId
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          `API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to search Airtable");
  }
};

/**
 * Update a single annotation field in the Annotation Notes JSON
 */
export const updateAnnotationNote = async (
  taskNumber: string,
  key: string,
  value: string | boolean | string[]
): Promise<void> => {
  const record = await getRecordByTaskNumber(taskNumber);

  if (!record) {
    throw new Error(
      `No record found in Airtable with Task Number: ${taskNumber}`
    );
  }

  // Get current Annotation Notes or initialize as empty object
  const annotationNotesField = "Annotation Notes";
  let annotationNotes: Record<string, any> = {};

  try {
    const currentNotes = record.fields[annotationNotesField];
    if (currentNotes && typeof currentNotes === "string") {
      annotationNotes = JSON.parse(currentNotes);
    } else if (currentNotes && typeof currentNotes === "object") {
      annotationNotes = currentNotes;
    }
  } catch (error) {
    // If parsing fails, start with empty object
    console.warn("Failed to parse existing Annotation Notes, starting fresh");
  }

  // Update the specific key (this automatically handles duplicates - overwrites)
  annotationNotes[key] = value;

  // Save back to Airtable
  await updateRecord(record.id, {
    [annotationNotesField]: JSON.stringify(annotationNotes),
  });
};
