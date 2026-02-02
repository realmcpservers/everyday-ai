/**
 * Google Meet API Service
 * Wraps Google Meet REST API calls using direct HTTP requests
 */

import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";

import { config } from "./config.js";
import { logger } from "./logger.js";
import type {
  GoogleAuth,
  MeetingSpace,
  ConferenceRecord,
  Participant,
  Recording,
  Transcript,
  TranscriptEntry,
  MeetingEvent,
  CreateCalendarEventParams,
  CreatedCalendarEvent,
  ListConferenceRecordsResponse,
  ListParticipantsResponse,
  ListRecordingsResponse,
  ListTranscriptsResponse,
  ListTranscriptEntriesResponse,
} from "./types.js";

export class GoogleMeetService {
  private auth: GoogleAuth;
  private calendar: calendar_v3.Calendar;

  constructor(auth: GoogleAuth) {
    this.auth = auth;
    this.calendar = google.calendar({ version: "v3", auth: auth as Parameters<typeof google.calendar>[0]["auth"] });
  }

  /**
   * Get access token for API calls
   */
  private async getAccessToken(): Promise<string> {
    const credentials = await (this.auth as { getAccessToken(): Promise<{ token?: string }> }).getAccessToken();
    const token = credentials.token || (credentials as unknown as string);
    if (!token) {
      throw new Error("Failed to get access token");
    }
    return token;
  }

