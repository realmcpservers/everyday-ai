/**
 * Google Authentication Module
 * Supports both Service Account and OAuth2 authentication
 */

import { google } from "googleapis";
import { type OAuth2Client, CodeChallengeMethod } from "google-auth-library";
import * as fs from "fs";
import * as http from "http";
import * as crypto from "crypto";
import { URL } from "url";

import { config } from "./config.js";
import { logger } from "./logger.js";
import type {
  ServiceAccountCredentials,
  OAuthCredentials,
  SavedToken,
  GoogleAuth,
} from "./types.js";

/**
 * Detect credential type from file content
 */
function getCredentialType(credentials: unknown): "service_account" | "oauth" {
  if (
    typeof credentials === "object" &&
    credentials !== null &&
    "type" in credentials &&
    credentials.type === "service_account"
  ) {
    return "service_account";
  }
  return "oauth";
}

/**
 * Authenticate using Service Account
 */
async function authenticateServiceAccount(
  credentials: ServiceAccountCredentials
): Promise<GoogleAuth> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: config.scopes,
  });

  return auth as unknown as GoogleAuth;
}

/**
 * Load saved OAuth token if exists
 */
function loadSavedToken(): SavedToken | null {
  try {
    if (fs.existsSync(config.tokenPath)) {
      const content = fs.readFileSync(config.tokenPath, "utf-8");
      return JSON.parse(content) as SavedToken;
    }
  } catch (err) {
    logger.error("Error loading saved token", err);
  }
  return null;
}

/**
 * Save OAuth credentials to disk
 */
function saveCredentials(client: OAuth2Client, credentials: OAuthCredentials): void {
  const tempPath = `${config.tokenPath}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  let createdTemp = false;
  try {
    const key = "installed" in credentials ? credentials.installed : credentials.web;
    if (!key || !client.credentials.refresh_token) {
      throw new Error("Google did not return a refresh token; existing credentials were not changed. Retry OAuth consent.");
    }

    const payload: SavedToken = {
      type: "authorized_user",
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    };
    const fd = fs.openSync(tempPath, "wx", 0o600);
    createdTemp = true;
    try {
      fs.writeFileSync(fd, JSON.stringify(payload, null, 2));
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tempPath, config.tokenPath);
    createdTemp = false;
    logger.info("OAuth credentials saved successfully");
  } catch (err) {
    if (createdTemp && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw err;
  }
}

/**
 * Start local server for OAuth callback
 */
function startLocalServer(
  oauth2Client: OAuth2Client,
  credentials: OAuthCredentials,
  expectedState: string,
  codeVerifier: string,
  resolve: (value: GoogleAuth) => void,
  reject: (reason?: Error) => void
): http.Server {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, config.oauthRedirectUri);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");

      // Validate state to prevent CSRF attacks
      if (returnedState !== expectedState) {
        res.writeHead(403, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Authentication Failed</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>❌ Authentication Failed</h1>
              <p>Invalid state parameter. Please try again.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error("Invalid state parameter - possible CSRF attack"));
        return;
      }

      if (code) {
        const { tokens } = await oauth2Client.getToken({
          code: code,
          codeVerifier: codeVerifier,
        });
        oauth2Client.setCredentials(tokens);
        saveCredentials(oauth2Client, credentials);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Authentication Successful</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>✅ Authentication Successful!</h1>
              <p>You can close this window and return to your application.</p>
            </body>
          </html>
        `);

        server.close();
        resolve(oauth2Client as GoogleAuth);
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("No authorization code received");
      }
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Authentication failed");
      server.close();
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });

  return server;
}

/**
 * Authenticate using OAuth2
 */
async function authenticateOAuth(credentials: OAuthCredentials, force = false): Promise<GoogleAuth> {
  // Check for existing token
  const savedToken = loadSavedToken();
  if (savedToken && !force) {
    logger.debug("Using saved OAuth token");
    const auth = google.auth.fromJSON(savedToken);
    return auth as GoogleAuth;
  }

  const key = "installed" in credentials ? credentials.installed : credentials.web;
  if (!key) {
    throw new Error("Invalid OAuth credentials format");
  }

  const oauth2Client = new google.auth.OAuth2(
    key.client_id,
    key.client_secret,
    config.oauthRedirectUri
  );

  // Generate cryptographically secure random state for CSRF protection
  const state = crypto.randomBytes(32).toString("hex");

  // Generate PKCE code verifier and challenge for Authorization Code Interception protection
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // Generate auth URL with state parameter and PKCE
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: config.scopes,
    prompt: "consent",
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });

  logger.info("Authorization required - please visit the URL to authorize");
  console.error("\n🔐 Authorization required!");
  console.error("Please visit this URL to authorize:\n");
  console.error(authUrl);
  console.error("\n");

  // Start local server and wait for callback
  return new Promise((resolve, reject) => {
    const server = startLocalServer(oauth2Client, credentials, state, codeVerifier, resolve, reject);
    server.listen(config.oauthPort, () => {
      logger.info(`OAuth callback server listening on port ${config.oauthPort}`);
    });
  });
}

/**
 * Main authentication function
 * Automatically detects credential type and authenticates accordingly
 */
export async function authenticate(options: { force?: boolean } = {}): Promise<GoogleAuth> {
  // Check for credentials file
  if (!fs.existsSync(config.credentialsPath)) {
    throw new Error(
      `credentials.json not found at ${config.credentialsPath}\n\n` +
        "To get credentials:\n" +
        "1. Go to https://console.cloud.google.com/\n" +
        "2. Create a project and enable Google Meet API\n" +
        "3. Go to APIs & Services → Credentials\n" +
        "4. Create either:\n" +
        "   - Service Account (recommended) - download JSON key\n" +
        "   - OAuth client ID (Desktop app) - download JSON\n" +
        "5. Save the file as 'credentials.json' in the project root"
    );
  }

  const credentials = JSON.parse(fs.readFileSync(config.credentialsPath, "utf-8"));
  const credType = getCredentialType(credentials);

  if (credType === "service_account") {
    logger.info("Using Service Account authentication");
    return authenticateServiceAccount(credentials as ServiceAccountCredentials);
  } else {
    logger.info("Using OAuth2 authentication");
    return authenticateOAuth(credentials as OAuthCredentials, options.force);
  }
}

/**
 * Check if authenticated
 */
export function isAuthenticated(): boolean {
  if (!fs.existsSync(config.credentialsPath)) {
    return false;
  }

  try {
    const credentials = JSON.parse(fs.readFileSync(config.credentialsPath, "utf-8"));
    const credType = getCredentialType(credentials);

    if (credType === "service_account") {
      // Service accounts are always "authenticated" if credentials exist
      return true;
    } else {
      // OAuth requires a saved token
      return fs.existsSync(config.tokenPath);
    }
  } catch {
    return false;
  }
}

/**
 * Get auth status message
 */
export function getAuthStatus(): string {
  if (!fs.existsSync(config.credentialsPath)) {
    return "❌ No credentials found. Please add credentials.json to the project root.";
  }

  try {
    const credentials = JSON.parse(fs.readFileSync(config.credentialsPath, "utf-8"));
    const credType = getCredentialType(credentials);

    if (credType === "service_account") {
      const serviceAccount = credentials as ServiceAccountCredentials;
      return `✅ Service Account configured: ${serviceAccount.client_email}`;
    } else if (fs.existsSync(config.tokenPath)) {
      return "✅ Authenticated with Google (OAuth)";
    } else {
      return "⚠️ OAuth credentials found but not authenticated. Use the 'authenticate' tool to sign in.";
    }
  } catch {
    return "❌ Error reading credentials file.";
  }
}
