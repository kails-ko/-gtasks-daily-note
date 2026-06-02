import { TFile, Notice, moment } from "obsidian";
import type TaskManagerPlugin from "./main";
import { parseLine, parseNote, buildTaskLine, updateLineInContent } from "./taskParser";

export class SyncManager {
  private plugin: TaskManagerPlugin;

  constructor(plugin: TaskManagerPlugin) {
    this.plugin = plugin;
  }

  private todayString(): string {
    return moment().format("YYYY-MM-DD");
  }

  // Returns the date string (YYYY-MM-DD) if the file is a daily note, null otherwise
  getDailyNoteDate(file: TFile): string | null {
    const { dailyNoteFolder, dailyNoteDateFormat } = this.plugin.settings;
    const base = file.basename; // filename without extension
    const m = moment(base, dailyNoteDateFormat, true);
    if (!m.isValid()) return null;
    const dateStr = m.format("YYYY-MM-DD");
    const year = m.format("YYYY");
    const expectedPaths = dailyNoteFolder
      ? [
          `${dailyNoteFolder}/${year}/${base}.md`,
          `${dailyNoteFolder}/${base}.md`,
        ]
      : [`${base}.md`];
    return expectedPaths.includes(file.path) ? dateStr : null;
  }

  private async getDailyNoteForDate(date: string): Promise<TFile | null> {
    const { dailyNoteFolder, dailyNoteDateFormat } = this.plugin.settings;
    const m = moment(date, "YYYY-MM-DD");
    const dateStr = m.format(dailyNoteDateFormat);
    const year = m.format("YYYY");

    const candidates = dailyNoteFolder
      ? [
          `${dailyNoteFolder}/${year}/${dateStr}.md`,
          `${dailyNoteFolder}/${dateStr}.md`,
        ]
      : [`${dateStr}.md`];

    for (const path of candidates) {
      const file = this.plugin.app.vault.getFileByPath(path);
      if (file) return file;
    }
    return null;
  }

  // Find any past daily note that has this gcalId as an open (non-forwarded) task
  // and rewrite it to [>] to mark it as rolled over.
  private async markTaskForwardedInPastNotes(gcalId: string, beforeDate: string): Promise<void> {
    const files = this.plugin.app.vault.getFiles();

    // Collect daily note files dated before today, newest first
    const pastNotes: { date: string; file: TFile }[] = [];
    for (const file of files) {
      const date = this.getDailyNoteDate(file);
      if (date && date < beforeDate) {
        pastNotes.push({ date, file });
      }
    }
    pastNotes.sort((a, b) => b.date.localeCompare(a.date));

    for (const { file } of pastNotes) {
      const content = await this.plugin.app.vault.read(file);
      const tasks = parseNote(content);
      const task = tasks.find(
        (t) => t.gcalId === gcalId && !t.completed && !t.forwarded
      );
      if (!task) continue;

      // Replace - [ ] with - [>], preserving everything else on the line
      const forwardedLine = task.raw.replace(/^(\s*-\s*)\[ \]/, "$1[>]");
      const newContent = updateLineInContent(content, task.lineIndex, forwardedLine);
      await this.plugin.app.vault.modify(file, newContent);
      break; // only the most recent active instance needs marking
    }
  }

