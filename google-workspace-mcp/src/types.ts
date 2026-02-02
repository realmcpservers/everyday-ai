/**
 * Type Definitions
 * Centralized TypeScript interfaces for the application
 */

import type { OAuth2Client } from "google-auth-library";
import type { calendar_v3 } from "googleapis";

// ============================================================================
// Authentication Types
// ============================================================================

export interface ServiceAccountCredentials {
  type: "service_account";
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

export interface OAuthInstalledCredentials {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

export interface OAuthWebCredentials {
  web: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

export type OAuthCredentials = OAuthInstalledCredentials | OAuthWebCredentials;

export interface SavedToken {
  type: "authorized_user";
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

export type GoogleAuth = OAuth2Client | ReturnType<typeof import("googleapis").google.auth.fromJSON>;

// ============================================================================
// Google Meet API Types
// ============================================================================

export interface MeetingSpace {
  name: string;
  meetingUri?: string;
  meetingCode?: string;
  config?: {
    accessType?: string;
    entryPointAccess?: string;
  };
}

export interface ConferenceRecord {
  name: string;
  startTime?: string;
  endTime?: string;
  expireTime?: string;
  space?: string;
}

export interface Participant {
  name: string;
  earliestStartTime?: string;
  latestEndTime?: string;
  signedinUser?: {
    user?: string;
    displayName?: string;
  };
  anonymousUser?: {
    displayName?: string;
  };
  phoneUser?: {
    displayName?: string;
  };
}

export interface Recording {
  name: string;
  state?: "STARTED" | "ENDED" | "FILE_GENERATED";
  startTime?: string;
  endTime?: string;
  driveDestination?: {
    file?: string;
    exportUri?: string;
  };
}

export interface Transcript {
  name: string;
  state?: "STARTED" | "ENDED" | "FILE_GENERATED";
  startTime?: string;
  endTime?: string;
  docsDestination?: {
    document?: string;
    exportUri?: string;
  };
}

export interface TranscriptEntry {
  name: string;
  participant?: string;
  text?: string;
  languageCode?: string;
  startTime?: string;
  endTime?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ListConferenceRecordsResponse {
  conferenceRecords?: ConferenceRecord[];
  nextPageToken?: string;
}

export interface ListParticipantsResponse {
  participants?: Participant[];
  nextPageToken?: string;
}

export interface ListRecordingsResponse {
  recordings?: Recording[];
  nextPageToken?: string;
}

export interface ListTranscriptsResponse {
  transcripts?: Transcript[];
  nextPageToken?: string;
}

export interface ListTranscriptEntriesResponse {
  transcriptEntries?: TranscriptEntry[];
  nextPageToken?: string;
}

// ============================================================================
// Calendar Types
// ============================================================================

export type CalendarEvent = calendar_v3.Schema$Event;

export interface MeetingEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  start?: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  };
  end?: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  };
  hangoutLink?: string | null;
  conferenceData?: {
    conferenceSolution?: {
      name?: string | null;
    };
    entryPoints?: Array<{
      uri?: string | null;
      entryPointType?: string | null;
    }>;
  };
}

// ============================================================================
// Calendar Event Creation Types
// ============================================================================

export interface CreateCalendarEventParams {
  summary: string;
  description?: string;
  start_time: string; // ISO 8601 format or YYYY-MM-DD HH:mm
  end_time?: string;  // ISO 8601 format or YYYY-MM-DD HH:mm
  duration_minutes?: number; // Alternative to end_time
  attendees?: string[]; // List of email addresses
  location?: string;
  timezone?: string;
  add_meet_link?: boolean;
}

export interface CreatedCalendarEvent {
  id: string;
  summary: string;
  htmlLink: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  hangoutLink?: string;
  attendees?: Array<{
    email: string;
    responseStatus?: string;
  }>;
}

// ============================================================================
// Tool Input Types
// ============================================================================

export interface ListConferencesInput {
  limit?: number;
}

export interface GetConferenceInput {
  name: string;
}

export interface ConferenceNameInput {
  conference_name: string;
}

export interface TranscriptNameInput {
  transcript_name: string;
}

export interface LimitInput {
  limit?: number;
}

// ============================================================================
// Google Docs Types
// ============================================================================

export interface GoogleDoc {
  documentId: string;
  title: string;
  body?: {
    content?: DocContent[];
  };
  revisionId?: string;
}

export interface DocContent {
  startIndex?: number;
  endIndex?: number;
  paragraph?: {
    elements?: ParagraphElement[];
    paragraphStyle?: {
      namedStyleType?: string;
    };
  };
  table?: {
    rows?: number;
    columns?: number;
    tableRows?: TableRow[];
  };
  sectionBreak?: object;
}

export interface ParagraphElement {
  startIndex?: number;
  endIndex?: number;
  textRun?: {
    content?: string;
    textStyle?: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      link?: {
        url?: string;
      };
    };
  };
}

export interface TableRow {
  tableCells?: TableCell[];
}

export interface TableCell {
  content?: DocContent[];
}

export interface CreateDocParams {
  title: string;
  content?: string;
}

export interface AppendToDocParams {
  document_id: string;
  text: string;
}

export interface GetDocParams {
  document_id: string;
}

// ============================================================================
// Gmail Types
// ============================================================================

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{
      name: string;
      value: string;
    }>;
    body?: {
      data?: string;
      size?: number;
    };
    parts?: Array<{
      mimeType?: string;
      body?: {
        data?: string;
        size?: number;
      };
    }>;
    mimeType?: string;
  };
  internalDate?: string;
}

export interface GmailThread {
  id: string;
  snippet?: string;
  historyId?: string;
  messages?: GmailMessage[];
}

export interface GmailLabel {
  id: string;
  name: string;
  type?: string;
  messageListVisibility?: string;
  labelListVisibility?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export interface GmailDraft {
  id: string;
  message?: GmailMessage;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

export interface SearchEmailParams {
  query: string;
  maxResults?: number;
}

export interface GetEmailParams {
  messageId: string;
}

export interface GetThreadParams {
  threadId: string;
}

// ============================================================================
// MCP Response Types
// ============================================================================

export interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
  [key: string]: unknown;
}
