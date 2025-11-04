import type { VercelRequest, VercelResponse } from "@vercel/node";

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "app8layDpsoR8AYD9";
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "Trajectories";
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { recordId } = req.query;

  if (!recordId || typeof recordId !== "string") {
    return res.status(400).json({ error: "recordId is required" });
  }

  const { fields } = req.body;

  if (!fields || typeof fields !== "object") {
    return res.status(400).json({ error: "fields object is required" });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Airtable API key not configured" });
  }

  try {
    const response = await fetch(`${AIRTABLE_API_URL}/${recordId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Airtable API error: ${response.status} ${response.statusText}`,
        details: errorText,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

