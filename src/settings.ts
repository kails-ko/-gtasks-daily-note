import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type TaskManagerPlugin from "./main";

export interface TaskManagerSettings {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
  taskListId: string;
  taskListName: string;
  dailyNoteFolder: string;
  dailyNoteDateFormat: string;
  sectionHeading: string;
  syncIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: TaskManagerSettings = {
  clientId: "",
  clientSecret: "",
  accessToken: "",
  refreshToken: "",
  tokenExpiry: 0,
  taskListId: "@default",
  taskListName: "My Tasks",
  dailyNoteFolder: "_dailies",
  dailyNoteDateFormat: "YYYY-MM-DD",
  sectionHeading: "## Tasks",
  syncIntervalMinutes: 5,
};

export class TaskManagerSettingTab extends PluginSettingTab {
  plugin: TaskManagerPlugin;

  constructor(app: App, plugin: TaskManagerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "GTasks Daily Note" });

    // --- Google OAuth ---
    containerEl.createEl("h3", { text: "Google Account" });

    new Setting(containerEl)
      .setName("Client ID")
      .setDesc("OAuth 2.0 Client ID from Google Cloud Console.")
      .addText((text) =>
        text
          .setPlaceholder("your-client-id.apps.googleusercontent.com")
          .setValue(this.plugin.settings.clientId)
          .onChange(async (value) => {
            this.plugin.settings.clientId = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Client Secret")
      .setDesc("OAuth 2.0 Client Secret from Google Cloud Console.")
      .addText((text) => {
        text
          .setPlaceholder("GOCSPX-...")
          .setValue(this.plugin.settings.clientSecret)
          .onChange(async (value) => {
            this.plugin.settings.clientSecret = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    const authStatus = containerEl.createEl("p", {
      text: this.plugin.settings.accessToken
        ? "Status: Connected"
        : "Status: Not connected",
      cls: this.plugin.settings.accessToken
        ? "task-manager-status-ok"
        : "task-manager-status-err",
    });

    new Setting(containerEl)
      .setName("Connect Google Account")
      .setDesc("Opens a browser tab to authorize access to Google Tasks.")
      .addButton((btn) =>
        btn
          .setButtonText(
            this.plugin.settings.accessToken ? "Reconnect" : "Connect"
          )
          .setCta()
          .onClick(async () => {
            if (!this.plugin.settings.clientId || !this.plugin.settings.clientSecret) {
              new Notice("Enter your Client ID and Client Secret first.");
              return;
            }
            await this.plugin.auth.startOAuthFlow();
            authStatus.textContent = this.plugin.settings.accessToken
              ? "Status: Connected"
              : "Status: Not connected";
            authStatus.className = this.plugin.settings.accessToken
              ? "task-manager-status-ok"
              : "task-manager-status-err";
          })
      );

    new Setting(containerEl)
      .setName("Disconnect")
      .setDesc("Clear stored tokens.")
      .addButton((btn) =>
        btn.setButtonText("Disconnect").onClick(async () => {
          this.plugin.settings.accessToken = "";
          this.plugin.settings.refreshToken = "";
          this.plugin.settings.tokenExpiry = 0;
          await this.plugin.saveSettings();
          authStatus.textContent = "Status: Not connected";
          authStatus.className = "task-manager-status-err";
          new Notice("Disconnected from Google.");
        })
      );

    // --- Task List ---
    containerEl.createEl("h3", { text: "Google Tasks" });

    new Setting(containerEl)
      .setName("Task list")
      .setDesc("Which Google Task list to sync with.")
      .addText((text) =>
        text
          .setPlaceholder("My Tasks")
          .setValue(this.plugin.settings.taskListName)
          .setDisabled(true)
      )
      .addButton((btn) =>
        btn.setButtonText("Select list").onClick(async () => {
          await this.plugin.selectTaskList(containerEl);
          this.display();
        })
      );

    // --- Daily Notes ---
    containerEl.createEl("h3", { text: "Daily Notes" });

    new Setting(containerEl)
      .setName("Daily note folder")
      .setDesc("Folder where your daily notes live (relative to vault root).")
      .addText((text) =>
        text
          .setPlaceholder("_dailies")
          .setValue(this.plugin.settings.dailyNoteFolder)
          .onChange(async (value) => {
            this.plugin.settings.dailyNoteFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Date format")
      .setDesc("Date format used in daily note filenames (moment.js format).")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.plugin.settings.dailyNoteDateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dailyNoteDateFormat = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Section heading")
      .setDesc("Heading under which tasks are inserted in your daily note.")
      .addText((text) =>
        text
          .setPlaceholder("## Tasks")
          .setValue(this.plugin.settings.sectionHeading)
          .onChange(async (value) => {
            this.plugin.settings.sectionHeading = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // --- Sync ---
    containerEl.createEl("h3", { text: "Sync" });

    new Setting(containerEl)
      .setName("Background sync interval (minutes)")
      .setDesc("How often to poll Google Tasks. Set to 0 to disable.")
      .addSlider((slider) =>
        slider
          .setLimits(0, 60, 1)
          .setValue(this.plugin.settings.syncIntervalMinutes)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.syncIntervalMinutes = value;
            await this.plugin.saveSettings();
            this.plugin.restartSyncInterval();
          })
      );
  }
}
