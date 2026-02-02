/**
 * Zod Validation Schemas
 * Runtime validation for tool inputs
 */

import { z } from "zod";

/**
 * Schema for list_conferences tool
 */
export const ListConferencesSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(10),
});

/**
 * Schema for get_conference tool
 */
export const GetConferenceSchema = z.object({
  name: z.string().min(1, "Conference name is required"),
});

/**
 * Schema for tools requiring conference_name
 */
export const ConferenceNameSchema = z.object({
  conference_name: z.string().min(1, "Conference name is required"),
});

/**
 * Schema for tools requiring transcript_name
 */
export const TranscriptNameSchema = z.object({
  transcript_name: z.string().min(1, "Transcript name is required"),
});

/**
 * Schema for list_upcoming_meetings and list_past_meetings
 */
export const ListMeetingsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(10),
});

/**
 * Empty schema for tools with no inputs
 */
export const EmptySchema = z.object({});

// ============================================================================
// Gmail Schemas
// ============================================================================

/**
 * Schema for list_emails tool
 */
export const ListEmailsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
});

/**
 * Schema for search_emails tool
 */
export const SearchEmailsSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

/**
 * Schema for get_email tool
 */
export const GetEmailSchema = z.object({
  message_id: z.string().min(1, "Message ID is required"),
});

/**
 * Schema for get_thread tool
 */
export const GetThreadSchema = z.object({
  thread_id: z.string().min(1, "Thread ID is required"),
});

/**
 * Schema for send_email tool
 */
export const SendEmailSchema = z.object({
  to: z.string().email("Valid email address required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body is required"),
  cc: z.string().optional(),
  bcc: z.string().optional(),
});

/**
 * Schema for create_draft tool
 */
export const CreateDraftSchema = SendEmailSchema;

/**
 * Schema for trash_email tool
 */
export const TrashEmailSchema = z.object({
  message_id: z.string().min(1, "Message ID is required"),
});

/**
 * Schema for mark_read/unread tools
 */
export const MarkEmailSchema = z.object({
  message_id: z.string().min(1, "Message ID is required"),
});

// ============================================================================
// Google Docs Schemas
// ============================================================================

/**
 * Schema for list_docs tool
 */
export const ListDocsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
});

/**
 * Schema for search_docs tool
 */
export const SearchDocsSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

/**
 * Schema for get_doc tool
 */
export const GetDocSchema = z.object({
  document_id: z.string().min(1, "Document ID is required"),
});

/**
 * Schema for create_doc tool
 */
export const CreateDocSchema = z.object({
  title: z.string().min(1, "Document title is required"),
  content: z.string().optional(),
});

/**
 * Schema for append_to_doc tool
 */
export const AppendToDocSchema = z.object({
  document_id: z.string().min(1, "Document ID is required"),
  text: z.string().min(1, "Text to append is required"),
});

/**
 * Schema for replace_in_doc tool
 */
export const ReplaceInDocSchema = z.object({
  document_id: z.string().min(1, "Document ID is required"),
  search_text: z.string().min(1, "Search text is required"),
  replace_text: z.string(),
  match_case: z.boolean().optional().default(false),
});

// ============================================================================
// Google Calendar Schemas
// ============================================================================

/**
 * Schema for create_calendar_event tool
 */
export const CreateCalendarEventSchema = z.object({
  summary: z.string().min(1, "Event title is required"),
  description: z.string().optional(),
  start_time: z.string().min(1, "Start time is required (e.g., '2024-01-30 14:00' or ISO format)"),
  end_time: z.string().optional(),
  duration_minutes: z.number().int().min(5).max(480).optional().default(60),
  attendees: z.array(z.string().email()).optional(),
  location: z.string().optional(),
  timezone: z.string().optional().default("Asia/Kolkata"),
  add_meet_link: z.boolean().optional().default(true),
});

/**
 * Validate and parse input with a schema
 * Returns the validated data or throws a formatted error
 */
export function validateInput<T extends z.ZodType>(
  schema: T,
  input: unknown
): z.infer<T> {
  const result = schema.safeParse(input);
  
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    throw new Error(`Invalid input: ${errors}`);
  }
  
  return result.data;
}
