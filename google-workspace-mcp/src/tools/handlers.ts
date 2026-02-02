/**
 * Tool Handlers
 * Implementation of all MCP tool handlers
 */

import { authenticate, isAuthenticated, getAuthStatus } from "../auth.js";
import { GoogleMeetService } from "../meet-api.js";
import { GmailService, getHeader, getMessageBody } from "../gmail-api.js";
import { GoogleDocsService, getDocumentUrl } from "../docs-api.js";
import { logger } from "../logger.js";
import {
  formatDate,
  formatDuration,
  getParticipantDisplayName,
  getMeetingLink,
  createErrorResponse,
  createSuccessResponse,
  NOT_AUTHENTICATED_RESPONSE,
} from "../utils.js";
import {
  validateInput,
  ListConferencesSchema,
  GetConferenceSchema,
  ConferenceNameSchema,
  TranscriptNameSchema,
  ListMeetingsSchema,
  ListEmailsSchema,
  SearchEmailsSchema,
  GetEmailSchema,
  GetThreadSchema,
  SendEmailSchema,
  TrashEmailSchema,
  MarkEmailSchema,
  ListDocsSchema,
  SearchDocsSchema,
  GetDocSchema,
  CreateDocSchema,
  AppendToDocSchema,
  ReplaceInDocSchema,
  CreateCalendarEventSchema,
} from "../schemas.js";
import type { ToolResponse, GoogleAuth } from "../types.js";

// Singleton service instances
let meetService: GoogleMeetService | null = null;
let gmailService: GmailService | null = null;
let docsService: GoogleDocsService | null = null;
let authInstance: GoogleAuth | null = null;

/**
 * Ensure authenticated and return auth instance
 */
async function ensureAuth(): Promise<GoogleAuth> {
  if (authInstance) {
    return authInstance;
  }

  if (isAuthenticated()) {
    logger.debug("Auto-authenticating with saved credentials");
    authInstance = await authenticate();
    return authInstance;
  }

  throw new Error("NOT_AUTHENTICATED");
}

/**
 * Get Meet service (lazy initialization)
 */
async function getMeetService(): Promise<GoogleMeetService> {
  if (meetService) return meetService;
  const auth = await ensureAuth();
  meetService = new GoogleMeetService(auth);
  return meetService;
}

/**
 * Get Gmail service (lazy initialization)
 */
async function getGmailService(): Promise<GmailService> {
  if (gmailService) return gmailService;
  const auth = await ensureAuth();
  gmailService = new GmailService(auth);
  return gmailService;
}

/**
 * Get Docs service (lazy initialization)
 */
async function getDocsService(): Promise<GoogleDocsService> {
  if (docsService) return docsService;
  const auth = await ensureAuth();
  docsService = new GoogleDocsService(auth);
  return docsService;
}

/**
 * Wrapper to handle authentication errors consistently
 */
async function withMeetAuth<T>(
  handler: (service: GoogleMeetService) => Promise<T>
): Promise<T | ToolResponse> {
  try {
    const service = await getMeetService();
    return await handler(service);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_AUTHENTICATED") {
      return NOT_AUTHENTICATED_RESPONSE;
    }
    throw error;
  }
}

/**
 * Wrapper for Gmail handlers
 */
async function withGmailAuth<T>(
  handler: (service: GmailService) => Promise<T>
): Promise<T | ToolResponse> {
  try {
    const service = await getGmailService();
    return await handler(service);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_AUTHENTICATED") {
      return NOT_AUTHENTICATED_RESPONSE;
    }
    throw error;
  }
}

/**
 * Wrapper for Docs handlers
 */
async function withDocsAuth<T>(
  handler: (service: GoogleDocsService) => Promise<T>
): Promise<T | ToolResponse> {
  try {
    const service = await getDocsService();
    return await handler(service);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_AUTHENTICATED") {
      return NOT_AUTHENTICATED_RESPONSE;
    }
    throw error;
  }
}

// ============================================================================
// Auth Tool Handlers
// ============================================================================

