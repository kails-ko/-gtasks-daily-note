import { Plugin, TFile, Notice, Menu, moment } from "obsidian";
import { TaskManagerSettings, DEFAULT_SETTINGS, TaskManagerSettingTab } from "./settings";
import { GoogleAuth } from "./auth";
import { GoogleTasksApi } from "./googleTasks";
import { SyncManager } from "./sync";
import { parseLine } from "./taskParser";

export default class TaskManagerPlugin extends Plugin {
  settings: TaskManagerSettings;
  auth: GoogleAuth;
  api: GoogleTasksApi;
  sync: SyncManager;

  private syncIntervalId: number | null = null;
  private statusBarItem: HTMLElement;

  async onload() {
    await this.loadSettings();

    this.auth = new GoogleAuth(this);
    this.api = new GoogleTasksApi(this);
    this.sync = new SyncManager(this);

    this.addSettingTab(new TaskManagerSettingTab(this.app, this));

    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar("idle");

    // Commands
    this.addCommand({
      id: "sync-now",
      name: "Sync now",
      callback: async () => {
        this.updateStatusBar("syncing");
        await this.sync.importFromGoogle();
        await this.sync.exportNewTasks();
        this.updateStatusBar("idle");
      },
    });

    this.addCommand({
      id: "import-from-google",
      name: "Import tasks from Google Tasks",
      callback: async () => {
        this.updateStatusBar("syncing");
        await this.sync.importFromGoogle();
        this.updateStatusBar("idle");
      },
    });

    this.addCommand({
      id: "push-to-google",
      name: "Push new tasks to Google Tasks",
      callback: async () => {
        this.updateStatusBar("syncing");
        await this.sync.exportNewTasks();
        this.updateStatusBar("idle");
      },
    });

    this.addCommand({
      id: "push-current-note-to-google",
      name: "Push tasks from current note to Google Tasks",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice("GTask Daily Notes: No active note.");
          return;
        }
        this.updateStatusBar("syncing");
        await this.sync.exportTasksFromFile(file);
        this.updateStatusBar("idle");
      },
    });

    // Auto-import when any daily note opens
    this.registerEvent(
      this.app.workspace.on("file-open", async (file) => {
        if (!file || !this.settings.accessToken) return;
        const date = this.sync.getDailyNoteDate(file);
        if (!date) return;
        await this.sync.importFromGoogle(date);
        await this.sync.exportNewTasks(date);
      })
    );

    // Checkbox toggle detection via editor-change
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (!(file instanceof TFile)) return;
        if (!this.sync.getDailyNoteDate(file)) return;
        await this.handleCheckboxChanges(file);
      })
    );

    this.restartSyncInterval();
  }

  onunload() {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
    }
    this.auth.closeServer();
  }

  restartSyncInterval() {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    const mins = this.settings.syncIntervalMinutes;
    if (mins > 0 && this.settings.accessToken) {
      this.syncIntervalId = window.setInterval(async () => {
        await this.sync.backgroundSync();
        this.updateStatusBar("idle");
      }, mins * 60 * 1000);
    }
  }

  async selectTaskList(containerEl: HTMLElement): Promise<void> {
    if (!this.settings.accessToken) {
      new Notice("Connect your Google account first.");
      return;
    }
    try {
      const lists = await this.api.listTaskLists();
      // Simple modal-free approach: cycle through lists with a Notice
      // A proper modal picker will be added in Phase 7 polish
      const listStr = lists.map((l, i) => `${i + 1}. ${l.title}`).join("\n");
      new Notice(`Available lists:\n${listStr}\n\nUpdate Task List ID in settings.`, 10000);
    } catch (e) {
      new Notice(`Failed to fetch task lists: ${e}`);
    }
  }

  // Track previous checkbox state to detect toggles
  private prevCheckboxState = new Map<string, boolean>();

  private async handleCheckboxChanges(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const task = parseLine(lines[i], i);
      if (!task || !task.gcalId) continue;

      const key = `${file.path}::${task.gcalId}`;
      const prev = this.prevCheckboxState.get(key);

      if (prev !== undefined && prev !== task.completed) {
        await this.sync.onCheckboxToggle(file, i, task.completed);
      }
      this.prevCheckboxState.set(key, task.completed);
    }
  }

  private updateStatusBar(state: "idle" | "syncing") {
    if (state === "syncing") {
      this.statusBarItem.setText("⟳ Syncing tasks...");
    } else {
      const time = moment().format("HH:mm");
      this.statusBarItem.setText(`✓ Tasks synced ${time}`);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
