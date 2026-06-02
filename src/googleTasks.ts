import type TaskManagerPlugin from "./main";

const BASE = "https://tasks.googleapis.com/tasks/v1";

export interface GTask {
  id: string;
  title: string;
  notes?: string;
  status: "needsAction" | "completed";
  due?: string;
  completed?: string;
}

export class GoogleTasksApi {
  private plugin: TaskManagerPlugin;

  constructor(plugin: TaskManagerPlugin) {
    this.plugin = plugin;
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await this.plugin.auth.getValidToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async listTaskLists(): Promise<{ id: string; title: string }[]> {
    const resp = await fetch(`${BASE}/users/@me/lists`, {
      headers: await this.headers(),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    return (data.items ?? []).map((item: any) => ({
      id: item.id,
      title: item.title,
    }));
  }

  async listTasks(taskListId: string, dueDate: string): Promise<GTask[]> {
    // Fetch all incomplete tasks due on or before today, plus completed tasks due today
    const params = new URLSearchParams({
      showCompleted: "true",
      showHidden: "true",
    });

    const resp = await fetch(
      `${BASE}/lists/${encodeURIComponent(taskListId)}/tasks?${params}`,
      { headers: await this.headers() }
    );
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();

    const all: GTask[] = data.items ?? [];
    return all.filter((t) => {
      if (!t.due) return false;
      const taskDate = t.due.slice(0, 10); // YYYY-MM-DD
      if (t.status === "completed") return taskDate === dueDate;
      return taskDate <= dueDate; // overdue incomplete tasks included
    });
  }

  async createTask(
    taskListId: string,
    title: string,
    dueDate: string,
    time: string | null
  ): Promise<GTask> {
    const notes = time ? `⏰ ${time}` : undefined;
    const body: Partial<GTask> = {
      title,
      due: `${dueDate}T00:00:00.000Z`,
      status: "needsAction",
      ...(notes ? { notes } : {}),
    };

    const resp = await fetch(
      `${BASE}/lists/${encodeURIComponent(taskListId)}/tasks`,
      {
        method: "POST",
        headers: await this.headers(),
        body: JSON.stringify(body),
      }
    );
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  }

  async completeTask(taskListId: string, taskId: string): Promise<void> {
    const resp = await fetch(
      `${BASE}/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: "PATCH",
        headers: await this.headers(),
        body: JSON.stringify({
          status: "completed",
          completed: new Date().toISOString(),
        }),
      }
    );
    if (!resp.ok) throw new Error(await resp.text());
  }

  async reopenTask(taskListId: string, taskId: string): Promise<void> {
    const resp = await fetch(
      `${BASE}/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: "PATCH",
        headers: await this.headers(),
        body: JSON.stringify({ status: "needsAction", completed: null }),
      }
    );
    if (!resp.ok) throw new Error(await resp.text());
  }

  async getTask(taskListId: string, taskId: string): Promise<GTask | null> {
    const resp = await fetch(
      `${BASE}/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
      { headers: await this.headers() }
    );
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  }
}
