<template>
    <main class="min-h-screen bg-black text-white">
        <section
            class="relative isolate overflow-hidden border-b border-white/10 bg-gradient-to-br from-indigo-900/40 to-gray-900/40 px-4 pb-10 pt-16 sm:px-6 lg:px-8"
        >
            <div class="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
                <div class="space-y-2">
                    <p class="text-sm font-semibold text-gray-400">Agent</p>
                    <h1 class="text-2xl font-semibold text-white">{{ title }}</h1>
                    <p v-if="agent?.codebase" class="text-sm text-gray-300">
                        Codebase:
                        <RouterLink
                            :to="`/projects/${agent.codebase.id}`"
                            class="text-indigo-300 hover:text-indigo-200"
                            >{{ agent.codebase.name }}</RouterLink
                        >
                    </p>
                    <p v-if="error" class="text-sm text-rose-300">{{ error }}</p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        class="rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/10 transition hover:bg-white/20"
                        @click="copyId"
                    >
                        {{ copied ? "Copied" : "Copy ID" }}
                    </button>
                    <button
                        v-if="canKill"
                        type="button"
                        class="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
                        :disabled="killLoading"
                        @click="killAgent"
                    >
                        <span v-if="killLoading">Stopping…</span>
                        <span v-else>Kill Agent</span>
                    </button>
                </div>
            </div>
        </section>

        <section class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <div class="grid gap-6 lg:grid-cols-3 lg:items-start">
                <div class="lg:col-span-2 space-y-4 rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-lg">
                    <div class="flex items-center justify-between">
                        <h2 class="text-base font-semibold text-white">Details</h2>
                        <span class="text-xs text-gray-400">Updated {{ formatDate(agent?.updatedAt) }}</span>
                    </div>
                    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm text-gray-300">
                        <div>
                            <dt class="text-gray-400">Execution</dt>
                            <dd class="font-semibold text-white">{{ agent?.executionId ?? "–" }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Role</dt>
                            <dd class="font-semibold text-white">{{ agent?.role ?? "–" }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Model</dt>
                            <dd class="font-semibold text-white">{{ agent?.model ?? "default" }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Status</dt>
                            <dd>
                                <span
                                    class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset"
                                    :class="statusBadge"
                                >
                                    {{ agent?.status ?? "–" }}
                                </span>
                            </dd>
                        </div>
                    </dl>

                    <div class="border-t border-white/10 pt-4">
                        <h3 class="text-sm font-semibold text-white">Prompt</h3>
                        <p class="mt-2 whitespace-pre-wrap text-sm text-gray-200">
                            {{ agent?.prompt || "No prompt available." }}
                        </p>
                    </div>

                    <div v-if="agent?.data" class="border-t border-white/10 pt-4">
                        <h3 class="text-sm font-semibold text-white">Data</h3>
                        <pre class="mt-2 max-h-64 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-gray-200">{{
                            formattedData
                        }}</pre>
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-lg">
                        <h2 class="text-sm/6 font-semibold text-white">Snapshot</h2>
                        <dl class="mt-4 space-y-2 text-sm text-gray-300">
                            <div class="flex justify-between">
                                <dt class="text-gray-400">Created</dt>
                                <dd>{{ formatDate(agent?.createdAt) }}</dd>
                            </div>
                            <div class="flex justify-between">
                                <dt class="text-gray-400">Updated</dt>
                                <dd>{{ formatDate(agent?.updatedAt) }}</dd>
                            </div>
                            <div class="flex justify-between" v-if="agent?.codebase">
                                <dt class="text-gray-400">Codebase</dt>
                                <dd class="text-right">
                                    <RouterLink
                                        :to="`/projects/${agent.codebase.id}`"
                                        class="text-indigo-300 hover:text-indigo-200"
                                    >
                                        {{ agent.codebase.name }}
                                    </RouterLink>
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div class="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-lg">
                        <div class="flex items-center justify-between">
                            <h2 class="text-sm/6 font-semibold text-white">Activity</h2>
                            <button
                                type="button"
                                class="text-xs font-semibold text-gray-300 hover:text-white"
                                :disabled="eventsLoading"
                                @click="fetchEvents"
                            >
                                {{ eventsLoading ? "Refreshing…" : "Refresh" }}
                            </button>
                        </div>
                        <div v-if="eventsLoading" class="mt-3 text-xs text-gray-400">Loading events…</div>
                        <ul v-else class="mt-4 space-y-4">
                            <li
                                v-for="event in events"
                                :key="event.id"
                                class="rounded-lg border border-white/5 bg-black/30 p-3"
                            >
                                <div class="flex items-center justify-between text-xs text-gray-400">
                                    <span class="font-semibold text-white">{{ event.type }}</span>
                                    <span>{{ formatDate(event.timestamp) }}</span>
                                </div>
                                <p class="mt-1 text-xs text-gray-300 break-words">{{ summarizeEvent(event.data) }}</p>
                            </li>
                            <li v-if="!events.length" class="text-sm text-gray-400">No recent events.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";

type AgentStatus = "PREPARING" | "LAUNCHED" | "RUNNING" | "COMPLETED" | "FAILED";

type AgentRecord = {
    id: string;
    executionId: string;
    codebase?: { id: string; name: string } | null;
    status: AgentStatus;
    role?: string | null;
    model?: string | null;
    prompt?: string | null;
    data?: unknown;
    createdAt: string;
    updatedAt: string;
};

type EventRecord = {
    id: string;
    type: string;
    data: any;
    timestamp: string;
};

const route = useRoute();
const agentId = computed(() => route.params.id as string);

const agent = ref<AgentRecord | null>(null);
const events = ref<EventRecord[]>([]);
const loading = ref(false);
const eventsLoading = ref(false);
const killLoading = ref(false);
const error = ref<string | null>(null);
const copied = ref(false);

const stoppable = new Set<AgentStatus>(["PREPARING", "LAUNCHED", "RUNNING"]);

const title = computed(() => (agent.value ? `Agent ${agent.value.id.slice(0, 8)}` : "Agent"));
const canKill = computed(() => (agent.value ? stoppable.has(agent.value.status) : false));
const statusBadge = computed(() => {
    switch (agent.value?.status) {
        case "PREPARING":
            return "bg-amber-400/10 text-amber-200 ring-amber-400/30";
        case "LAUNCHED":
            return "bg-sky-400/10 text-sky-200 ring-sky-400/30";
        case "RUNNING":
            return "bg-indigo-400/10 text-indigo-200 ring-indigo-400/30";
        case "COMPLETED":
            return "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30";
        case "FAILED":
            return "bg-rose-400/10 text-rose-200 ring-rose-400/30";
        default:
            return "bg-white/10 text-white ring-white/20";
    }
});

const formattedData = computed(() =>
    agent.value?.data ? JSON.stringify(agent.value.data, null, 2) : "No data captured.",
);

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "–");

const copyId = async () => {
    if (!agent.value?.id) return;
    try {
        await navigator.clipboard.writeText(agent.value.id);
        copied.value = true;
        setTimeout(() => (copied.value = false), 1200);
    } catch (err) {
        console.error(err);
    }
};

const fetchAgent = async () => {
    try {
        loading.value = true;
        error.value = null;
        const response = await fetch(`/api/agent/${agentId.value}/detail`);
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to load agent");
        }
        agent.value = payload.data?.agent ?? null;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
};

const fetchEvents = async () => {
    if (!agentId.value) return;
    try {
        eventsLoading.value = true;
        const response = await fetch(`/api/events?agentId=${agentId.value}&limit=50`);
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to load events");
        }
        events.value = payload.data?.events ?? [];
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        eventsLoading.value = false;
    }
};

const killAgent = async () => {
    if (!agent.value?.id || !canKill.value) return;
    const confirmed = window.confirm("Stop this agent?");
    if (!confirmed) return;
    try {
        killLoading.value = true;
        const response = await fetch(`/api/agent/${agent.value.id}/kill`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Terminated via detail view" }),
        });
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to stop agent");
        }
        await fetchAgent();
        await fetchEvents();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        killLoading.value = false;
    }
};

const summarizeEvent = (data: any) => {
    try {
        const json = JSON.stringify(data);
        return json.length > 140 ? `${json.slice(0, 140)}…` : json;
    } catch (err) {
        return String(data ?? "");
    }
};

onMounted(async () => {
    await fetchAgent();
    await fetchEvents();
});
</script>