  /**
   * Make authenticated request to Meet API
   */
  private async meetApiRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${config.meetApiBase}${endpoint}`;

    logger.debug(`Meet API request: ${method} ${endpoint}`);

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Meet API error: ${response.status}`, new Error(errorText));
      throw new Error(`Meet API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * List conference records (past meetings)
   */
  async listConferenceRecords(
    pageSize: number = config.defaults.conferencePageSize
  ): Promise<ConferenceRecord[]> {
    try {
      const data = await this.meetApiRequest<ListConferenceRecordsResponse>(
        `/conferenceRecords?pageSize=${pageSize}`
      );
      return data.conferenceRecords || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list conference records: ${message}`);
    }
  }

  /**
   * Get a specific conference record
   */
  async getConferenceRecord(name: string): Promise<ConferenceRecord> {
    try {
      return await this.meetApiRequest<ConferenceRecord>(`/${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get conference record: ${message}`);
    }
  }

  /**
   * List participants in a conference
   */
  async listParticipants(
    conferenceRecordName: string,
    pageSize: number = config.defaults.participantPageSize
  ): Promise<Participant[]> {
    try {
      const data = await this.meetApiRequest<ListParticipantsResponse>(
        `/${conferenceRecordName}/participants?pageSize=${pageSize}`
      );
      return data.participants || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list participants: ${message}`);
    }
  }

  /**
   * List recordings for a conference
   */
  async listRecordings(conferenceRecordName: string): Promise<Recording[]> {
    try {
      const data = await this.meetApiRequest<ListRecordingsResponse>(
        `/${conferenceRecordName}/recordings`
      );
      return data.recordings || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list recordings: ${message}`);
    }
  }

  /**
   * Get a specific recording
   */
  async getRecording(name: string): Promise<Recording> {
    try {
      return await this.meetApiRequest<Recording>(`/${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get recording: ${message}`);
    }
  }

  /**
   * List transcripts for a conference
   */
  async listTranscripts(conferenceRecordName: string): Promise<Transcript[]> {
    try {
      const data = await this.meetApiRequest<ListTranscriptsResponse>(
        `/${conferenceRecordName}/transcripts`
      );
      return data.transcripts || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list transcripts: ${message}`);
    }
  }

  /**
   * Get transcript entries (actual transcript text)
   */
  async listTranscriptEntries(
    transcriptName: string,
    pageSize: number = config.defaults.transcriptPageSize
  ): Promise<TranscriptEntry[]> {
    try {
      const data = await this.meetApiRequest<ListTranscriptEntriesResponse>(
        `/${transcriptName}/entries?pageSize=${pageSize}`
      );
      return data.transcriptEntries || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list transcript entries: ${message}`);
    }
  }

  /**
   * Create a meeting space
   */
  async createSpace(): Promise<MeetingSpace> {
    try {
      return await this.meetApiRequest<MeetingSpace>("/spaces", "POST", {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create meeting space: ${message}`);
    }
  }

  /**
   * Get a meeting space
   */
  async getSpace(name: string): Promise<MeetingSpace> {
    try {
      return await this.meetApiRequest<MeetingSpace>(`/${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get meeting space: ${message}`);
    }
  }

  /**
   * List upcoming meetings from Google Calendar
   */
  async listUpcomingMeetings(
    maxResults: number = config.defaults.calendarMaxResults
  ): Promise<MeetingEvent[]> {
    try {
      const now = new Date().toISOString();
      const response = await this.calendar.events.list({
        calendarId: "primary",
        timeMin: now,
        maxResults: maxResults * 2, // Fetch more to filter
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];
      // Filter for Google Meet events
      const meetEvents = events.filter(
        (event): event is MeetingEvent =>
          event.conferenceData?.conferenceSolution?.name === "Google Meet" ||
          !!event.hangoutLink
      );
      return meetEvents.slice(0, maxResults);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list upcoming meetings: ${message}`);
    }
  }

  /**
   * List past meetings from Google Calendar (with Meet links)
   */
  async listPastMeetings(
    maxResults: number = config.defaults.calendarMaxResults
  ): Promise<MeetingEvent[]> {
    try {
      const now = new Date();
      const pastDays = config.defaults.pastMeetingsDays;
      const timeMin = new Date(now.getTime() - pastDays * 24 * 60 * 60 * 1000).toISOString();

      const response = await this.calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax: now.toISOString(),
        maxResults: maxResults * 2, // Fetch more to filter
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];
      // Filter for Google Meet events
      const meetEvents = events.filter(
        (event): event is MeetingEvent =>
          event.conferenceData?.conferenceSolution?.name === "Google Meet" ||
          !!event.hangoutLink
      );
      return meetEvents.slice(0, maxResults);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list past meetings: ${message}`);
    }
  }

  /**
   * Parse flexible date/time input into ISO format
   */
  private parseDateTime(input: string, timezone: string): string {
    // If already ISO format, return as is
    if (input.includes("T") || input.includes("Z")) {
      return input;
    }
    
    // Parse formats like "2024-01-30 14:00" or "2024-01-30 2:00 PM"
    const dateMatch = input.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if (dateMatch) {
      const [, datePart, timePart] = dateMatch;
      
      // Parse time part
      let hours = 0;
      let minutes = 0;
      
      const time24Match = timePart.match(/^(\d{1,2}):(\d{2})$/);
      const time12Match = timePart.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
      
      if (time24Match) {
        hours = parseInt(time24Match[1], 10);
        minutes = parseInt(time24Match[2], 10);
      } else if (time12Match) {
        hours = parseInt(time12Match[1], 10);
        minutes = parseInt(time12Match[2], 10);
        const isPM = time12Match[3].toLowerCase() === "pm";
        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;
      } else {
        // Try just hours
        const hourMatch = timePart.match(/^(\d{1,2})\s*(am|pm)?$/i);
        if (hourMatch) {
          hours = parseInt(hourMatch[1], 10);
          if (hourMatch[2]) {
            const isPM = hourMatch[2].toLowerCase() === "pm";
            if (isPM && hours !== 12) hours += 12;
            if (!isPM && hours === 12) hours = 0;
          }
        }
      }
      
      const h = hours.toString().padStart(2, "0");
      const m = minutes.toString().padStart(2, "0");
      return `${datePart}T${h}:${m}:00`;
    }
    
    // Return input if can't parse
    return input;
  }

  /**
   * Create a calendar event with optional Google Meet link
   */
  async createCalendarEvent(params: CreateCalendarEventParams): Promise<CreatedCalendarEvent> {
    try {
      const timezone = params.timezone || "America/Los_Angeles";
      const startDateTime = this.parseDateTime(params.start_time, timezone);
      
      // Calculate end time
      let endDateTime: string;
      if (params.end_time) {
        endDateTime = this.parseDateTime(params.end_time, timezone);
      } else {
        const durationMinutes = params.duration_minutes || 60;
        // Parse the start time components
        const [datePart, timePart] = startDateTime.split("T");
        const [hours, minutes] = timePart.split(":").map(Number);
        
        // Calculate end time
        const totalMinutes = hours * 60 + minutes + durationMinutes;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMins = totalMinutes % 60;
        
        endDateTime = `${datePart}T${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}:00`;
      }

      const eventRequest: calendar_v3.Schema$Event = {
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: {
          dateTime: startDateTime,
          timeZone: timezone,
        },
        end: {
          dateTime: endDateTime,
          timeZone: timezone,
        },
      };

      // Add attendees if provided
      if (params.attendees && params.attendees.length > 0) {
        eventRequest.attendees = params.attendees.map((email) => ({ email }));
      }

      // Add Google Meet conferencing if requested
      if (params.add_meet_link !== false) {
        eventRequest.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        };
      }

      logger.debug("Creating calendar event", { summary: eventRequest.summary });

      const response = await this.calendar.events.insert({
        calendarId: "primary",
        requestBody: eventRequest,
        conferenceDataVersion: params.add_meet_link !== false ? 1 : 0,
        sendUpdates: params.attendees?.length ? "all" : "none",
      });

      const event = response.data;
      
      return {
        id: event.id || "",
        summary: event.summary || params.summary,
        htmlLink: event.htmlLink || "",
        start: {
          dateTime: event.start?.dateTime || undefined,
          date: event.start?.date || undefined,
          timeZone: event.start?.timeZone || timezone,
        },
        end: {
          dateTime: event.end?.dateTime || undefined,
          date: event.end?.date || undefined,
          timeZone: event.end?.timeZone || timezone,
        },
        hangoutLink: event.hangoutLink || undefined,
        attendees: event.attendees?.map((a) => ({
          email: a.email || "",
          responseStatus: a.responseStatus || undefined,
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create calendar event: ${message}`);
    }
  }
}
