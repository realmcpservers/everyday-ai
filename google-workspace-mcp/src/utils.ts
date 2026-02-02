/**
 * Utility Functions
 * Common helper functions used across the application
 */

/**
 * Format a date string to locale string
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleString();
}

/**
 * Calculate and format duration between two dates
 */
export function formatDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return "N/A";
  
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}m`;
}

/**
 * Get display name from participant object
 */
export function getParticipantDisplayName(participant: {
  signedinUser?: { displayName?: string };
  anonymousUser?: { displayName?: string };
  phoneUser?: { displayName?: string };
}): string {
  return (
    participant.signedinUser?.displayName ||
    participant.anonymousUser?.displayName ||
    participant.phoneUser?.displayName ||
    "Unknown"
  );
}

/**
 * Extract meeting link from calendar event
 */
export function getMeetingLink(event: {
  hangoutLink?: string | null;
  conferenceData?: {
    entryPoints?: Array<{ uri?: string | null }>;
  };
}): string {
  return (
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.[0]?.uri ||
    "N/A"
  );
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(message: string): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse(text: string): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [{ type: "text" as const, text }],
  };
}

/**
 * Not authenticated error response
 */
export const NOT_AUTHENTICATED_RESPONSE = createErrorResponse(
  "❌ Not authenticated. Please use the 'authenticate' tool first."
);
