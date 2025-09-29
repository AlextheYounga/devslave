import { prisma } from "./prisma";

// Base Event class that all events inherit from
export abstract class BaseEvent {
  protected parentId: string | null;
  protected data: Record<string, any> | null;

  constructor(data?: Record<string, any>, parentId?: string) {
    this.parentId = parentId ?? null;
    this.data = data ?? null;
  }

  // Method to get event type based on class name
  getEventType(): string {
    return this.constructor.name;
  }

  // Method to save the event to the database. Do not block.
  async publish(): Promise<this> {
    await prisma.events.create({
      data: {
        parentId: this.parentId,
        type: this.getEventType(),
        data: this.data as any, // Prisma handles JSON serialization
      },
    });

    return this;
  }

  // Helper method to get event data
  getData(): Record<string, any> | null {
    return this.data;
  }

  // Helper method to set additional data
  setData(data: Record<string, any>): void {
    this.data = this.data ? { ...this.data, ...data } : data;
  }
}

// Codebase-related events
export class CodebaseSetupStarted extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class CodebaseSetupFailed extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class CodebaseSetupCompleted extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

// Agent-related events

export class AgentPreparing extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class AgentLaunched extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class AgentFailed extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class AgentRunCompleted extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class WatchdogStarted extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}


// Ticket-related events
export class TicketCreated extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class TicketStatusChanged extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}
