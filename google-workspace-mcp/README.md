# Google Service MCP Server

A Model Context Protocol (MCP) server for Google Workspace integration. Access Google Meet, Calendar, Gmail, and Docs through AI assistants.

> **Note:** This folder is part of the **everyday-ai** repo. For full setup (Cursor config for Slack, Jira, GitHub, and repo layout), see the [repo root README](../README.md).

## ✨ Features

### Google Meet & Calendar
| Feature | Description |
|---------|-------------|
| 📅 **Calendar Integration** | List upcoming and past meetings |
| ➕ **Create Calendar Events** | Schedule meetings with attendees & Meet links |
| 📋 **Conference Records** | View past Google Meet sessions |
| 👥 **Participants** | See who attended each meeting |
| 🎥 **Recordings** | Access meeting recordings from Drive |
| 📝 **Transcripts** | Get meeting transcripts with speaker attribution |
| 🔗 **Create Meetings** | Generate new Google Meet links |

### Gmail
| Feature | Description |
|---------|-------------|
| 📧 **List Emails** | View inbox messages |
| 🔍 **Search Emails** | Search with Gmail query syntax |
| 📖 **Read Emails** | Get full email content |
| 💬 **Email Threads** | View conversation threads |
| ✉️ **Send Emails** | Compose and send new emails |
| 📝 **Drafts** | Create email drafts |
| 🗑️ **Trash** | Move emails to trash |
| ✅ **Mark Read/Unread** | Manage email status |

### Google Docs
| Feature | Description |
|---------|-------------|
| 📄 **List Documents** | View recent Google Docs |
| 🔍 **Search Documents** | Find documents by name |
| 📖 **Read Documents** | Get document content as text |
| ✏️ **Create Documents** | Create new Google Docs |
| ➕ **Append Text** | Add content to existing docs |
| 🔄 **Find & Replace** | Replace text in documents |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Google Cloud Project with APIs enabled
- OAuth 2.0 credentials

### 1. Install

From the **everyday-ai** repo root, go into this folder and install:

```bash
cd google-workspace-mcp
npm install
```

