# Setup Instructions

## Environment Variables

When deploying to Vercel, configure environment variables in the Vercel dashboard:

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add the following variables:

```env
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=app8layDpsoR8AYD9  # Optional, has default
AIRTABLE_TABLE_NAME=Trajectories      # Optional, has default
```

**Important:** These environment variables are set in Vercel, NOT in a local `.env` file for the API routes. The API routes automatically read from Vercel's environment variables.

## Local Development

For local development, you can create a `.env.local` file in the root directory, but the API routes will work fine without it since they use Vercel's environment variables when deployed.

```env
# Optional for local development only
# API routes use Vercel env vars in production
```

## Security Note

✅ **Your Airtable API key is secure!** 

- The API key is stored in Vercel's environment variables (never exposed to frontend)
- API routes are serverless functions that run on Vercel's edge
- The frontend only calls `/api/*` endpoints (no API keys in frontend code)

## Deployment

1. Push your code to GitHub
2. Import the project in Vercel (or connect your existing repo)
3. Add environment variables in Vercel dashboard (see above)
4. Deploy!

Vercel will automatically:
- Deploy your frontend
- Deploy your API routes (`/api/*`)
- Everything works together seamlessly

## API Endpoints

- `GET /api/records-by-unique-id?uniqueId=...` - Get all records by Unique ID
- `GET /api/record-by-task-number?taskNumber=...` - Get record by Task Number
- `PATCH /api/record/[recordId]` - Update a record

All endpoints handle CORS automatically.
