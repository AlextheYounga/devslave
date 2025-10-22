import { prisma } from "./prisma";

// Base Event class that all events inherit from
export abstract class BaseEvent {
  public parentId: string | null;
  public data: Record<string, any> | null;

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
}

// Codebase-related events
export class CodebaseSetupStarted extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class CodebaseAlreadySetup extends BaseEvent {
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

export class AgentRunning extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class AgentCompleted extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class AgentFailed extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class AgentMonitoringStarted extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class AgentCallbackRequestSent extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}


// Ticket-related events
export class ScanningTicketsStarted extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

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

export class ScanningTicketsComplete extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}

export class ScanningTicketsFailed extends BaseEvent {
  constructor(data?: Record<string, any>, parentId?: string) {
    super({ data }, parentId);
  }
}
