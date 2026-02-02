/**
 * Gmail API Service
 * Wraps Gmail REST API calls
 */

import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";

import { config } from "./config.js";
import { logger } from "./logger.js";
import type {
  GoogleAuth,
  GmailMessage,
  GmailThread,
  GmailLabel,
  GmailDraft,
  SendEmailParams,
} from "./types.js";

export class GmailService {
  private gmail: gmail_v1.Gmail;

  constructor(auth: GoogleAuth) {
    this.gmail = google.gmail({ 
      version: "v1", 
      auth: auth as Parameters<typeof google.gmail>[0]["auth"] 
    });
  }

  /**
   * Get user's email address
   */
  async getProfile(): Promise<{ emailAddress: string; messagesTotal: number; threadsTotal: number }> {
    try {
      const response = await this.gmail.users.getProfile({ userId: "me" });
      return {
        emailAddress: response.data.emailAddress || "",
        messagesTotal: response.data.messagesTotal || 0,
        threadsTotal: response.data.threadsTotal || 0,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get Gmail profile: ${message}`);
    }
  }

  /**
   * List messages in inbox
   */
  async listMessages(
    query?: string,
    maxResults: number = config.gmail.maxResults,
    labelIds: string[] = config.gmail.defaultLabels
  ): Promise<GmailMessage[]> {
    try {
      logger.debug(`Listing messages with query: ${query || "none"}`);
      
      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
        labelIds,
      });

      const messages = response.data.messages || [];
      
      // Fetch full message details
      const fullMessages = await Promise.all(
        messages.map(async (msg) => {
          const full = await this.getMessage(msg.id!);
          return full;
        })
      );

      return fullMessages;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list messages: ${message}`);
    }
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(messageId: string): Promise<GmailMessage> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      return response.data as GmailMessage;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get message: ${message}`);
    }
  }

  /**
   * Get a thread by ID
   */
  async getThread(threadId: string): Promise<GmailThread> {
    try {
      const response = await this.gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "full",
      });

      return response.data as GmailThread;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get thread: ${message}`);
    }
  }

  /**
   * List labels
   */
  async listLabels(): Promise<GmailLabel[]> {
    try {
      const response = await this.gmail.users.labels.list({
        userId: "me",
      });

      return (response.data.labels || []) as GmailLabel[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list labels: ${message}`);
    }
  }

  /**
   * Search emails
   */
  async searchEmails(
    query: string,
    maxResults: number = config.gmail.maxResults
  ): Promise<GmailMessage[]> {
    return this.listMessages(query, maxResults, []);
  }

  /**
   * Send an email
   */
  async sendEmail(params: SendEmailParams): Promise<GmailMessage> {
    try {
      const { to, subject, body, cc, bcc } = params;

      // Build email headers
      const headers = [
        `To: ${to}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "MIME-Version: 1.0",
      ];

      if (cc) headers.push(`Cc: ${cc}`);
      if (bcc) headers.push(`Bcc: ${bcc}`);

      // Combine headers and body
      const email = `${headers.join("\r\n")}\r\n\r\n${body}`;

      // Encode to base64url
      const encodedEmail = Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const response = await this.gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedEmail,
        },
      });

      logger.info(`Email sent successfully: ${response.data.id}`);
      return response.data as GmailMessage;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to send email: ${message}`);
    }
  }

  /**
   * Create a draft
   */
  async createDraft(params: SendEmailParams): Promise<GmailDraft> {
    try {
      const { to, subject, body, cc, bcc } = params;

      const headers = [
        `To: ${to}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "MIME-Version: 1.0",
      ];

      if (cc) headers.push(`Cc: ${cc}`);
      if (bcc) headers.push(`Bcc: ${bcc}`);

      const email = `${headers.join("\r\n")}\r\n\r\n${body}`;

      const encodedEmail = Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const response = await this.gmail.users.drafts.create({
        userId: "me",
        requestBody: {
          message: {
            raw: encodedEmail,
          },
        },
      });

      logger.info(`Draft created successfully: ${response.data.id}`);
      return response.data as GmailDraft;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create draft: ${message}`);
    }
  }

  /**
   * List drafts
   */
  async listDrafts(maxResults: number = config.gmail.maxResults): Promise<GmailDraft[]> {
    try {
      const response = await this.gmail.users.drafts.list({
        userId: "me",
        maxResults,
      });

      return (response.data.drafts || []) as GmailDraft[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list drafts: ${message}`);
    }
  }

  /**
   * Trash a message
   */
  async trashMessage(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.trash({
        userId: "me",
        id: messageId,
      });
      logger.info(`Message trashed: ${messageId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to trash message: ${message}`);
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });
      logger.info(`Message marked as read: ${messageId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to mark message as read: ${message}`);
    }
  }

  /**
   * Mark message as unread
   */
  async markAsUnread(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: ["UNREAD"],
        },
      });
      logger.info(`Message marked as unread: ${messageId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to mark message as unread: ${message}`);
    }
  }
}

/**
 * Helper to extract email header value
 */
export function getHeader(message: GmailMessage, headerName: string): string {
  const header = message.payload?.headers?.find(
    (h) => h.name.toLowerCase() === headerName.toLowerCase()
  );
  return header?.value || "";
}

/**
 * Helper to decode base64url encoded body
 */
export function decodeBody(data?: string): string {
  if (!data) return "";
  const decoded = Buffer.from(data, "base64url").toString("utf-8");
  return decoded;
}

/**
 * Helper to get plain text body from message
 */
export function getMessageBody(message: GmailMessage): string {
  // Check for simple body
  if (message.payload?.body?.data) {
    return decodeBody(message.payload.body.data);
  }

  // Check for multipart message
  if (message.payload?.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBody(part.body.data);
      }
    }
    // Fallback to first part with body
    for (const part of message.payload.parts) {
      if (part.body?.data) {
        return decodeBody(part.body.data);
      }
    }
  }

  return "";
}
