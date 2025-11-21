<template>
    <main>
        <header>
            <div class="flex items-center justify-between px-4 py-3 sm:hidden">
                <button type="button" class="-m-2.5 p-2.5 text-white" @click="emit('open-sidebar')">
                    <span class="sr-only">Open sidebar</span>
                    <Bars3Icon class="size-5" aria-hidden="true" />
                </button>
            </div>
            <!-- Secondary navigation -->
            <nav class="flex overflow-x-auto border-b border-white/10 py-4">
                <ul
                    role="list"
                    class="flex min-w-full flex-none gap-x-6 px-4 text-sm/6 font-semibold text-gray-400 sm:px-6 lg:px-8"
                >
                    <li v-for="item in secondaryNavigation" :key="item.name">
                        <a :href="item.href" :class="item.current ? 'text-indigo-400' : ''">
                            {{ item.name }}
                        </a>
                    </li>
                </ul>
            </nav>

            <!-- Stats -->
            <div class="grid grid-cols-1 bg-gray-700/10 sm:grid-cols-2 lg:grid-cols-4">
                <div
                    v-for="(stat, statIdx) in statCards"
                    :key="stat.name"
                    :class="[
                        statIdx % 2 === 1 ? 'sm:border-l' : statIdx === 2 ? 'lg:border-l' : '',
                        'border-t border-white/5 px-4 py-6 sm:px-6 lg:px-8',
                    ]"
                >
                    <p class="text-sm/6 font-medium text-gray-400">{{ stat.name }}</p>
                    <p class="mt-2 flex items-baseline gap-x-2">
                        <span class="text-4xl font-semibold tracking-tight text-white">
                            {{ formatNumber(stat.value) }}
                        </span>
                    </p>
                </div>
            </div>
        </header>

        <!-- Agent table -->
        <div class="border-t border-white/10 pt-11">
            <div class="flex flex-wrap items-start justify-between gap-4 px-4 sm:px-6 lg:px-8">
                <div>
                    <p class="text-sm/6 font-semibold text-gray-400">Agents</p>
                    <h2 class="text-base/7 font-semibold text-white">Active Sessions</h2>
                    <p class="mt-1 text-xs/6 text-gray-400">
                        Monitor live tmux sessions and step in when a run stalls.
                    </p>
                    <p v-if="lastUpdated" class="mt-2 text-xs/6 text-gray-500">
                        Updated {{ formatTimestamp(lastUpdated) }}
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        class="inline-flex items-center rounded-full bg-white/5 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
                        :disabled="loading"
                        @click="requestAgentsRefresh"
                    >
                        <span v-if="loading">Refreshing…</span>
                        <span v-else>Refresh now</span>
                    </button>
                    <label class="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <input
                            type="checkbox"
                            class="size-4 rounded border-white/10 bg-gray-900 text-indigo-500 focus:ring-indigo-500"
                            v-model="autoRefresh"
                        />
                        Auto refresh
                    </label>
                </div>
            </div>

            <div class="mt-6 flex flex-wrap gap-6 px-4 text-sm text-white sm:px-6 lg:px-8">
                <div class="min-w-[16rem] flex-1">
                    <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</p>
                    <div class="mt-3 flex flex-wrap gap-2">
                        <button
                            v-for="option in statusOptions"
                            :key="option.value"
                            type="button"
                            class="rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition"
                            :class="
                                selectedStatusSet.has(option.value)
                                    ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-400/50'
                                    : 'text-gray-300 ring-white/10 hover:bg-white/5'
                            "
                            @click="toggleStatus(option.value)"
                        >
                            {{ option.label }}
                        </button>
                    </div>
                    <p class="mt-2 text-xs/6 text-gray-400">Showing: {{ statusSummary }}</p>
                </div>
                <div class="flex items-end gap-3">
                    <label for="limit-input" class="text-xs font-semibold uppercase tracking-wide text-gray-400"
                        >Max rows</label
                    >
                    <input
                        id="limit-input"
                        v-model.number="limit"
                        type="number"
                        min="1"
                        :max="maxLimit"
                        class="w-24 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-indigo-400 focus:outline-none"
                    />
                </div>
            </div>

            <p v-if="error" class="mt-4 px-4 text-sm text-rose-300 sm:px-6 lg:px-8">
                {{ error }}
            </p>

            <table class="mt-6 w-full whitespace-nowrap text-left">
                <colgroup>
                    <col class="w-full lg:w-3/12" />
                    <col class="lg:w-2/12" />
                    <col class="lg:w-1/12" />
                    <col class="lg:w-1/12" />
                    <col class="lg:w-1/12" />
                    <col class="lg:w-1/12" />
                    <col class="lg:w-1/12" />
                </colgroup>
                <thead class="border-b border-white/10 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <tr>
                        <th scope="col" class="py-2 pl-4 pr-8 sm:pl-6 lg:pl-8">Agent</th>
                        <th scope="col" class="py-2 pl-0 pr-4 sm:pr-8">Codebase</th>
                        <th scope="col" class="hidden py-2 pl-0 pr-4 md:table-cell lg:pr-8">Role</th>
                        <th scope="col" class="py-2 pl-0 pr-4 sm:pr-8">Status</th>
                        <th scope="col" class="hidden py-2 pl-0 pr-4 md:table-cell lg:pr-8">Created</th>
                        <th scope="col" class="py-2 pl-0 pr-4 lg:pr-8">Updated</th>
                        <th scope="col" class="py-2 pl-0 pr-4 text-right sm:pr-6 lg:pr-8">Actions</th>
                    </tr>
                </thead>
                <tbody v-if="hasAgents" class="divide-y divide-white/5 text-sm/6 text-white">
                    <tr v-for="agent in agents" :key="agent.id">
                        <td class="py-4 pl-4 pr-8 sm:pl-6 lg:pl-8">
                            <RouterLink
                                :to="`/agents/${agent.id}`"
                                class="text-sm font-semibold text-white hover:text-indigo-200"
                            >
                                {{ shorten(agent.id) }}
                            </RouterLink>
                            <div class="text-xs text-gray-400">exec {{ shorten(agent.executionId) }}</div>
                        </td>
                        <td class="py-4 pl-0 pr-4 sm:pr-8">
                            <div>{{ agent.codebase?.name ?? "–" }}</div>
                            <div class="text-xs text-gray-400">{{ agent.codebaseId ?? "" }}</div>
                        </td>
                        <td class="hidden py-4 pl-0 pr-4 text-gray-200 md:table-cell lg:pr-8">
                            {{ agent.role ?? "–" }}
                        </td>
                        <td class="py-4 pl-0 pr-4 sm:pr-8">
                            <span
                                class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset"
                                :class="statusBadgeClasses[agent.status]"
                            >
                                {{ agent.status }}
                            </span>
                        </td>
                        <td class="hidden py-4 pl-0 pr-4 text-gray-300 md:table-cell lg:pr-8">
                            {{ formatDate(agent.createdAt) }}
                        </td>
                        <td class="py-4 pl-0 pr-4 text-gray-300 lg:pr-8">
                            {{ formatDate(agent.updatedAt) }}
                        </td>
                        <td class="py-4 pl-0 pr-4 text-right sm:pr-6 lg:pr-8">
                            <button
                                type="button"
                                class="inline-flex items-center rounded-md bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200 ring-1 ring-inset ring-rose-500/30 transition hover:bg-rose-500/20 disabled:opacity-50"
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

            <div
                v-if="!hasAgents && !loading"
                class="mt-6 rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-gray-400 sm:px-6 lg:px-8"
            >
                <p class="font-semibold text-white">No agents match the selected filters.</p>
                <p class="mt-2 text-sm/6 text-gray-400">Kick off a run or broaden the filters to see the backlog.</p>
            </div>
        </div>
    </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { Bars3Icon } from "@heroicons/vue/20/solid";

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

