# Everyday AI / Agentic Personal Assistant

MCP (Model Context Protocol) for an AI-powered personal assistant: **Google Service MCP code is in this repo**, plus config for Slack, Jira, and GitHub.

## Overview

This repository contains:
- **google-workspace-mcp/** — subfolder with the Google Service MCP (Gmail, Calendar, Meet, Docs). Build and run from there. See [google-workspace-mcp/README.md](google-workspace-mcp/README.md) for detailed features, tools, and troubleshooting.
- **mcp-servers-config.json** — Cursor MCP config (Google + Slack + Jira + GitHub)

| Service | Description |
|---------|-------------|
| **Google Service** | Gmail, Calendar, Meet, Google Docs integration |
| **Slack** | Slack messaging and channels |
| **Atlassian (Jira)** | Jira issue tracking |
| **GitHub** | GitHub repositories and issues |

---

## Setup

### 1. Google Service MCP

The Google Service MCP lives in the **google-workspace-mcp** subfolder of this repo. No separate clone — it’s part of this repo.

#### Build (from the subfolder)

```bash
cd google-workspace-mcp
npm install
npm run build
```

#### Configure Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable these APIs:
   - [Google Meet API](https://console.cloud.google.com/apis/library/meet.googleapis.com)
   - [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)
   - [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
   - [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
   - [Google Docs API](https://console.cloud.google.com/apis/library/docs.googleapis.com)
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth client ID**
6. Select **Desktop app**
7. Download and save as **`credentials.json`** inside the **google-workspace-mcp** folder (same folder as its `package.json`)

#### Authenticate

From the **google-workspace-mcp** folder:

```bash
cd google-workspace-mcp
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"authenticate","arguments":{}}}' | node dist/index.js
```

A browser window will open for Google sign-in. After authorizing, **`token.json`** is created in **google-workspace-mcp**. Do not commit `credentials.json` or `token.json`.

#### Update Config Path

In **mcp-servers-config.json** (at repo root), point **google-service** at the **google-workspace-mcp** subfolder’s build:

```json
"google-service": {
  "command": "node",
  "args": ["./google-workspace-mcp/dist/index.js"]
}
```

If Cursor’s workspace is this repo, `./google-workspace-mcp/dist/index.js` is enough. Otherwise use the full path, e.g. `/path/to/everyday-ai/google-workspace-mcp/dist/index.js`.

---

### 2. Slack MCP Server

Uses the official Slack MCP Docker image.

#### Prerequisites

- Podman or Docker installed
- Slack Bot Token with appropriate permissions

#### Get Slack Credentials

1.  Create a Slack App:
    -   Visit the [Slack Apps page](https://api.slack.com/apps)
    -   Click "Create New App"
    -   Choose "From scratch"
    -   Name your app and select your workspace
2.  Configure Bot Token Scopes: Navigate to "OAuth & Permissions" and add these scopes:
    -   `channels:history` - View messages and other content in public channels
    -   `channels:read` - View basic channel information
    -   `chat:write` - Send messages as the app
    -   `reactions:write` - Add emoji reactions to messages
    -   `users:read` - View users and their basic information
    -   `users.profile:read` - View detailed profiles about users
3.  Install App to Workspace:
    -   Click "Install to Workspace" and authorize the app
    -   Save the "Bot User OAuth Token" that starts with `xoxb-`
4.  Get your Team ID (starts with a `T`) by following [this guidance](https://slack.com/help/articles/221769328-Locate-your-Slack-URL-or-ID#find-your-workspace-or-org-id)

#### Configure Environment

Set the following in `mcp.json`:

```json
"slack-mcp-server": {
    "command": "podman",
    "args": [
    "run", "-i", "--rm",
    "-e",
    "SLACK_BOT_TOKEN",
    "-e",
    "SLACK_TEAM_ID",
    "-e",
    "SLACK_CHANNEL_IDS",
    "docker.io/mcp/slack"
    ],
    "env": {
    "SLACK_BOT_TOKEN": "<YOUR_SLACK_BOT_TOKEN>",
    "SLACK_TEAM_ID": "<YOUR_SLACK_TEAM_ID>",
    "SLACK_CHANNEL_IDS": "<YOUR_SLACK_CHANNEL_IDS>"
    }
}
```


---

### 3. Atlassian (Jira) MCP

Uses `mcp-atlassian` via uvx.

#### Prerequisites

- Python with `uvx` installed (`pip install uvx`)
- Jira Personal Access Token

#### Get Jira Token

1. Go to your Jira instance (e.g., https://issues.redhat.com)
2. Navigate to **Profile** → **Personal Access Tokens**
3. Create a new token with appropriate permissions

#### Configure

Update `mcp-servers-config.json`:

```json
"mcp-atlassian": {
  "command": "uvx",
  "args": [
    "mcp-atlassian",
    "--jira-url",
    "https://your-jira-instance.com",
    "--jira-personal-token",
    "<YOUR_JIRA_PERSONAL_TOKEN>",
    "--transport",
    "stdio"
  ]
}
```

---

### 4. GitHub MCP

Uses GitHub Copilot's MCP endpoint.

#### Get GitHub Personal Access Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Generate a new token with required scopes (repo, read:org, etc.)

#### Configure

Update `mcp-servers-config.json`:

```json
"github": {
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": {
    "Authorization": "<YOUR_GITHUB_PAT>"
  }
}
```

---

## Usage with Cursor IDE

1. Open Cursor IDE
2. Go to **Settings** → **Features** → **MCP Servers**
3. Add the contents of `mcp-servers-config.json` (with your actual secrets filled in)
4. Restart Cursor

### Example Prompts

Once configured, you can use natural language to interact with these services:

**Google:**
- "Show my upcoming meetings"
- "Send an email to john@example.com about the project update"
- "Create a Google Doc called 'Meeting Notes'"

**Slack:**
- "Send a message to #general channel"
- "Check my Slack DMs"

**Jira:**
- "Show my open Jira issues"
- "Create a new bug ticket"

**GitHub:**
- "List my open pull requests"
- "Show issues in repo X"

---

## Security Notes

- **Never commit secrets** to version control
- Store tokens securely (consider using environment variables or a secrets manager)
- Regularly rotate your tokens
- Use minimal required permissions for each service

---

## File Structure

Google Service MCP is in the **google-workspace-mcp** subfolder. No git clone of a separate repo — everything is here.

```
everyday-ai/                          ← repo root
├── google-workspace-mcp/             ← Google MCP (Meet, Calendar, Gmail, Docs)
│   ├── src/
│   ├── dist/                         # Build output (npm run build from inside this folder)
│   │   └── index.js                  # ← Cursor runs this for google-service
│   ├── package.json
│   ├── credentials.json              # You add this (git-ignored)
│   └── token.json                    # Created after auth (git-ignored)
├── mcp-servers-config.json           # Cursor MCP config
└── README.md
```
