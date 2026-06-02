# GTask Daily Notes

> [!WARNING]
> This plugin is entirely vibe-coded and has not been reviewed or vetted by Obsidian. It is not listed in the Community Plugins directory. Use at your own risk, and always back up your vault.

An Obsidian plugin for two-way sync between your daily notes and Google Tasks. Import tasks due today (and overdue tasks) into your daily note automatically, push new tasks from Obsidian to Google Tasks, and keep completion state in sync on both sides.

---

## Features

- **Auto-import on open** — when you open a daily note, tasks due that day are pulled in automatically
- **Overdue task rollover** — incomplete tasks from prior days are forwarded into today's note; the previous instance is marked `- [>]` so it appears only once across your vault
- **Push to Google Tasks** — write a task with a due date in Obsidian and it syncs to Google Tasks
- **Two-way completion sync** — check off a task in Obsidian and it marks complete in Google Tasks, and vice versa
- **Background polling** — configurable interval (default 5 min) keeps both sides in sync without manual action
- **Invisible task IDs** — Google Task IDs are stored as zero-width space links, invisible in Live Preview and Reading view
- **Timed tasks** — add `⏰ HH:MM–HH:MM` to a task in Obsidian; the time is stored in the Google Task's notes field

---

## Task Format

Tasks use the [Tasks plugin](https://obsidian-tasks-group.github.io/obsidian-tasks/) emoji syntax:

```
- [ ] Task title 📅 2026-06-01
- [ ] Timed task ⏰ 09:00–10:00 📅 2026-06-01
- [x] Completed task 📅 2026-06-01
- [>] Rolled-over task 📅 2026-05-30
```

The Google Task ID is embedded invisibly as `[​](gtasks://ID)` — it powers two-way sync but is hidden in Live Preview mode.

> **Tip:** Use **Live Preview** editing mode (`Cmd+E`) to keep your notes clean. Source mode will show the raw ID link.

---

## Overdue Task Rollover

When you open a daily note and an overdue task is imported, the plugin automatically finds the most recent past daily note containing that task as an open `- [ ]` and rewrites it to `- [>]` (forwarded). This means:

- Each task appears as an active checkbox in exactly one daily note at a time
- Past notes show `- [>]` as a historical record that the task was carried forward
- Queries for incomplete tasks (e.g. with the Tasks plugin) won't return duplicates

The `- [>]` marker is a standard Tasks plugin status and renders with a forward arrow in Live Preview.

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
3. In Obsidian → Settings → Community Plugins, enable **GTask Daily Notes**

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

Go to **Settings → GTask Daily Notes**:

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
| `Push new tasks to Google Tasks` | Push unsynced tasks (with a due date) from the note to Google |

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
- **Tasks without a due date** are not pushed to Google Tasks. Only tasks with an explicit `📅 YYYY-MM-DD` date are exported.

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
