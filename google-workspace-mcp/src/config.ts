/**
 * Configuration Module
 * Centralizes all configuration with environment variable support
 */

import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Application configuration
 */
export const config = {
  /** Path to OAuth credentials file */
  credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || 
    path.resolve(__dirname, "..", "credentials.json"),
  
  /** Path to stored OAuth token */
  tokenPath: process.env.GOOGLE_TOKEN_PATH || 
    path.resolve(__dirname, "..", "token.json"),
  
  /** OAuth callback port */
  oauthPort: parseInt(process.env.OAUTH_PORT || "3000", 10),
  
  /** OAuth callback URL */
  get oauthRedirectUri(): string {
    return `http://localhost:${this.oauthPort}`;
  },
  
  /** Google Meet API base URL */
  meetApiBase: "https://meet.googleapis.com/v2",
  
  /** Default page sizes */
  defaults: {
    conferencePageSize: 10,
    participantPageSize: 50,
    transcriptPageSize: 100,
    calendarMaxResults: 10,
    pastMeetingsDays: 30,
  },
  
  /** OAuth2 scopes */
  scopes: [
    // Google Meet
    "https://www.googleapis.com/auth/meetings.space.readonly",
    "https://www.googleapis.com/auth/meetings.space.created",
    // Google Calendar
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    // Google Drive
    "https://www.googleapis.com/auth/drive.readonly",
    // Gmail
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.modify",
    // Google Docs
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/documents.readonly",
  ] as string[],
  
  /** Gmail defaults */
  gmail: {
    maxResults: 10,
    defaultLabels: ["INBOX"],
  },
};

export type Config = typeof config;
