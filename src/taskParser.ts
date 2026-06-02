export interface ParsedTask {
  raw: string;
  completed: boolean;
  forwarded: boolean;  // true if checkbox is [>] (rolled over to next day)
  title: string;
  time: string | null;    // "HH:MM–HH:MM" or null for all-day
  dueDate: string | null; // "YYYY-MM-DD"
  gcalId: string | null;  // Google Tasks ID
  lineIndex: number;
}

const TIME_RE = /⏰\s*(\d{2}:\d{2}(?:–\d{2}:\d{2})?)/;
// Matches 📅 YYYY-MM-DD (Tasks plugin format) and legacy [due:: YYYY-MM-DD] (Dataview)
const DATE_RE = /(?:📅\s*(\d{4}-\d{2}-\d{2})|\[due::\s*(\d{4}-\d{2}-\d{2})\])/;

// Zero-width space link: [​](gtasks://ID)  ← the space inside [] is U+200B
const GCAL_RE = /(?:\[​\]\(gtasks:\/\/([^)]+)\)|<!--\s*gcal::([^\s]+)\s*-->|\[gcal::([^\]]+)\])/;

// Matches [ ], [x], [X], and [>] (forwarded)
const TASK_RE = /^(\s*)-\s*\[([ xX>])\]\s+(.+)$/;

export function parseLine(line: string, lineIndex: number): ParsedTask | null {
  const taskMatch = TASK_RE.exec(line);
  if (!taskMatch) return null;

  const marker = taskMatch[2];
  const completed = marker.toLowerCase() === "x";
  const forwarded = marker === ">";
  const body = taskMatch[3];

  const timeMatch = TIME_RE.exec(body);
  const dateMatch = DATE_RE.exec(body);
  const gcalMatch = GCAL_RE.exec(body);

  const time = timeMatch ? timeMatch[1] : null;
  const dueDate = dateMatch ? (dateMatch[1] ?? dateMatch[2]) : null;
  const gcalId = gcalMatch ? (gcalMatch[1] ?? gcalMatch[2] ?? gcalMatch[3]) : null;

  // Strip all metadata markers from display title
  const title = body
    .replace(GCAL_RE, "")
    .replace(TIME_RE, "")
    .replace(DATE_RE, "")
    .replace(/[⏰📅]/g, "")
    .trim();

  return { raw: line, completed, forwarded, title, time, dueDate, gcalId, lineIndex };
}

export function parseNote(content: string): ParsedTask[] {
  return content
    .split("\n")
    .map((line, i) => parseLine(line, i))
    .filter((t): t is ParsedTask => t !== null);
}

export function buildTaskLine(
  title: string,
  completed: boolean,
  time: string | null,
  dueDate: string | null,
  gcalId: string | null
): string {
  const check = completed ? "x" : " ";
  const timePart = time ? ` ⏰ ${time}` : "";
  const datePart = dueDate ? ` 📅 ${dueDate}` : "";
  // Zero-width space (U+200B) inside brackets makes the link invisible in Live Preview
  const idPart = gcalId ? ` [​](gtasks://${gcalId})` : "";
  return `- [${check}] ${title}${timePart}${datePart}${idPart}`;
}

export function updateLineInContent(
  content: string,
  lineIndex: number,
  newLine: string
): string {
  const lines = content.split("\n");
  lines[lineIndex] = newLine;
  return lines.join("\n");
}
