<template>
    <div class="dashboard">
        <header class="dashboard__header">
            <div>
                <p class="eyebrow">Devslave</p>
                <h1>Agent Control Room</h1>
                <p class="subtitle">
                    Monitor live tmux sessions and take action when a run stalls.
                </p>
            </div>
            <div class="header-actions">
                <button class="ghost" :disabled="loading" @click="fetchAgents">
                    <span v-if="loading">Refreshing…</span>
                    <span v-else>Refresh Now</span>
                </button>
                <label class="toggle">
                    <input type="checkbox" v-model="autoRefresh" />
                    <span>Auto refresh</span>
                </label>
                <p v-if="lastUpdated" class="timestamp">
                    Updated {{ formatTimestamp(lastUpdated) }}
                </p>
            </div>
        </header>

        <section class="panel">
            <div class="panel__header">
                <div>
                    <p class="eyebrow">Filters</p>
                    <h2>Focus on the runs that matter</h2>
                </div>
                <p class="selected-statuses">{{ statusSummary }}</p>
            </div>
            <div class="filters">
                <div class="filter-group">
                    <p>Status</p>
                    <div class="status-options">
                        <button
                            v-for="option in statusOptions"
                            :key="option.value"
                            type="button"
                            class="status-chip"
                            :class="{ active: selectedStatusSet.has(option.value) }"
                            @click="toggleStatus(option.value)"
                        >
                            {{ option.label }}
                        </button>
                    </div>
                </div>
                <div class="filter-group">
                    <label for="limit-input">Max rows</label>
                    <input
                        id="limit-input"
                        v-model.number="limit"
                        type="number"
                        min="1"
                        max="100"
                    />
                </div>
            </div>
        </section>

        <section class="panel">
            <div class="panel__header">
                <div>
                    <p class="eyebrow">Agents</p>
                    <h2>
                        Active Sessions
                        <small>({{ agents.length }} shown)</small>
                    </h2>
                </div>
                <span v-if="error" class="error">{{ error }}</span>
            </div>
            <div v-if="!agents.length && !loading" class="empty-state">
                <p>No agents match the selected filters right now.</p>
                <p class="muted">Kick off a run or broaden the filters to see the backlog.</p>
            </div>
            <div v-else class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Agent</th>
                            <th>Codebase</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Updated</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="agent in agents" :key="agent.id">
                            <td>
                                <div class="mono">{{ shorten(agent.id) }}</div>
                                <small class="muted">exec {{ shorten(agent.executionId) }}</small>
                            </td>
                            <td>
                                <div>{{ agent.codebase?.name ?? "–" }}</div>
                                <small class="muted">{{ agent.codebaseId ?? "" }}</small>
                            </td>
                            <td>{{ agent.role ?? "–" }}</td>
                            <td>
                                <span class="status-pill" :class="agent.status.toLowerCase()">
                                    {{ agent.status }}
                                </span>
                            </td>
                            <td>{{ formatDate(agent.createdAt) }}</td>
                            <td>{{ formatDate(agent.updatedAt) }}</td>
                            <td>
                                <button
                                    class="danger"
                                    :disabled="!canKill(agent.status) || pendingKill === agent.id"
                                    @click="killAgent(agent)"
                                >
                                    <span v-if="pendingKill === agent.id">Terminating…</span>
                                    <span v-else>Stop</span>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

type AgentStatus = "PREPARING" | "LAUNCHED" | "RUNNING" | "COMPLETED" | "FAILED";

type AgentRecord = {
    id: string;
    executionId: string;
    status: AgentStatus;
    role?: string | null;
    codebaseId?: string | null;
    codebase?: {
        id: string;
        name: string;
    } | null;
    createdAt: string;
    updatedAt: string;
};

const statusOptions: { value: AgentStatus; label: string }[] = [
    { value: "PREPARING", label: "Preparing" },
    { value: "LAUNCHED", label: "Launched" },
    { value: "RUNNING", label: "Running" },
    { value: "COMPLETED", label: "Completed" },
    { value: "FAILED", label: "Failed" },
];

const defaultStatuses: AgentStatus[] = ["PREPARING", "LAUNCHED", "RUNNING"];
const stoppableStatuses = new Set<AgentStatus>(defaultStatuses);
const maxLimit = 100;
const pollIntervalMs = 6000;

const agents = ref<AgentRecord[]>([]);
const selectedStatuses = ref<AgentStatus[]>([...defaultStatuses]);
const limit = ref(25);
const loading = ref(false);
const error = ref<string | null>(null);
const lastUpdated = ref<Date | null>(null);
const autoRefresh = ref(true);
const pendingKill = ref<string | null>(null);
const ready = ref(false);
let intervalHandle: ReturnType<typeof setInterval> | null = null;

const selectedStatusSet = computed(() => new Set(selectedStatuses.value));
const statusSummary = computed(() => selectedStatuses.value.join(", "));

const formatDate = (value: string) => new Date(value).toLocaleString();
const formatTimestamp = (value: Date) => value.toLocaleTimeString();
const shorten = (value: string) => value.slice(0, 6);
const canKill = (status: AgentStatus) => stoppableStatuses.has(status);

const clearTimer = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
};

const scheduleAutoRefresh = () => {
    clearTimer();
    if (!autoRefresh.value) return;
    intervalHandle = setInterval(() => {
        fetchAgents();
    }, pollIntervalMs);
};

