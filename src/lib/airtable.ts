const AIRTABLE_BASE_ID = "app8layDpsoR8AYD9";
const AIRTABLE_TABLE_NAME = "Trajectories";
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

// Get API key from environment variable
// In production, this should be set as an environment variable
const getApiKey = () => {
  // For now, using import.meta.env which is Vite's way of handling env vars
  // User needs to set VITE_AIRTABLE_API_KEY in their .env file
  return import.meta.env.VITE_AIRTABLE_API_KEY || "";
};

export interface AirtableUpdateFields {
  [key: string]: string | boolean | string[];
}

/**
 * Find a record in Airtable by Task Number
 */
export const findRecordByTaskNumber = async (
  taskNumber: string
): Promise<string | null> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "Airtable API key not configured. Please set VITE_AIRTABLE_API_KEY in your .env file"
    );
  }

  try {
    // Search for record where Task Number matches
    const response = await fetch(
      `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(
        `{Task Number} = "${taskNumber}"`
      )}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Airtable API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.records && data.records.length > 0) {
      return data.records[0].id;
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
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "Airtable API key not configured. Please set VITE_AIRTABLE_API_KEY in your .env file"
    );
  }

  try {
    const response = await fetch(`${AIRTABLE_API_URL}/${recordId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Airtable API error: ${response.status} ${
          response.statusText
        }. ${JSON.stringify(errorData)}`
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
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "Airtable API key not configured. Please set VITE_AIRTABLE_API_KEY in your .env file"
    );
  }

  try {
    const response = await fetch(
      `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(
        `{Task Number} = "${taskNumber}"`
      )}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Airtable API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.records && data.records.length > 0) {
      return {
        id: data.records[0].id,
        fields: data.records[0].fields || {},
      };
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