(If you're already inside `google-workspace-mcp`, run `npm install` from here.)

### 2. Setup Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable these APIs:
   - [Google Meet API](https://console.cloud.google.com/apis/library/meet.googleapis.com)
   - [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)
   - [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
   - [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
   - [Google Docs API](https://console.cloud.google.com/apis/library/docs.googleapis.com)
   - [Google Slides API](https://console.cloud.google.com/apis/library/slides.googleapis.com)
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth client ID**
6. Select **Desktop app**
7. Download and save as `credentials.json` in **this folder** (the `google-workspace-mcp` directory, same folder as `package.json`)

The file should look like this:

```json
{
  "installed": {
    "client_id": "123456789-xxxxxxxxx.apps.googleusercontent.com",
    "project_id": "your-project-id",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "GOCSPX-xxxxxxxxxxxxxxxxxx",
    "redirect_uris": ["http://localhost"]
  }
}
```

### 3. Build

```bash
npm run build
```

### 4. Authenticate

Run the server once to authenticate:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"authenticate","arguments":{}}}' | node dist/index.js
```

A browser window will open for Google sign-in. After authorizing, a `token.json` file will be auto-created:

```json
{
  "type": "authorized_user",
  "client_id": "123456789-xxxxxxxxx.apps.googleusercontent.com",
  "client_secret": "GOCSPX-xxxxxxxxxxxxxxxxxx",
  "refresh_token": "1//0gxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

> ⚠️ **Note**: `token.json` contains your personal authorization. Never share or commit it!

### Google Slides creation and editing

The Slides tools can create presentations, inspect elements and revisions, add, duplicate, delete or reorder slides, add shapes and text, change text styling or slide backgrounds, move elements, and render slide previews. `edit_presentation` applies a batch atomically. Inspect first and pass its `revisionId` as `revision_id` to prevent overwriting concurrent edits. Slide positions use zero-based indices; the move index refers to the order before the move. Coordinates for edits are in points. Newly created IDs are returned in `createdIds`; duplicated IDs are returned in the API replies. Add content to newly created slides in a subsequent call.

For card borders, set `outline_color` (a `#RRGGBB` color) on `add_shape` or `style_shape`. For example, `{"type":"style_shape","element_id":"card-id","outline_color":"#D9D9D9"}` changes the outline without replacing the fill. Both `fill_color` and `outline_color` may be supplied together.

Existing OAuth users must call `authenticate` with `{"force": true}` and complete consent for the new Slides write scope; the existing token is kept until the new consent succeeds. Restart the server after changing environment configuration. Service accounts can use the Slides editing tools for presentations shared with them, but Google does not support service accounts for Apps Script API execution.

#### Private local images (one-time setup)

`add_slide_image` reads a local PNG, JPEG, or GIF (maximum 3 MiB) on the MCP server host and sends its bytes to a private Apps Script API executable. It does not create a Drive image or change sharing permissions. The resulting image is visible to anyone who can view the presentation. To configure it:

1. Enable the [Apps Script API](https://console.cloud.google.com/apis/library/script.googleapis.com) in the **same standard Google Cloud project** used by the MCP server's OAuth client. Enable the Slides API too.
2. Create a standalone project at [script.google.com](https://script.google.com/). Copy `apps-script/PrivateSlideImages.gs` into its editor. In Project Settings enable showing the manifest, then replace `appsscript.json` with `apps-script/appsscript.json` from this repository. Use the same standard Cloud project as your OAuth client (Project Settings → Google Cloud Platform project).
3. Deploy as an **API executable**, restricted to yourself. Copy the deployment ID, not the project ID. See Google's [execution setup](https://developers.google.com/apps-script/api/how-tos/execute). Workspace policy may require administrator approval.
4. Set `GOOGLE_SLIDES_IMAGE_SCRIPT_DEPLOYMENT_ID` in the MCP server environment to that deployment ID, and restart the server. Reauthorize with `authenticate` and `{"force":true}` if you haven't granted Slides write access yet.

The script and OAuth client must share the Cloud project; API execution uses the OAuth user's permissions and is unavailable for service accounts. A failed or missing helper returns an error; there is no public-image fallback. Preview images from Google are temporary access-bearing URLs and are returned as image data, not exposed as links.

---

## 🔧 Usage

### Option A: With Cursor IDE

The **everyday-ai** repo has a full Cursor config at the repo root: **mcp-servers-config.json** (Google + Slack + Jira + GitHub). Use that file in **Settings** → **Features** → **MCP Servers**. The `google-service` entry should point at **this folder’s** built server:

```json
{
  "google-service": {
    "command": "node",
    "args": [
      "/path/to/everyday-ai/google-workspace-mcp/dist/index.js"
    ]
  }
}
```

If Cursor’s workspace is the everyday-ai repo, you can use `./google-workspace-mcp/dist/index.js`. See the [repo root README](../README.md) for full setup.

Restart Cursor, then use natural language prompts (see Quick Prompts below).

---

## 💬 Quick Prompts (Copy & Paste)

Use these prompts directly in Cursor chat:

### Calendar & Meetings
```
Show my upcoming meetings
```
```
What meetings do I have this week?
```
```
Create a meeting with john@example.com tomorrow at 3 PM for 30 minutes titled "Quick Sync"
```
```
Schedule a team standup for Monday 10 AM with alice@example.com and bob@example.com
```
```
List my past meetings from last week
```

### Gmail
```
Show my recent emails
```
```
Check for unread emails from my boss
```
```
Search emails about "project deadline"
```
```
Read the email with subject "Invoice"
```
```
Send an email to john@example.com saying "Meeting confirmed for tomorrow"
```
```
Draft an email to the team about the weekly update
```

### Google Docs
```
List my recent documents
```
```
Find documents named "meeting notes"
```
```
Create a new document called "Project Ideas"
```
```
Read the document "Weekly Report"
```
```
Add "Action Items:\n- Review PR\n- Update docs" to my project document
```

### Combo Tasks
```
Create a meeting for tomorrow 2 PM with john@example.com, create a doc called "Meeting Agenda", and share the doc link in the meeting invite
```
```
Send an email to the team reminding them about the meeting tomorrow
```
```
Check my calendar for next week and summarize it
```

---

### Option B: Direct Command Line

Test the MCP server directly by sending JSON-RPC messages:

#### Check Authentication
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"auth_status","arguments":{}}}' | node dist/index.js
```

#### List Upcoming Meetings
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_upcoming_meetings","arguments":{}}}' | node dist/index.js
```

#### List Past Conferences
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_conferences","arguments":{"limit":5}}}' | node dist/index.js
```

#### Create a New Meeting
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_meeting","arguments":{}}}' | node dist/index.js
```

#### List All Available Tools
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

### Shell Aliases (Add to ~/.zshrc or ~/.bashrc)

```bash
# Google Service MCP shortcuts
export GMCP="/path/to/google-workspace-mcp"

# Quick commands
alias gmcp="cd $GMCP && node dist/index.js"
alias gmcp-auth='echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"authenticate\",\"arguments\":{}}}" | gmcp'
alias gmcp-status='echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"auth_status\",\"arguments\":{}}}" | gmcp'
alias gmcp-meetings='echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"list_upcoming_meetings\",\"arguments\":{}}}" | gmcp'
alias gmcp-emails='echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"list_emails\",\"arguments\":{\"limit\":5}}}" | gmcp'
alias gmcp-docs='echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"list_docs\",\"arguments\":{\"limit\":5}}}" | gmcp'
alias gmcp-tools='echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}" | gmcp'
```

After adding, run `source ~/.zshrc` then use:
```bash
gmcp-meetings    # List upcoming meetings
gmcp-emails      # List recent emails
gmcp-docs        # List recent documents
gmcp-status      # Check auth status
```

---

## 📚 Available Tools

### Authentication
| Tool | Description | Required Args |
|------|-------------|---------------|
| `auth_status` | Check authentication status | - |
| `authenticate` | Sign in with Google OAuth | - |

### Google Meet & Calendar
| Tool | Description | Required Args |
|------|-------------|---------------|
| `list_upcoming_meetings` | List upcoming calendar meetings | `limit?` |
| `list_past_meetings` | List past 30 days of meetings | `limit?` |
| `create_calendar_event` | Create calendar event with Meet link | `summary`, `start_time`, `attendees?`, `duration_minutes?`, `timezone?` |
| `list_conferences` | List Google Meet conference records | `limit?` |
| `get_conference` | Get specific conference details | `name` |
| `list_participants` | List meeting participants | `conference_name` |
| `list_recordings` | List meeting recordings | `conference_name` |
| `list_transcripts` | List meeting transcripts | `conference_name` |
| `get_transcript_text` | Get transcript with speaker attribution | `transcript_name` |
| `create_meeting` | Create new Google Meet link (no calendar event) | - |
| `summarize_transcript` | Format transcript for AI summary | `transcript_name` |

### Gmail
| Tool | Description | Required Args |
|------|-------------|---------------|
| `gmail_profile` | Get Gmail profile info | - |
| `list_emails` | List inbox emails | `limit?` |
| `search_emails` | Search emails with Gmail syntax | `query`, `limit?` |
| `get_email` | Get full email content | `message_id` |
| `get_thread` | Get email thread/conversation | `thread_id` |
| `send_email` | Send a new email | `to`, `subject`, `body`, `cc?`, `bcc?` |
| `create_draft` | Create email draft | `to`, `subject`, `body`, `cc?`, `bcc?` |
| `list_labels` | List Gmail labels/folders | - |
| `trash_email` | Move email to trash | `message_id` |
| `mark_as_read` | Mark email as read | `message_id` |
| `mark_as_unread` | Mark email as unread | `message_id` |

### Google Docs
| Tool | Description | Required Args |
|------|-------------|---------------|
| `list_docs` | List recent Google Docs | `limit?` |
| `search_docs` | Search documents by name | `query`, `limit?` |
| `get_doc` | Get document content as text | `document_id` |
| `create_doc` | Create new Google Doc | `title`, `content?` |
| `append_to_doc` | Append text to document | `document_id`, `text` |
| `replace_in_doc` | Find and replace text | `document_id`, `search_text`, `replace_text`, `match_case?` |

### Example: Create Calendar Event

```bash
# Create a meeting for tomorrow at 2 PM IST with attendees
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_calendar_event","arguments":{"summary":"Team Sync","start_time":"2026-01-30T14:00:00","duration_minutes":60,"attendees":["user@example.com"],"add_meet_link":true}}}' | node dist/index.js
```

> **Note:** Default timezone is `Asia/Kolkata` (IST). Use `timezone` parameter to override.

### Example: Get Transcript

```bash
# First, list conferences to get the name
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_conferences","arguments":{"limit":1}}}' | node dist/index.js

# Then list transcripts for that conference
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_transcripts","arguments":{"conference_name":"conferenceRecords/abc123"}}}' | node dist/index.js

# Finally, get the transcript text
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_transcript_text","arguments":{"transcript_name":"conferenceRecords/abc123/transcripts/xyz789"}}}' | node dist/index.js
```

### Example: Gmail Operations

```bash
# Get Gmail profile
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"gmail_profile","arguments":{}}}' | node dist/index.js

# List recent emails
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_emails","arguments":{"limit":5}}}' | node dist/index.js

# Search for unread emails from a specific sender
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_emails","arguments":{"query":"from:boss@company.com is:unread"}}}' | node dist/index.js

# Read a specific email
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_email","arguments":{"message_id":"abc123"}}}' | node dist/index.js

# Send an email
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"send_email","arguments":{"to":"recipient@example.com","subject":"Hello","body":"This is a test email."}}}' | node dist/index.js

# Create a draft
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_draft","arguments":{"to":"recipient@example.com","subject":"Draft","body":"This is a draft."}}}' | node dist/index.js
```

### Gmail Search Syntax

| Query | Description |
|-------|-------------|
| `from:user@example.com` | Emails from specific sender |
| `to:user@example.com` | Emails to specific recipient |
| `subject:meeting` | Emails with "meeting" in subject |
| `is:unread` | Unread emails |
| `is:starred` | Starred emails |
| `has:attachment` | Emails with attachments |
| `after:2024/01/01` | Emails after date |
| `before:2024/12/31` | Emails before date |
| `label:important` | Emails with specific label |

### Example: Google Docs Operations

```bash
# List recent documents
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_docs","arguments":{"limit":5}}}' | node dist/index.js

# Search for documents
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"meeting notes"}}}' | node dist/index.js

# Create a new document
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_doc","arguments":{"title":"Project Plan","content":"Initial project outline..."}}}' | node dist/index.js

# Read a document
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_doc","arguments":{"document_id":"1234abcd..."}}}' | node dist/index.js

# Append to a document
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"append_to_doc","arguments":{"document_id":"1234abcd...","text":"\\n\\nNew section added."}}}' | node dist/index.js
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_CREDENTIALS_PATH` | Path to credentials.json | `./credentials.json` |
| `GOOGLE_TOKEN_PATH` | Path to token.json | `./token.json` |
| `OAUTH_PORT` | OAuth callback port | `3000` |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARN, ERROR) | `INFO` |

### Example with Custom Config

```bash
GOOGLE_CREDENTIALS_PATH=/custom/path/credentials.json \
OAUTH_PORT=8080 \
LOG_LEVEL=DEBUG \
node dist/index.js
```

---

## 📁 Project Structure

```
google-workspace-mcp/
├── src/
│   ├── index.ts          # Server entry point
│   ├── config.ts         # Configuration management
│   ├── logger.ts         # Logging utility
│   ├── types.ts          # TypeScript definitions
│   ├── schemas.ts        # Zod validation schemas
│   ├── utils.ts          # Helper functions
│   ├── auth.ts           # Google authentication
│   ├── meet-api.ts       # Google Meet & Calendar API
│   ├── gmail-api.ts      # Gmail API wrapper
│   ├── docs-api.ts       # Google Docs API wrapper
│   └── tools/
│       ├── index.ts      # Tool exports
│       ├── definitions.ts # MCP tool definitions
│       └── handlers.ts   # Tool implementations
├── dist/                 # Compiled JavaScript
├── credentials.json      # Google OAuth credentials (git-ignored)
├── token.json           # Stored OAuth token (git-ignored)
├── package.json
└── tsconfig.json
```

---

## ❗ Troubleshooting

### "Not authenticated" error
```bash
# Run authentication first
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"authenticate","arguments":{}}}' | node dist/index.js
```

### "credentials.json not found"
Download OAuth credentials from Google Cloud Console and save as `credentials.json` in **this folder** (`google-workspace-mcp`), next to `package.json`.

### "No conference records found"
Conference records are only available for meetings where:
- Recording or transcription was **enabled** during the meeting
- You have a **Google Workspace** account (not personal Gmail)
- Records haven't expired (limited retention period)

### OAuth consent screen issues
1. Go to Google Cloud Console → APIs & Services → OAuth consent screen
2. Add your email as a test user (if app is in testing mode)
3. Ensure all required scopes are added

### Port already in use
```bash
# Use a different OAuth port
OAUTH_PORT=8080 node dist/index.js
```

---

## 🔐 OAuth Scopes

This server requests the following permissions:

### Google Meet & Calendar
| Scope | Purpose |
|-------|---------|
| `meetings.space.readonly` | Read meeting spaces |
| `meetings.space.created` | Create meeting spaces |
| `calendar.readonly` | Read calendar events |
| `calendar.events` | Create/modify calendar events |
| `drive.readonly` | Access recordings in Drive |

### Gmail
| Scope | Purpose |
|-------|---------|
| `gmail.readonly` | Read emails and labels |
| `gmail.send` | Send emails |
| `gmail.compose` | Create drafts |
| `gmail.modify` | Modify labels, mark read/unread, trash |

### Google Docs
| Scope | Purpose |
|-------|---------|
| `documents` | Create and edit documents |
| `documents.readonly` | Read documents |

> ⚠️ **Note**: If you previously authenticated with fewer scopes, delete `token.json` and re-authenticate to grant all permissions.

---

## 📄 License

MIT

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run build` to verify
5. Submit a pull request