const toggleStatus = (value: AgentStatus) => {
    const next = new Set(selectedStatuses.value);
    if (next.has(value)) {
        if (next.size === 1) return;
        next.delete(value);
    } else {
        next.add(value);
    }
    selectedStatuses.value = Array.from(next);
};

const fetchAgents = async () => {
    try {
        loading.value = true;
        error.value = null;
        const params = new URLSearchParams({
            status: selectedStatuses.value.join(","),
            limit: String(limit.value),
        });
        const response = await fetch(`/api/agents?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to load agents");
        }
        agents.value = payload.data?.agents ?? [];
        lastUpdated.value = new Date();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
};

const killAgent = async (agent: AgentRecord) => {
    if (!canKill(agent.status) || pendingKill.value === agent.id) {
        return;
    }
    const confirmed = window.confirm(`Stop agent ${agent.id}?`);
    if (!confirmed) return;

    try {
        pendingKill.value = agent.id;
        const response = await fetch(`/api/agent/${agent.id}/kill`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Terminated via dashboard" }),
        });
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to stop agent");
        }
        await fetchAgents();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        pendingKill.value = null;
    }
};

watch(
    () => selectedStatuses.value.slice().sort().join(","),
    () => {
        if (!ready.value) return;
        fetchAgents();
    },
);

watch(
    () => limit.value,
    (value, previous) => {
        if (typeof value !== "number" || Number.isNaN(value)) {
            limit.value = typeof previous === "number" ? previous : 25;
            return;
        }
        if (value < 1) limit.value = 1;
        if (value > maxLimit) limit.value = maxLimit;
        if (ready.value) fetchAgents();
    },
);

watch(autoRefresh, () => {
    scheduleAutoRefresh();
});

onMounted(async () => {
    await fetchAgents();
    ready.value = true;
    scheduleAutoRefresh();
});

onBeforeUnmount(() => {
    clearTimer();
});
</script>

<style scoped>
.dashboard {
    max-width: 1100px;
    margin: 0 auto;
    padding: 3rem 1.5rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.dashboard__header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1rem 2rem;
}

h1 {
    margin: 0.25rem 0 0;
    font-size: clamp(2.2rem, 4vw, 3rem);
}

h2 {
    margin: 0;
    font-size: 1.3rem;
}

.subtitle {
    margin: 0.25rem 0 0;
    color: #94a3b8;
}

.eyebrow {
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94a3b8;
    margin: 0;
    font-size: 0.75rem;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

button {
    border-radius: 999px;
    border: 1px solid transparent;
    padding: 0.45rem 1.5rem;
    background: linear-gradient(135deg, #6d28d9, #0ea5e9);
    color: #f8fafc;
    font-weight: 600;
    cursor: pointer;
    transition:
        opacity 0.2s ease,
        transform 0.2s ease;
}

button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

button.ghost {
    background: transparent;
    border-color: rgba(148, 163, 184, 0.4);
}

button.danger {
    background: rgba(248, 113, 113, 0.15);
    border-color: rgba(248, 113, 113, 0.4);
    color: #fecaca;
}

.toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.9rem;
    color: #cbd5f5;
}

.toggle input {
    accent-color: #22d3ee;
}

.timestamp {
    margin: 0;
    font-size: 0.85rem;
    color: #94a3b8;
}

.panel {
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 1.25rem;
    padding: 1.5rem;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.45);
}

.panel__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.25rem;
}

.filters {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 2rem;
    align-items: flex-end;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 200px;
}

.status-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.status-chip {
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.5);
    background: transparent;
    padding: 0.4rem 1rem;
    font-size: 0.85rem;
    color: #cbd5f5;
}

.status-chip.active {
    border-color: transparent;
    background: linear-gradient(135deg, rgba(236, 72, 153, 0.65), rgba(14, 165, 233, 0.75));
    color: #fff;
}

input[type="number"] {
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(15, 23, 42, 0.9);
    color: #f1f5f9;
    padding: 0.65rem 0.75rem;
    width: 100px;
}

.table-wrapper {
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 0.85rem 0.5rem;
}

th {
    font-size: 0.75rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
}

tr + tr {
    border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.status-pill {
    border-radius: 999px;
    padding: 0.25rem 0.65rem;
    font-size: 0.85rem;
    font-weight: 600;
}

.status-pill.preparing {
    background: rgba(14, 165, 233, 0.16);
    color: #bae6fd;
}

.status-pill.launched {
    background: rgba(52, 211, 153, 0.2);
    color: #bbf7d0;
}

.status-pill.running {
    background: rgba(234, 179, 8, 0.2);
    color: #fde68a;
}

.status-pill.completed {
    background: rgba(59, 130, 246, 0.2);
    color: #bfdbfe;
}

.status-pill.failed {
    background: rgba(239, 68, 68, 0.2);
    color: #fecaca;
}

.mono {
    font-family: "PT Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}

.muted {
    color: #94a3b8;
}

.empty-state {
    text-align: center;
    padding: 2rem 0;
    color: #cbd5f5;
}

.error {
    color: #fecaca;
    font-weight: 600;
}

.selected-statuses {
    color: #cbd5f5;
}

@media (max-width: 720px) {
    .header-actions {
        flex-direction: column;
        align-items: flex-start;
    }

    .panel {
        padding: 1rem;
    }

    table {
        font-size: 0.9rem;
    }

    button {
        width: 100%;
        text-align: center;
    }
}
</style>
