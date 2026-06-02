# GTasks Daily Note

An Obsidian plugin for two-way sync between your daily notes and Google Tasks. Import tasks due today (and overdue tasks) into your daily note automatically, push new tasks from Obsidian to Google Tasks, and keep completion state in sync on both sides.

---

## Features

- **Auto-import on open** — when you open a daily note, tasks due that day are pulled in automatically
- **Overdue tasks** — incomplete tasks from prior days are included so nothing slips through
- **Push to Google Tasks** — write a task in Obsidian and it syncs to Google Tasks
- **Two-way completion sync** — check off a task in Obsidian and it marks complete in Google Tasks, and vice versa
- **Background polling** — configurable interval (default 5 min) keeps both sides in sync without manual action
- **Invisible task IDs** — Google Task IDs are stored as zero-width space links, invisible in Live Preview and Reading view
- **Due date display** — imported tasks show their due date as `📅 YYYY-MM-DD`
- **Timed tasks** — add `⏰ HH:MM–HH:MM` to a task in Obsidian; the time is stored in the Google Task's notes field

---

## Task Format

```
- [ ] Task title 📅 2026-06-01
- [ ] Timed task ⏰ 09:00–10:00 📅 2026-06-01
- [x] Completed task 📅 2026-06-01
```

The Google Task ID is embedded invisibly as `[​](gtasks://ID)` — it powers two-way sync but is hidden in Live Preview mode.

> **Tip:** Use **Live Preview** editing mode (`Cmd+E`) to keep your notes clean. Source mode will show the raw ID link.

---

## Installation

This plugin is not yet in the Obsidian community plugin directory. Install it manually:

1. Download or clone this repo into your vault's plugin folder:
   ```
   <your-vault>/.obsidian/plugins/task-manager/
   ```
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. In Obsidian → Settings → Community Plugins, enable **GTasks Daily Note**

---

## Google Cloud Setup

You need a free Google Cloud project to authorize access to your Google Tasks.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project
2. Search for **Google Tasks API** and enable it
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Desktop App**
5. Under **Authorized redirect URIs**, add: `http://localhost:42813`
6. Save and copy your **Client ID** and **Client Secret**

---

## Configuration

Go to **Settings → GTasks Daily Note**:

| Setting | Description | Default |
|---|---|---|
| Client ID | OAuth Client ID from Google Cloud | — |
| Client Secret | OAuth Client Secret from Google Cloud | — |
| Task list | Which Google Task list to sync | My Tasks |
| Daily note folder | Folder where daily notes live | `_dailies` |
| Date format | Filename date format (moment.js) | `YYYY-MM-DD` |
| Section heading | Heading tasks are inserted under | `## Tasks` |
| Sync interval | Background poll frequency in minutes (0 = off) | `5` |

After entering credentials, click **Connect** to authorize. Your browser will open to Google's sign-in page — complete the flow and return to Obsidian.

---

## Commands

| Command | Description |
|---|---|
| `Sync now` | Import + export in one step |
| `Import tasks from Google Tasks` | Pull today's tasks into the daily note |
| `Push new tasks to Google Tasks` | Push unsynced tasks from the note to Google |

Access all commands via `Cmd+P`.

---

## Daily Note Structure

The plugin expects daily notes at:
```
<folder>/<YYYY>/<YYYY-MM-DD>.md
```
or flat:
```
<folder>/<YYYY-MM-DD>.md
```

Both structures are detected automatically.

---

## Limitations

- **Google Tasks has no time field** — the Tasks API only supports a due date, not a start/end time. Times written in Obsidian (`⏰ HH:MM–HH:MM`) are stored in the task's notes field and displayed in Obsidian, but do not appear as timed blocks in Google Calendar.
- Tasks show in Google Calendar as all-day chips on their due date.

---

## Development

```bash
npm install       # install dependencies
npm run dev       # watch mode with hot reload
npm run build     # production build
```

To test changes: disable and re-enable the plugin in Obsidian's Community Plugins settings after each build.

---

## License

MIT
