/**
 * AWS Lambda function to proxy Airtable API requests
 * This keeps the API key secure on the backend
 */

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "app8layDpsoR8AYD9";
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "Trajectories";
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

// Enable CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (
    event.requestContext?.http?.method === "OPTIONS" ||
    event.httpMethod === "OPTIONS"
  ) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: "OK" }),
    };
  }

  try {
    const apiKey = process.env.AIRTABLE_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Airtable API key not configured",
        }),
      };
    }

    // Parse request body if present
    let body = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (e) {
        // Body might not be JSON, that's okay
      }
    }

    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};

    // Determine the action based on the path or query
    const path = event.requestContext?.http?.path || event.path || "";
    const method =
      event.requestContext?.http?.method || event.httpMethod || "GET";

    let response;

    // Route: GET /records-by-unique-id?uniqueId=...
    if (path.includes("records-by-unique-id") || queryParams.uniqueId) {
      const uniqueId = queryParams.uniqueId || pathParams.uniqueId;
      if (!uniqueId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "uniqueId parameter is required" }),
        };
      }

      const filterFormula = encodeURIComponent(`{Unique ID} = "${uniqueId}"`);
      const airtableUrl = `${AIRTABLE_API_URL}?filterByFormula=${filterFormula}`;

      response = await fetch(airtableUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          statusCode: response.status,
          headers: corsHeaders,
          body: JSON.stringify({
            error: `Airtable API error: ${response.status} ${response.statusText}`,
            details: errorText,
          }),
        };
      }

      const data = await response.json();
      const records = (data.records || []).map((record) => ({
        id: record.id,
        fields: record.fields || {},
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(records),
      };
    }

    // Route: GET /record-by-task-number?taskNumber=...
    if (path.includes("record-by-task-number") || queryParams.taskNumber) {
      const taskNumber = queryParams.taskNumber || pathParams.taskNumber;
      if (!taskNumber) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "taskNumber parameter is required" }),
        };
      }

      const filterFormula = encodeURIComponent(
        `{Task Number} = "${taskNumber}"`
      );
      const airtableUrl = `${AIRTABLE_API_URL}?filterByFormula=${filterFormula}`;

      response = await fetch(airtableUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          statusCode: response.status,
          headers: corsHeaders,
          body: JSON.stringify({
            error: `Airtable API error: ${response.status} ${response.statusText}`,
            details: errorText,
          }),
        };
      }

      const data = await response.json();
      if (data.records && data.records.length > 0) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            id: data.records[0].id,
            fields: data.records[0].fields || {},
          }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(null),
      };
    }

    // Route: PATCH - Update record (via body with recordId and fields)
    if (method === "PATCH" || body.recordId) {
      const recordId =
        queryParams.recordId || pathParams?.recordId || body.recordId;
      if (!recordId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "recordId is required" }),
        };
      }

      const fields = body.fields;
      if (!fields) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "fields object is required in request body",
          }),
        };
      }

      response = await fetch(`${AIRTABLE_API_URL}/${recordId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: fields,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          statusCode: response.status,
          headers: corsHeaders,
          body: JSON.stringify({
            error: `Airtable API error: ${response.status} ${response.statusText}`,
            details: errorText,
          }),
        };
      }

      const data = await response.json();
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data),
      };
    }

    // Default: return available endpoints
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Airtable Proxy API",
        endpoints: {
          "GET /records-by-unique-id?uniqueId=...": "Get records by Unique ID",
          "GET /record-by-task-number?taskNumber=...":
            "Get record by Task Number",
          "PATCH /record/:recordId": "Update a record",
        },
      }),
    };
  } catch (error) {
    console.error("Lambda error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};
