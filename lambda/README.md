# Airtable Proxy Lambda Function

This Lambda function securely proxies Airtable API requests, keeping your API key on the backend.

## Deployment Instructions

### Option 1: Using AWS Console (Simplest)

1. **Create the Lambda Function:**

   - Go to AWS Lambda Console
   - Click "Create function"
   - Choose "Author from scratch"
   - Name: `airtable-proxy`
   - Runtime: Node.js 20.x (or latest)
   - Architecture: x86_64
   - Click "Create function"

2. **Upload the code:**

   - Copy the contents of `airtable-proxy.js` into the Lambda code editor
   - Click "Deploy"

3. **Configure Environment Variables:**

   - Go to Configuration → Environment variables
   - Add:
     - `AIRTABLE_API_KEY` = your Airtable API key
     - `AIRTABLE_BASE_ID` = `app8layDpsoR8AYD9` (or your base ID)
     - `AIRTABLE_TABLE_NAME` = `Trajectories` (or your table name)

4. **Set up Function URL:**

   - Go to Configuration → Function URL
   - Click "Create function URL"
   - Auth type: `NONE` (you can add API key auth later if needed)
   - CORS: Enable (if needed)
   - Click "Save"
   - Copy the Function URL - you'll need this for your frontend

5. **Update Function Permissions:**
   - The default execution role should be fine for basic HTTP requests
   - Lambda already has network access by default

### Option 2: Using AWS CLI

```bash
# Create deployment package
cd lambda
zip function.zip airtable-proxy.js

# Create the function (replace with your role ARN)
aws lambda create-function \
  --function-name airtable-proxy \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler airtable-proxy.handler \
  --zip-file fileb://function.zip

# Add environment variables
aws lambda update-function-configuration \
  --function-name airtable-proxy \
  --environment Variables="{AIRTABLE_API_KEY=your_key_here,AIRTABLE_BASE_ID=app8layDpsoR8AYD9,AIRTABLE_TABLE_NAME=Trajectories}"

# Create function URL
aws lambda create-function-url-config \
  --function-name airtable-proxy \
  --auth-type NONE \
  --cors '{"AllowCredentials":false,"AllowHeaders":["*"],"AllowMethods":["*"],"AllowOrigins":["*"],"ExposeHeaders":[],"MaxAge":3600}'
```

### Option 3: Using AWS SAM

If you prefer Infrastructure as Code, create a `template.yaml`:

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31

Resources:
  AirtableProxyFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: airtable-proxy.handler
      Runtime: nodejs20.x
      CodeUri: .
      Environment:
        Variables:
          AIRTABLE_API_KEY: !Ref AirtableApiKey
          AIRTABLE_BASE_ID: app8layDpsoR8AYD9
          AIRTABLE_TABLE_NAME: Trajectories
      Events:
        Api:
          Type: HttpApi
          Properties:
            Path: /{proxy+}
            Method: ANY

Parameters:
  AirtableApiKey:
    Type: String
    NoEcho: true
    Description: Airtable API Key
```

Then deploy with:

```bash
sam build
sam deploy --guided
```

## Testing

Once deployed, test the endpoint:

```bash
curl "https://YOUR_FUNCTION_URL.lambda-url.us-east-1.on.aws/?uniqueId=test123"
```

## Security Recommendations

1. **Add API Key Authentication:**

   - Use AWS API Gateway with API keys instead of Function URL
   - Or add custom authentication in the Lambda function
   - Or use AWS Cognito

2. **Rate Limiting:**

   - Configure API Gateway throttling
   - Or implement rate limiting in the Lambda function

3. **Environment Variables:**

   - Use AWS Secrets Manager instead of environment variables for sensitive data
   - Enable encryption at rest for environment variables

4. **CORS:**
   - Update CORS headers to only allow your specific frontend domain(s)

## Cost

AWS Lambda has a generous free tier:

- 1 million free requests per month
- 400,000 GB-seconds of compute time per month

This should cover most use cases with minimal to no cost.