type DashboardStats = {
    runningAgents: number;
    totalAgents: number;
    completedTickets: number;
    openTickets: number;
};

const emit = defineEmits<{
    (e: "open-sidebar"): void;
}>();

const secondaryNavigation = [
    { name: "Overview", href: "#", current: true },
    { name: "Activity", href: "#", current: false },
    { name: "Settings", href: "#", current: false },
    { name: "Collaborators", href: "#", current: false },
    { name: "Notifications", href: "#", current: false },
];

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
const pendingRefresh = ref(false);
const dashboardStats = ref<DashboardStats>({
    runningAgents: 0,
    totalAgents: 0,
    completedTickets: 0,
    openTickets: 0,
});
let intervalHandle: ReturnType<typeof setInterval> | null = null;

const selectedStatusSet = computed(() => new Set(selectedStatuses.value));
const statusSummary = computed(() => selectedStatuses.value.join(", "));
const hasAgents = computed(() => agents.value.length > 0);
const statCards = computed(() => [
    { name: "Running Agents", value: dashboardStats.value.runningAgents },
    { name: "Agents Spawned", value: dashboardStats.value.totalAgents },
    { name: "Completed Tickets", value: dashboardStats.value.completedTickets },
    { name: "Open Tickets", value: dashboardStats.value.openTickets },
]);

const formatDate = (value: string) => new Date(value).toLocaleString();
const formatTimestamp = (value: Date) => value.toLocaleTimeString();
const formatNumber = (value: number) => value.toLocaleString();
const shorten = (value: string) => value.slice(0, 6);
const canKill = (status: AgentStatus) => stoppableStatuses.has(status);
const statusBadgeClasses: Record<AgentStatus, string> = {
    PREPARING: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
    LAUNCHED: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
    RUNNING: "bg-indigo-400/10 text-indigo-300 ring-indigo-400/30",
    COMPLETED: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
    FAILED: "bg-rose-400/10 text-rose-300 ring-rose-400/30",
};

const clearTimer = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
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
        const data = payload.data ?? {};
        agents.value = data.agents ?? [];
        if (data.stats) {
            dashboardStats.value = {
                runningAgents: Number(data.stats.runningAgents) || 0,
                totalAgents: Number(data.stats.totalAgents) || 0,
                completedTickets: Number(data.stats.completedTickets) || 0,
                openTickets: Number(data.stats.openTickets) || 0,
            };
        }
        lastUpdated.value = new Date();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
        flushPendingRefresh();
    }
};

const flushPendingRefresh = () => {
    if (!pendingRefresh.value || !ready.value || loading.value) return;
    pendingRefresh.value = false;
    fetchAgents();
};

const scheduleAutoRefresh = () => {
    clearTimer();
    if (!autoRefresh.value) return;
    intervalHandle = setInterval(() => {
        requestAgentsRefresh();
    }, pollIntervalMs);
};

const requestAgentsRefresh = () => {
    if (!ready.value || loading.value) {
        pendingRefresh.value = true;
        return;
    }
    fetchAgents();
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
        requestAgentsRefresh();
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
        requestAgentsRefresh();
    },
);

watch(autoRefresh, () => {
    scheduleAutoRefresh();
});

onMounted(async () => {
    await fetchAgents();
    ready.value = true;
    flushPendingRefresh();
    scheduleAutoRefresh();
});

onBeforeUnmount(() => {
    clearTimer();
});
</script>