export async function handleAuthStatus(): Promise<ToolResponse> {
  return createSuccessResponse(getAuthStatus());
}

export async function handleAuthenticate(): Promise<ToolResponse> {
  try {
    authInstance = await authenticate();
    meetService = new GoogleMeetService(authInstance);
    gmailService = new GmailService(authInstance);
    docsService = new GoogleDocsService(authInstance);
    return createSuccessResponse(
      "✅ Successfully authenticated with Google!\n\nYou can now use Google Meet, Calendar, Gmail, and Docs tools."
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createErrorResponse(`❌ Authentication failed: ${message}`);
  }
}

// ============================================================================
// Meet Tool Handlers
// ============================================================================

export async function handleListConferences(args: unknown): Promise<ToolResponse> {
  return withMeetAuth(async (service) => {
    const { limit } = validateInput(ListConferencesSchema, args);
    const conferences = await service.listConferenceRecords(limit);

    if (conferences.length === 0) {
      return createSuccessResponse(
        "No conference records found.\n\n" +
          "Note: Conference records are only available for meetings where:\n" +
          "- Recording or transcription was enabled\n" +
          "- The meeting occurred recently (records expire after some time)"
      );
    }

    const formatted = conferences
      .map((conf, i) => {
        return `**${i + 1}. Conference**
- Name: \`${conf.name}\`
- Start: ${formatDate(conf.startTime)}
- End: ${formatDate(conf.endTime)}
- Duration: ${formatDuration(conf.startTime, conf.endTime)}`;
      })
      .join("\n\n");

    return createSuccessResponse(
      `**Recent Conference Records:**\n\n${formatted}\n\n---\n` +
        "Use `list_recordings` or `list_transcripts` with a conference name to get artifacts."
    );
  }) as Promise<ToolResponse>;
}

export async function handleGetConference(args: unknown): Promise<ToolResponse> {
  return withMeetAuth(async (service) => {
    const { name } = validateInput(GetConferenceSchema, args);
    const conf = await service.getConferenceRecord(name);

    return createSuccessResponse(
      `**Conference Details:**\n\n` +
        `- Name: \`${conf.name}\`\n` +
        `- Start: ${formatDate(conf.startTime)}\n` +
        `- End: ${formatDate(conf.endTime)}\n` +
        `- Duration: ${formatDuration(conf.startTime, conf.endTime)}\n` +
        `- Space: ${conf.space || "N/A"}`
    );
  }) as Promise<ToolResponse>;
}

export async function handleListParticipants(args: unknown): Promise<ToolResponse> {
  return withMeetAuth(async (service) => {
    const { conference_name } = validateInput(ConferenceNameSchema, args);
    const participants = await service.listParticipants(conference_name);

    if (participants.length === 0) {
      return createSuccessResponse("No participants found for this conference.");
    }

    const formatted = participants
      .map((p, i) => {
        const displayName = getParticipantDisplayName(p);
        return `${i + 1}. **${displayName}**
   - Joined: ${formatDate(p.earliestStartTime)}
   - Left: ${formatDate(p.latestEndTime)}`;
      })
      .join("\n\n");

    return createSuccessResponse(`**Participants (${participants.length}):**\n\n${formatted}`);
  }) as Promise<ToolResponse>;
}

export async function handleListRecordings(args: unknown): Promise<ToolResponse> {
  return withMeetAuth(async (service) => {
    const { conference_name } = validateInput(ConferenceNameSchema, args);
    const recordings = await service.listRecordings(conference_name);

    if (recordings.length === 0) {
      return createSuccessResponse(
        "No recordings found for this conference.\n\n" +
          "Note: Recordings must be enabled in the meeting for them to be available."
      );
    }

    const formatted = recordings
      .map((rec, i) => {
        return `**${i + 1}. Recording**
- Name: \`${rec.name}\`
- State: ${rec.state || "N/A"}
- Start: ${formatDate(rec.startTime)}
- End: ${formatDate(rec.endTime)}
- Drive Link: ${rec.driveDestination?.exportUri || "N/A"}`;
      })
      .join("\n\n");

    return createSuccessResponse(`**Recordings:**\n\n${formatted}`);
  }) as Promise<ToolResponse>;
}

export async function handleListTranscripts(args: unknown): Promise<ToolResponse> {
  return withMeetAuth(async (service) => {
    const { conference_name } = validateInput(ConferenceNameSchema, args);
    const transcripts = await service.listTranscripts(conference_name);

    if (transcripts.length === 0) {
      return createSuccessResponse(
        "No transcripts found for this conference.\n\n" +
          "Note: Transcription must be enabled in the meeting for transcripts to be available."
      );
    }

    const formatted = transcripts
      .map((trans, i) => {
        return `**${i + 1}. Transcript**
- Name: \`${trans.name}\`
- State: ${trans.state || "N/A"}
- Start: ${formatDate(trans.startTime)}
- End: ${formatDate(trans.endTime)}
- Docs Link: ${trans.docsDestination?.exportUri || "N/A"}`;
      })
      .join("\n\n");

    return createSuccessResponse(
      `**Transcripts:**\n\n${formatted}\n\n---\n` +
        "Use `get_transcript_text` with a transcript name to get the actual text."
    );
  }) as Promise<ToolResponse>;
}

export async function handleGetTranscriptText(args: unknown): Promise<ToolResponse> {
  return withMeetAuth(async (service) => {
    const { transcript_name } = validateInput(TranscriptNameSchema, args);
    const entries = await service.listTranscriptEntries(transcript_name);

    if (entries.length === 0) {
      return createSuccessResponse("No transcript entries found.");
    }

    const formatted = entries
      .map((entry) => {
        const time = formatDate(entry.startTime);
        const speaker = entry.participant || "Unknown";
        return `[${time}] ${speaker}: ${entry.text}`;
      })
      .join("\n");

    return createSuccessResponse(`**Transcript:**\n\n${formatted}`);
  }) as Promise<ToolResponse>;
}

export async function handleCreateMeeting(): Promise<ToolResponse> {
  return withMeetAuth(async (service) => {
    const space = await service.createSpace();

    return createSuccessResponse(
      `✅ **Meeting Created!**\n\n` +
        `- Meeting URI: ${space.meetingUri || "N/A"}\n` +
        `- Meeting Code: ${space.meetingCode || "N/A"}\n` +
        `- Resource Name: \`${space.name}\``
    );
  }) as Promise<ToolResponse>;
}

export async function handleListUpcomingMeetings(args: unknown): Promise<ToolResponse> {
  return withMeetAuth(async (service) => {
    const { limit } = validateInput(ListMeetingsSchema, args);
    const meetings = await service.listUpcomingMeetings(limit);

    if (meetings.length === 0) {
      return createSuccessResponse("No upcoming Google Meet meetings found in your calendar.");
    }

    const formatted = meetings
      .map((event, i) => {
        const start = event.start?.dateTime || event.start?.date;
        const meetLink = getMeetingLink(event);
        return `**${i + 1}. ${event.summary || "Untitled"}**
- When: ${formatDate(start)}
- Meet Link: ${meetLink}`;
      })
      .join("\n\n");

    return createSuccessResponse(`**Upcoming Google Meet Meetings:**\n\n${formatted}`);
  }) as Promise<ToolResponse>;
}

export async function handleListPastMeetings(args: unknown): Promise<ToolResponse> {
  return withMeetAuth(async (service) => {
    const { limit } = validateInput(ListMeetingsSchema, args);
    const meetings = await service.listPastMeetings(limit);

    if (meetings.length === 0) {
      return createSuccessResponse(
        "No past Google Meet meetings found in your calendar (last 30 days)."
      );
    }

    const formatted = meetings
      .map((event, i) => {
        const start = event.start?.dateTime || event.start?.date;
        const meetLink = getMeetingLink(event);
        return `**${i + 1}. ${event.summary || "Untitled"}**
- When: ${formatDate(start)}
- Meet Link: ${meetLink}`;
      })
      .join("\n\n");

    return createSuccessResponse(`**Past Google Meet Meetings (Last 30 Days):**\n\n${formatted}`);
  }) as Promise<ToolResponse>;
}

export async function handleSummarizeTranscript(args: unknown): Promise<ToolResponse> {
  return withMeetAuth(async (service) => {
    const { transcript_name } = validateInput(TranscriptNameSchema, args);
    const entries = await service.listTranscriptEntries(transcript_name);

    if (entries.length === 0) {
      return createSuccessResponse("No transcript entries found to summarize.");
    }

    const transcriptText = entries
      .map((entry) => {
        const speaker = entry.participant || "Speaker";
        return `${speaker}: ${entry.text}`;
      })
      .join("\n");

    const totalDuration =
      entries.length > 0
        ? formatDuration(entries[0].startTime, entries[entries.length - 1].endTime)
        : "N/A";

    return createSuccessResponse(
      `Here is the meeting transcript to summarize:\n\n` +
        `---\n**TRANSCRIPT** (Duration: ${totalDuration}, Entries: ${entries.length})\n---\n\n` +
        `${transcriptText}\n\n` +
        `---\n\n` +
        `Please provide a comprehensive meeting summary including:\n\n` +
        `1. **Meeting Overview**: Brief description of what the meeting was about\n\n` +
        `2. **Key Discussion Points**: Main topics that were discussed\n\n` +
        `3. **Decisions Made**: Any decisions or conclusions reached\n\n` +
        `4. **Action Items**: Tasks or follow-ups mentioned (with assignees if mentioned)\n\n` +
        `5. **Important Quotes**: Any notable statements or commitments\n\n` +
        `6. **Next Steps**: What should happen after this meeting`
    );
  }) as Promise<ToolResponse>;
}

export async function handleCreateCalendarEvent(args: unknown): Promise<ToolResponse> {
  return withMeetAuth(async (service) => {
    const params = validateInput(CreateCalendarEventSchema, args);
    const event = await service.createCalendarEvent(params);

    const attendeesList = event.attendees?.length
      ? event.attendees.map((a) => `  - ${a.email}`).join("\n")
      : "None";

    const startTime = event.start.dateTime
      ? new Date(event.start.dateTime).toLocaleString()
      : event.start.date || "N/A";

    return createSuccessResponse(
      `✅ **Calendar Event Created!**\n\n` +
        `- **Title:** ${event.summary}\n` +
        `- **When:** ${startTime}\n` +
        `- **Calendar Link:** ${event.htmlLink}\n` +
        (event.hangoutLink ? `- **Google Meet:** ${event.hangoutLink}\n` : "") +
        `\n**Attendees:**\n${attendeesList}`
    );
  }) as Promise<ToolResponse>;
}

// ============================================================================
// Gmail Tool Handlers
// ============================================================================

export async function handleGmailProfile(): Promise<ToolResponse> {
  return withGmailAuth(async (service) => {
    const profile = await service.getProfile();

    return createSuccessResponse(
      `**Gmail Profile:**\n\n` +
        `- Email: ${profile.emailAddress}\n` +
        `- Total Messages: ${profile.messagesTotal.toLocaleString()}\n` +
        `- Total Threads: ${profile.threadsTotal.toLocaleString()}`
    );
  }) as Promise<ToolResponse>;
}

export async function handleListEmails(args: unknown): Promise<ToolResponse> {
  return withGmailAuth(async (service) => {
    const { limit } = validateInput(ListEmailsSchema, args);
    const messages = await service.listMessages(undefined, limit);

    if (messages.length === 0) {
      return createSuccessResponse("No emails found in your inbox.");
    }

    const formatted = messages
      .map((msg, i) => {
        const from = getHeader(msg, "From");
        const subject = getHeader(msg, "Subject") || "(No Subject)";
        const date = getHeader(msg, "Date");
        const isUnread = msg.labelIds?.includes("UNREAD") ? "🔵 " : "";
        return `**${i + 1}. ${isUnread}${subject}**
- From: ${from}
- Date: ${date}
- ID: \`${msg.id}\`
- Snippet: ${msg.snippet?.substring(0, 100)}...`;
      })
      .join("\n\n");

    return createSuccessResponse(`**Inbox (${messages.length} emails):**\n\n${formatted}`);
  }) as Promise<ToolResponse>;
}

export async function handleSearchEmails(args: unknown): Promise<ToolResponse> {
  return withGmailAuth(async (service) => {
    const { query, limit } = validateInput(SearchEmailsSchema, args);
    const messages = await service.searchEmails(query, limit);

    if (messages.length === 0) {
      return createSuccessResponse(`No emails found matching: "${query}"`);
    }

    const formatted = messages
      .map((msg, i) => {
        const from = getHeader(msg, "From");
        const subject = getHeader(msg, "Subject") || "(No Subject)";
        const date = getHeader(msg, "Date");
        return `**${i + 1}. ${subject}**
- From: ${from}
- Date: ${date}
- ID: \`${msg.id}\``;
      })
      .join("\n\n");

    return createSuccessResponse(
      `**Search Results for "${query}" (${messages.length} emails):**\n\n${formatted}`
    );
  }) as Promise<ToolResponse>;
}

export async function handleGetEmail(args: unknown): Promise<ToolResponse> {
  return withGmailAuth(async (service) => {
    const { message_id } = validateInput(GetEmailSchema, args);
    const message = await service.getMessage(message_id);

    const from = getHeader(message, "From");
    const to = getHeader(message, "To");
    const subject = getHeader(message, "Subject") || "(No Subject)";
    const date = getHeader(message, "Date");
    const body = getMessageBody(message);

    return createSuccessResponse(
      `**Email Details:**\n\n` +
        `- **Subject:** ${subject}\n` +
        `- **From:** ${from}\n` +
        `- **To:** ${to}\n` +
        `- **Date:** ${date}\n` +
        `- **Thread ID:** \`${message.threadId}\`\n\n` +
        `---\n\n**Body:**\n\n${body}`
    );
  }) as Promise<ToolResponse>;
}

export async function handleGetThread(args: unknown): Promise<ToolResponse> {
  return withGmailAuth(async (service) => {
    const { thread_id } = validateInput(GetThreadSchema, args);
    const thread = await service.getThread(thread_id);

    if (!thread.messages || thread.messages.length === 0) {
      return createSuccessResponse("No messages found in this thread.");
    }

    const formatted = thread.messages
      .map((msg, i) => {
        const from = getHeader(msg, "From");
        const date = getHeader(msg, "Date");
        const body = getMessageBody(msg);
        return `**Message ${i + 1}**\n- From: ${from}\n- Date: ${date}\n\n${body}`;
      })
      .join("\n\n---\n\n");

    const subject = getHeader(thread.messages[0], "Subject") || "(No Subject)";

    return createSuccessResponse(
      `**Thread: ${subject}** (${thread.messages.length} messages)\n\n---\n\n${formatted}`
    );
  }) as Promise<ToolResponse>;
}

export async function handleSendEmail(args: unknown): Promise<ToolResponse> {
  return withGmailAuth(async (service) => {
    const params = validateInput(SendEmailSchema, args);
    const message = await service.sendEmail(params);

    return createSuccessResponse(
      `✅ **Email Sent Successfully!**\n\n` +
        `- To: ${params.to}\n` +
        `- Subject: ${params.subject}\n` +
        `- Message ID: \`${message.id}\``
    );
  }) as Promise<ToolResponse>;
}

export async function handleCreateDraft(args: unknown): Promise<ToolResponse> {
  return withGmailAuth(async (service) => {
    const params = validateInput(SendEmailSchema, args);
    const draft = await service.createDraft(params);

    return createSuccessResponse(
      `✅ **Draft Created Successfully!**\n\n` +
        `- To: ${params.to}\n` +
        `- Subject: ${params.subject}\n` +
        `- Draft ID: \`${draft.id}\``
    );
  }) as Promise<ToolResponse>;
}

export async function handleListLabels(): Promise<ToolResponse> {
  return withGmailAuth(async (service) => {
    const labels = await service.listLabels();

    const formatted = labels
      .map((label) => `- **${label.name}** (\`${label.id}\`)`)
      .join("\n");

    return createSuccessResponse(`**Gmail Labels:**\n\n${formatted}`);
  }) as Promise<ToolResponse>;
}

export async function handleTrashEmail(args: unknown): Promise<ToolResponse> {
  return withGmailAuth(async (service) => {
    const { message_id } = validateInput(TrashEmailSchema, args);
    await service.trashMessage(message_id);

    return createSuccessResponse(`✅ Email moved to trash: \`${message_id}\``);
  }) as Promise<ToolResponse>;
}

export async function handleMarkAsRead(args: unknown): Promise<ToolResponse> {
  return withGmailAuth(async (service) => {
    const { message_id } = validateInput(MarkEmailSchema, args);
    await service.markAsRead(message_id);

    return createSuccessResponse(`✅ Email marked as read: \`${message_id}\``);
  }) as Promise<ToolResponse>;
}

export async function handleMarkAsUnread(args: unknown): Promise<ToolResponse> {
  return withGmailAuth(async (service) => {
    const { message_id } = validateInput(MarkEmailSchema, args);
    await service.markAsUnread(message_id);

    return createSuccessResponse(`✅ Email marked as unread: \`${message_id}\``);
  }) as Promise<ToolResponse>;
}

// ============================================================================
// Google Docs Tool Handlers
// ============================================================================

export async function handleListDocs(args: unknown): Promise<ToolResponse> {
  return withDocsAuth(async (service) => {
    const { limit } = validateInput(ListDocsSchema, args);
    const docs = await service.listDocuments(limit);

    if (docs.length === 0) {
      return createSuccessResponse("No Google Docs found in your Drive.");
    }

    const formatted = docs
      .map((doc, i) => {
        const modified = new Date(doc.modifiedTime).toLocaleString();
        return `**${i + 1}. ${doc.name}**
- ID: \`${doc.id}\`
- Modified: ${modified}
- URL: ${getDocumentUrl(doc.id)}`;
      })
      .join("\n\n");

    return createSuccessResponse(`**Recent Google Docs (${docs.length}):**\n\n${formatted}`);
  }) as Promise<ToolResponse>;
}

export async function handleSearchDocs(args: unknown): Promise<ToolResponse> {
  return withDocsAuth(async (service) => {
    const { query, limit } = validateInput(SearchDocsSchema, args);
    const docs = await service.searchDocuments(query, limit);

    if (docs.length === 0) {
      return createSuccessResponse(`No documents found matching: "${query}"`);
    }

    const formatted = docs
      .map((doc, i) => {
        const modified = new Date(doc.modifiedTime).toLocaleString();
        return `**${i + 1}. ${doc.name}**
- ID: \`${doc.id}\`
- Modified: ${modified}
- URL: ${getDocumentUrl(doc.id)}`;
      })
      .join("\n\n");

    return createSuccessResponse(
      `**Search Results for "${query}" (${docs.length} documents):**\n\n${formatted}`
    );
  }) as Promise<ToolResponse>;
}

export async function handleGetDoc(args: unknown): Promise<ToolResponse> {
  return withDocsAuth(async (service) => {
    const { document_id } = validateInput(GetDocSchema, args);
    const doc = await service.getDocument(document_id);
    const text = await service.getDocumentText(document_id);

    return createSuccessResponse(
      `**Document: ${doc.title}**\n\n` +
        `- ID: \`${doc.documentId}\`\n` +
        `- URL: ${getDocumentUrl(doc.documentId)}\n\n` +
        `---\n\n**Content:**\n\n${text || "(Empty document)"}`
    );
  }) as Promise<ToolResponse>;
}

export async function handleCreateDoc(args: unknown): Promise<ToolResponse> {
  return withDocsAuth(async (service) => {
    const { title, content } = validateInput(CreateDocSchema, args);
    const doc = await service.createDocument({ title, content });

    return createSuccessResponse(
      `✅ **Document Created!**\n\n` +
        `- Title: ${doc.title}\n` +
        `- ID: \`${doc.documentId}\`\n` +
        `- URL: ${getDocumentUrl(doc.documentId)}`
    );
  }) as Promise<ToolResponse>;
}

export async function handleAppendToDoc(args: unknown): Promise<ToolResponse> {
  return withDocsAuth(async (service) => {
    const { document_id, text } = validateInput(AppendToDocSchema, args);
    await service.appendText(document_id, text);

    return createSuccessResponse(
      `✅ Text appended to document!\n\n` +
        `- Document ID: \`${document_id}\`\n` +
        `- URL: ${getDocumentUrl(document_id)}`
    );
  }) as Promise<ToolResponse>;
}

export async function handleReplaceInDoc(args: unknown): Promise<ToolResponse> {
  return withDocsAuth(async (service) => {
    const { document_id, search_text, replace_text, match_case } = validateInput(
      ReplaceInDocSchema,
      args
    );
    const count = await service.replaceText(document_id, search_text, replace_text, match_case);

    return createSuccessResponse(
      `✅ Text replaced in document!\n\n` +
        `- Occurrences replaced: ${count}\n` +
        `- Search: "${search_text}"\n` +
        `- Replace: "${replace_text}"\n` +
        `- Document: ${getDocumentUrl(document_id)}`
    );
  }) as Promise<ToolResponse>;
}

// ============================================================================
// Tool Router
// ============================================================================

/**
 * Route tool calls to appropriate handlers
 */
export async function handleToolCall(
  name: string,
  args: unknown
): Promise<ToolResponse> {
  logger.debug(`Handling tool call: ${name}`);

  switch (name) {
    // Auth
    case "auth_status":
      return handleAuthStatus();
    case "authenticate":
      return handleAuthenticate();

    // Meet
    case "list_conferences":
      return handleListConferences(args);
    case "get_conference":
      return handleGetConference(args);
    case "list_participants":
      return handleListParticipants(args);
    case "list_recordings":
      return handleListRecordings(args);
    case "list_transcripts":
      return handleListTranscripts(args);
    case "get_transcript_text":
      return handleGetTranscriptText(args);
    case "create_meeting":
      return handleCreateMeeting();
    case "list_upcoming_meetings":
      return handleListUpcomingMeetings(args);
    case "list_past_meetings":
      return handleListPastMeetings(args);
    case "summarize_transcript":
      return handleSummarizeTranscript(args);
    case "create_calendar_event":
      return handleCreateCalendarEvent(args);

    // Gmail
    case "gmail_profile":
      return handleGmailProfile();
    case "list_emails":
      return handleListEmails(args);
    case "search_emails":
      return handleSearchEmails(args);
    case "get_email":
      return handleGetEmail(args);
    case "get_thread":
      return handleGetThread(args);
    case "send_email":
      return handleSendEmail(args);
    case "create_draft":
      return handleCreateDraft(args);
    case "list_labels":
      return handleListLabels();
    case "trash_email":
      return handleTrashEmail(args);
    case "mark_as_read":
      return handleMarkAsRead(args);
    case "mark_as_unread":
      return handleMarkAsUnread(args);

    // Google Docs
    case "list_docs":
      return handleListDocs(args);
    case "search_docs":
      return handleSearchDocs(args);
    case "get_doc":
      return handleGetDoc(args);
    case "create_doc":
      return handleCreateDoc(args);
    case "append_to_doc":
      return handleAppendToDoc(args);
    case "replace_in_doc":
      return handleReplaceInDoc(args);

    default:
      return createErrorResponse(`Unknown tool: ${name}`);
  }
}