  // Pull Google Tasks due on `date` (defaults to today) into the daily note
  async importFromGoogle(date?: string): Promise<void> {
    const targetDate = date ?? this.todayString();
    const file = await this.getDailyNoteForDate(targetDate);
    if (!file) {
      new Notice("GTask Daily Notes: Daily note not found.");
      return;
    }

    const { taskListId } = this.plugin.settings;
    const today = targetDate;
    console.log("[GTask Daily Notes] fetching tasks for:", today, "list:", taskListId);

    let gTasks;
    try {
      gTasks = await this.plugin.api.listTasks(taskListId, today);
      console.log("[GTask Daily Notes] fetched tasks:", JSON.stringify(gTasks));
    } catch (e) {
      console.error("[GTask Daily Notes] fetch error:", e);
      new Notice(`GTask Daily Notes: Failed to fetch tasks — ${e}`);
      return;
    }

    let content = await this.plugin.app.vault.read(file);
    const existingTasks = parseNote(content);
    const existingIds = new Set(
      existingTasks.map((t) => t.gcalId).filter(Boolean)
    );

    const newLines: string[] = [];
    for (const gt of gTasks) {
      if (existingIds.has(gt.id)) continue;

      const timeMatch = gt.notes ? /⏰\s*(\d{2}:\d{2}(?:–\d{2}:\d{2})?)/.exec(gt.notes) : null;
      const time = timeMatch ? timeMatch[1] : null;
      const completed = gt.status === "completed";
      const dueDate = gt.due ? gt.due.slice(0, 10) : null;

      // If this task is overdue, mark its previous daily note instance as forwarded
      if (dueDate && dueDate < targetDate) {
        await this.markTaskForwardedInPastNotes(gt.id, targetDate);
      }

      newLines.push(buildTaskLine(gt.title, completed, time, dueDate, gt.id));
    }

    if (newLines.length === 0) return;

    const { sectionHeading } = this.plugin.settings;
    if (content.includes(sectionHeading)) {
      content = content.replace(
        sectionHeading,
        `${sectionHeading}\n${newLines.join("\n")}`
      );
    } else {
      content += `\n\n${sectionHeading}\n${newLines.join("\n")}`;
    }

    await this.plugin.app.vault.modify(file, content);
    new Notice(`GTask Daily Notes: Imported ${newLines.length} task(s).`);
  }

  // Push new task lines (no gcalId, has due date) to Google Tasks
  async exportNewTasks(date?: string): Promise<void> {
    const targetDate = date ?? this.todayString();
    const file = await this.getDailyNoteForDate(targetDate);
    if (!file) return;

    const { taskListId } = this.plugin.settings;
    const today = targetDate;
    let content = await this.plugin.app.vault.read(file);
    const tasks = parseNote(content);
    let modified = false;

    for (const task of tasks) {
      if (task.gcalId) continue; // already synced
      if (!task.dueDate) continue; // only push tasks with an explicit due date

      try {
        const gt = await this.plugin.api.createTask(
          taskListId,
          task.title,
          today,
          task.time
        );
        const newLine = buildTaskLine(task.title, task.completed, task.time, task.dueDate, gt.id);
        content = updateLineInContent(content, task.lineIndex, newLine);
        modified = true;
      } catch (e) {
        new Notice(`GTask Daily Notes: Failed to push "${task.title}" — ${e}`);
      }
    }

    if (modified) {
      await this.plugin.app.vault.modify(file, content);
    }
  }

  // Called when a checkbox is toggled in the editor
  async onCheckboxToggle(file: TFile, lineIndex: number, completed: boolean): Promise<void> {
    const content = await this.plugin.app.vault.read(file);
    const lines = content.split("\n");
    const task = parseLine(lines[lineIndex], lineIndex);
    if (!task || !task.gcalId || task.forwarded) return;

    const { taskListId } = this.plugin.settings;
    try {
      if (completed) {
        await this.plugin.api.completeTask(taskListId, task.gcalId);
      } else {
        await this.plugin.api.reopenTask(taskListId, task.gcalId);
      }
    } catch (e) {
      new Notice(`GTask Daily Notes: Sync failed — ${e}`);
    }
  }

  // Background poll: check Google Tasks for external completion changes
  async backgroundSync(): Promise<void> {
    const today = this.todayString();
    const file = await this.getDailyNoteForDate(today);
    if (!file) return;

    const { taskListId } = this.plugin.settings;
    let content = await this.plugin.app.vault.read(file);
    const tasks = parseNote(content);
    const syncedTasks = tasks.filter((t) => t.gcalId && !t.forwarded);
    if (syncedTasks.length === 0) return;

    let gTasks: import("./googleTasks").GTask[] = [];
    try {
      gTasks = await this.plugin.api.listTasks(taskListId, today);
    } catch {
      return; // silent fail on background sync
    }

    const gTaskMap = new Map<string, import("./googleTasks").GTask>(
      gTasks.map((g) => [g.id, g])
    );
    let modified = false;

    for (const task of syncedTasks) {
      const gt = gTaskMap.get(task.gcalId!);
      if (!gt) continue;

      const gtCompleted = gt.status === "completed";
      if (gtCompleted !== task.completed) {
        const newLine = buildTaskLine(task.title, gtCompleted, task.time, task.dueDate, task.gcalId);
        content = updateLineInContent(content, task.lineIndex, newLine);
        modified = true;
      }
    }

    if (modified) {
      await this.plugin.app.vault.modify(file, content);
    }
  }
}
