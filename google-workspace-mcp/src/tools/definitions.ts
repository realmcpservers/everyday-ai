/**
 * MCP Tool Definitions
 * Defines all available tools with their schemas
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const tools: Tool[] = [
  {
    name: "auth_status",
    description:
      "Check the current authentication status with Google. Returns whether you are authenticated or need to sign in.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "authenticate",
    description:
      "Authenticate with Google to access Google Meet API. This will open a browser window for OAuth sign-in. Required before using other tools.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_conferences",
    description:
      "List recent conference records (past Google Meet meetings). Returns meeting details including start/end times.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of conferences to return (default: 10, max: 100)",
        },
      },
    },
  },
  {
    name: "get_conference",
    description:
      "Get details about a specific conference record by its resource name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "The conference record resource name (e.g., conferenceRecords/abc123)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_participants",
    description:
      "List all participants who joined a specific conference/meeting.",
    inputSchema: {
      type: "object" as const,
      properties: {
        conference_name: {
          type: "string",
          description:
            "The conference record resource name (e.g., conferenceRecords/abc123)",
        },
      },
      required: ["conference_name"],
    },
  },
  {
    name: "list_recordings",
    description:
      "List all recordings for a specific conference. Returns recording status and Google Drive links.",
    inputSchema: {
      type: "object" as const,
      properties: {
        conference_name: {
          type: "string",
          description:
            "The conference record resource name (e.g., conferenceRecords/abc123)",
        },
      },
      required: ["conference_name"],
    },
  },
  {
    name: "list_transcripts",
    description:
      "List all transcripts for a specific conference. Returns transcript status and Google Docs links.",
    inputSchema: {
      type: "object" as const,
      properties: {
        conference_name: {
          type: "string",
          description:
            "The conference record resource name (e.g., conferenceRecords/abc123)",
        },
      },
      required: ["conference_name"],
    },
  },
  {
    name: "get_transcript_text",
    description:
      "Get the actual transcript text/entries for a specific transcript. Returns speaker-attributed text with timestamps.",
    inputSchema: {
      type: "object" as const,
      properties: {
        transcript_name: {
          type: "string",
          description:
            "The transcript resource name (e.g., conferenceRecords/abc123/transcripts/xyz789)",
        },
      },
      required: ["transcript_name"],
    },
  },
  {
    name: "create_meeting",
    description:
      "Create a new Google Meet meeting space. Returns the meeting link and code.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_upcoming_meetings",
    description:
      "List upcoming Google Meet meetings from your Google Calendar.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of meetings to return (default: 10, max: 100)",
        },
      },
    },
  },
  {
    name: "list_past_meetings",
    description:
      "List past Google Meet meetings from your Google Calendar (last 30 days).",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of meetings to return (default: 10, max: 100)",
        },
      },
    },
  },
  {
    name: "summarize_transcript",
    description:
      "Get a transcript and format it for summarization. Returns the full transcript text that can be summarized by the AI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        transcript_name: {
          type: "string",
          description: "The transcript resource name",
        },
      },
      required: ["transcript_name"],
    },
  },
  {
    name: "create_calendar_event",
    description:
      "Create a new calendar event with optional Google Meet link. Can add attendees who will receive invitations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description: "Event title/name",
        },
        description: {
          type: "string",
          description: "Event description (optional)",
        },
        start_time: {
          type: "string",
          description: "Start time in format 'YYYY-MM-DD HH:mm' (e.g., '2024-01-30 14:00') or ISO 8601",
        },
        end_time: {
          type: "string",
          description: "End time (optional, defaults to start + duration)",
        },
        duration_minutes: {
          type: "number",
          description: "Duration in minutes (default: 60, used if end_time not provided)",
        },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "List of attendee email addresses",
        },
        location: {
          type: "string",
          description: "Event location (optional)",
        },
        timezone: {
          type: "string",
          description: "Timezone (default: Asia/Kolkata)",
        },
        add_meet_link: {
          type: "boolean",
          description: "Add Google Meet link (default: true)",
        },
      },
      required: ["summary", "start_time"],
    },
  },

  // =========================================================================
  // Gmail Tools
  // =========================================================================
  {
    name: "gmail_profile",
    description:
      "Get your Gmail profile information including email address and message counts.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_emails",
    description:
      "List recent emails from your inbox. Returns subject, sender, and snippet.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of emails to return (default: 10, max: 50)",
        },
      },
    },
  },
  {
    name: "search_emails",
    description:
      "Search emails using Gmail search syntax. Examples: 'from:user@example.com', 'subject:meeting', 'is:unread', 'has:attachment'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Gmail search query (e.g., 'from:boss@company.com is:unread')",
        },
        limit: {
          type: "number",
          description: "Maximum number of emails to return (default: 10, max: 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_email",
    description:
      "Get the full content of a specific email by its message ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        message_id: {
          type: "string",
          description: "The Gmail message ID",
        },
      },
      required: ["message_id"],
    },
  },
  {
    name: "get_thread",
    description:
      "Get all messages in an email thread/conversation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        thread_id: {
          type: "string",
          description: "The Gmail thread ID",
        },
      },
      required: ["thread_id"],
    },
  },
  {
    name: "send_email",
    description:
      "Send a new email. Requires recipient, subject, and body.",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: {
          type: "string",
          description: "Recipient email address",
        },
        subject: {
          type: "string",
          description: "Email subject line",
        },
        body: {
          type: "string",
          description: "Email body (plain text)",
        },
        cc: {
          type: "string",
          description: "CC recipients (comma-separated)",
        },
        bcc: {
          type: "string",
          description: "BCC recipients (comma-separated)",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "create_draft",
    description:
      "Create a draft email without sending it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: {
          type: "string",
          description: "Recipient email address",
        },
        subject: {
          type: "string",
          description: "Email subject line",
        },
        body: {
          type: "string",
          description: "Email body (plain text)",
        },
        cc: {
          type: "string",
          description: "CC recipients (comma-separated)",
        },
        bcc: {
          type: "string",
          description: "BCC recipients (comma-separated)",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "list_labels",
    description:
      "List all Gmail labels (folders) in your account.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "trash_email",
    description:
      "Move an email to trash.",
    inputSchema: {
      type: "object" as const,
      properties: {
        message_id: {
          type: "string",
          description: "The Gmail message ID to trash",
        },
      },
      required: ["message_id"],
    },
  },
  {
    name: "mark_as_read",
    description:
      "Mark an email as read.",
    inputSchema: {
      type: "object" as const,
      properties: {
        message_id: {
          type: "string",
          description: "The Gmail message ID",
        },
      },
      required: ["message_id"],
    },
  },
  {
    name: "mark_as_unread",
    description:
      "Mark an email as unread.",
    inputSchema: {
      type: "object" as const,
      properties: {
        message_id: {
          type: "string",
          description: "The Gmail message ID",
        },
      },
      required: ["message_id"],
    },
  },

  // =========================================================================
  // Google Docs Tools
  // =========================================================================
  {
    name: "list_docs",
    description:
      "List recent Google Docs documents from your Drive, sorted by last modified.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of documents to return (default: 10, max: 50)",
        },
      },
    },
  },
  {
    name: "search_docs",
    description:
      "Search for Google Docs documents by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query to find documents by name",
        },
        limit: {
          type: "number",
          description: "Maximum number of documents to return (default: 10, max: 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_doc",
    description:
      "Get the content of a Google Doc as plain text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "The Google Doc document ID",
        },
      },
      required: ["document_id"],
    },
  },
  {
    name: "create_doc",
    description:
      "Create a new Google Doc with optional initial content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Title of the new document",
        },
        content: {
          type: "string",
          description: "Optional initial content for the document",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "append_to_doc",
    description:
      "Append text to the end of an existing Google Doc.",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "The Google Doc document ID",
        },
        text: {
          type: "string",
          description: "Text to append to the document",
        },
      },
      required: ["document_id", "text"],
    },
  },
  {
    name: "replace_in_doc",
    description:
      "Find and replace text in a Google Doc.",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "The Google Doc document ID",
        },
        search_text: {
          type: "string",
          description: "Text to search for",
        },
        replace_text: {
          type: "string",
          description: "Text to replace with",
        },
        match_case: {
          type: "boolean",
          description: "Whether to match case (default: false)",
        },
      },
      required: ["document_id", "search_text", "replace_text"],
    },
  },
];
