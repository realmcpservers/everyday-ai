/**
 * MCP Tool Definitions
 * Defines all available tools with their schemas
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const id = { type: "string", minLength: 1 };
const number = { type: "number" };
const box = { x: number, y: number, width: { type: "number", exclusiveMinimum: 0 }, height: { type: "number", exclusiveMinimum: 0 } };
const style = { type: "object", additionalProperties: false, minProperties: 1, properties: {
  font_family: id, font_size: { type: "number", exclusiveMinimum: 0 }, color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
  bold: { type: "boolean" }, italic: { type: "boolean" }, underline: { type: "boolean" },
  align: { type: "string", enum: ["START", "CENTER", "END", "JUSTIFIED"] },
} };
const operation = (type: string, properties: Record<string, unknown>, required: string[]) => ({
  type: "object", additionalProperties: false, properties: { type: { type: "string", enum: [type] }, ...properties }, required: ["type", ...required],
});
const slideOperations = [
  operation("add_slide", { index: { type: "integer", minimum: 0 } }, []),
  operation("delete_slide", { slide_id: id }, ["slide_id"]),
  operation("duplicate_slide", { slide_id: id }, ["slide_id"]),
  operation("move_slide", { slide_id: id, index: { type: "integer", minimum: 0 } }, ["slide_id", "index"]),
  operation("add_text_box", { slide_id: id, text: id, ...box, style }, ["slide_id", "text", "x", "y", "width", "height"]),
  operation("add_shape", { slide_id: id, shape: { type: "string", enum: ["RECTANGLE", "ROUND_RECTANGLE", "ELLIPSE", "TRIANGLE"] }, ...box, fill_color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }, outline_color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$", description: "Shape outline color as #RRGGBB" } }, ["slide_id", "shape", "x", "y", "width", "height"]),
  operation("replace_text", { element_id: id, text: { type: "string" } }, ["element_id", "text"]),
  operation("style_text", { element_id: id, style }, ["element_id", "style"]),
  { ...operation("style_shape", { element_id: id, fill_color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }, outline_color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$", description: "Shape outline color as #RRGGBB" } }, ["element_id"]), anyOf: [{ required: ["fill_color"] }, { required: ["outline_color"] }] },
  operation("set_background", { slide_id: id, color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } }, ["slide_id", "color"]),
  operation("move_element", { element_id: id, x: number, y: number }, ["element_id", "x", "y"]),
  operation("transform_element", { element_id: id, x: number, y: number, scale_x: { type: "number", exclusiveMinimum: 0 }, scale_y: { type: "number", exclusiveMinimum: 0 } }, ["element_id", "x", "y", "scale_x", "scale_y"]),
  operation("delete_element", { element_id: id }, ["element_id"]),
];

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
      "Authenticate with Google. Use force=true to renew OAuth consent after permission changes.",
    inputSchema: {
      type: "object" as const,
      properties: { force: { type: "boolean", description: "Request new OAuth consent without deleting the existing token first." } },
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
      "Get the content of a Google Doc. Returns text content with tables formatted as markdown tables.",
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

  // =========================================================================
  // Google Slides Tools
  // =========================================================================
  {
    name: "list_presentations",
    description:
      "List recent Google Slides presentations from your Drive, sorted by last modified.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of presentations to return (default: 10, max: 50)",
        },
      },
    },
  },
  {
    name: "search_presentations",
    description:
      "Search for Google Slides presentations by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query to find presentations by name",
        },
        limit: {
          type: "number",
          description: "Maximum number of presentations to return (default: 10, max: 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_presentation",
    description:
      "Get the content of a Google Slides presentation. Returns slide text, speaker notes, and optionally downloads images for visual analysis.",
    inputSchema: {
      type: "object" as const,
      properties: {
        presentation_id: {
          type: "string",
          description: "The Google Slides presentation ID",
        },
        include_images: {
          type: "boolean",
          description: "If true, downloads and includes base64-encoded image data for visual analysis (default: false). Note: This increases response size significantly.",
        },
      },
      required: ["presentation_id"],
    },
  },
  {
    name: "create_presentation",
    description: "Create an empty Google Slides presentation; returns its ID and URL.",
    inputSchema: { type: "object", properties: { title: id }, required: ["title"] },
  },
  {
    name: "inspect_presentation",
    description: "Inspect slide and element IDs, positions, sizes, text, styles and revision before editing. Coordinates are in the units returned by Google; 1 point = 12,700 EMU.",
    inputSchema: { type: "object", properties: { presentation_id: id }, required: ["presentation_id"] },
  },
  {
    name: "edit_presentation",
    description: "Apply Slides edits atomically. Set fill_color and/or outline_color on shapes using #RRGGBB. Coordinates and dimensions are points. Slide index is zero-based; move_slide index is based on the order BEFORE the move. replace_text replaces the entire text of an element and may change its existing formatting. move_element x/y are relative offsets; transform_element replaces the existing transform (including rotation) with absolute translation and scale relative to the element's intrinsic size. add_slide/add_text_box/add_shape return generated IDs; duplicate_slide returns its new ID in replies. For safety confirm before deleting. Use revision_id from inspect_presentation to reject stale edits. New IDs are available after this call, so add content to a new slide in a subsequent call.",
    inputSchema: { type: "object", properties: { presentation_id: id, revision_id: id, operations: { type: "array", minItems: 1, maxItems: 100, items: { oneOf: slideOperations } } }, required: ["presentation_id", "operations"] },
  },
  {
    name: "get_slide_preview",
    description: "Render a slide preview as an image for visual inspection.",
    inputSchema: { type: "object", properties: { presentation_id: id, slide_id: id }, required: ["presentation_id", "slide_id"] },
  },
  {
    name: "add_slide_image",
    description: "Insert a local PNG, JPEG or GIF privately using the configured Apps Script helper. No public sharing. Maximum 3 MiB; x/y/width/height are in points. The absolute path must be accessible on the MCP server host.",
    inputSchema: { type: "object", properties: { presentation_id: id, slide_id: id, file_path: id, ...box }, required: ["presentation_id", "slide_id", "file_path", "x", "y", "width", "height"] },
  },

  // =========================================================================
  // Google Sheets Tools
  // =========================================================================
  {
    name: "list_spreadsheets",
    description:
      "List recent Google Sheets spreadsheets from your Drive, sorted by last modified.",
    inputSchema: {
      type: "object" as const,
      properties: {
        max_results: {
          type: "number",
          description: "Maximum number of spreadsheets to return (default: 10, max: 100)",
        },
      },
    },
  },
  {
    name: "search_spreadsheets",
    description:
      "Search for Google Sheets spreadsheets by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query to find spreadsheets by name",
        },
        max_results: {
          type: "number",
          description: "Maximum number of spreadsheets to return (default: 10, max: 100)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_spreadsheet",
    description:
      "Get metadata about a Google Sheets spreadsheet including its title and list of sheets (tabs).",
    inputSchema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: {
          type: "string",
          description: "The Google Sheets spreadsheet ID",
        },
      },
      required: ["spreadsheet_id"],
    },
  },
  {
    name: "get_sheet_data",
    description:
      "Read cell values from a Google Sheets spreadsheet. Supports A1 notation for ranges.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: {
          type: "string",
          description: "The Google Sheets spreadsheet ID",
        },
        range: {
          type: "string",
          description: "The range to read in A1 notation (e.g., 'Sheet1!A1:D10', 'A1:D10', or 'Sheet1')",
        },
      },
      required: ["spreadsheet_id", "range"],
    },
  },
  {
    name: "update_cells",
    description:
      "Update cell values in a Google Sheets spreadsheet. Values are entered as the user would type them.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: {
          type: "string",
          description: "The Google Sheets spreadsheet ID",
        },
        range: {
          type: "string",
          description: "The range to update in A1 notation (e.g., 'Sheet1!A1:B2')",
        },
        values: {
          type: "array",
          items: {
            type: "array",
            items: { type: "string" },
          },
          description: "2D array of values to write (rows of cells)",
        },
      },
      required: ["spreadsheet_id", "range", "values"],
    },
  },
  {
    name: "append_rows",
    description:
      "Append rows of data to the end of a Google Sheets spreadsheet or sheet.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: {
          type: "string",
          description: "The Google Sheets spreadsheet ID",
        },
        range: {
          type: "string",
          description: "The sheet or range to append to (e.g., 'Sheet1' or 'Sheet1!A:D')",
        },
        values: {
          type: "array",
          items: {
            type: "array",
            items: { type: "string" },
          },
          description: "2D array of rows to append",
        },
      },
      required: ["spreadsheet_id", "range", "values"],
    },
  },
  {
    name: "create_spreadsheet",
    description:
      "Create a new Google Sheets spreadsheet with the specified title.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Title of the new spreadsheet",
        },
      },
      required: ["title"],
    },
  },
];
