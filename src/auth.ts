import { Notice } from "obsidian";
import * as http from "http";
import * as url from "url";
import type TaskManagerPlugin from "./main";

const SCOPES = "https://www.googleapis.com/auth/tasks";
const REDIRECT_PORT = 42813;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

export class GoogleAuth {
  private plugin: TaskManagerPlugin;
  private server: http.Server | null = null;

  constructor(plugin: TaskManagerPlugin) {
    this.plugin = plugin;
  }

  closeServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  async startOAuthFlow(): Promise<void> {
    this.closeServer(); // kill any leftover server from a previous attempt
    const { clientId } = this.plugin.settings;

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&access_type=offline` +
      `&prompt=consent`;

    // Open in system browser (not Electron's internal browser)
    const { shell } = require("electron");
    shell.openExternal(authUrl);
    new Notice("Browser opened. Complete sign-in then return here.", 8000);

    try {
      const code = await this.waitForCode();
      await this.exchangeCode(code);
      new Notice("Google Tasks connected successfully.");
    } catch (e) {
      new Notice(`Auth failed: ${e}`);
    }
  }

  private waitForCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      const done = (fn: () => void) => {
        this.closeServer();
        fn();
      };

      this.server = http.createServer((req, res) => {
        const parsed = url.parse(req.url ?? "", true);
        const code = parsed.query.code as string;
        const error = parsed.query.error as string;

        res.writeHead(200, { "Content-Type": "text/html" });
        if (code) {
          res.end("<html><body><h2>Authorized! You can close this tab.</h2></body></html>");
          done(() => resolve(code));
        } else {
          res.end("<html><body><h2>Authorization failed. Check Obsidian.</h2></body></html>");
          done(() => reject(error || "No code returned"));
        }
      });

      this.server.listen(REDIRECT_PORT, "localhost", () => {
        console.log(`[GTasks Daily Note] OAuth listener started on port ${REDIRECT_PORT}`);
      });

      this.server.on("error", (err) => {
        console.error(`[GTasks Daily Note] OAuth server error:`, err);
        done(() => reject(`Could not start local server on port ${REDIRECT_PORT}: ${err.message}`));
      });

      // Timeout after 2 minutes
      setTimeout(() => done(() => reject("Timed out waiting for authorization.")), 120_000);
    });
  }

  private async exchangeCode(code: string): Promise<void> {
    const { clientId, clientSecret } = this.plugin.settings;

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(err);
    }

    const data = await resp.json();
    this.plugin.settings.accessToken = data.access_token;
    this.plugin.settings.refreshToken = data.refresh_token;
    this.plugin.settings.tokenExpiry = Date.now() + data.expires_in * 1000;
    await this.plugin.saveSettings();
  }

  async getValidToken(): Promise<string> {
    const { accessToken, refreshToken, tokenExpiry } = this.plugin.settings;

    // Refresh 60 seconds before expiry
    if (accessToken && Date.now() < tokenExpiry - 60_000) {
      return accessToken;
    }

    if (!refreshToken) throw new Error("Not authenticated. Connect Google account in settings.");

    const { clientId, clientSecret } = this.plugin.settings;
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!resp.ok) throw new Error("Token refresh failed. Reconnect in settings.");

    const data = await resp.json();
    this.plugin.settings.accessToken = data.access_token;
    this.plugin.settings.tokenExpiry = Date.now() + data.expires_in * 1000;
    await this.plugin.saveSettings();

    return this.plugin.settings.accessToken;
  }
}
