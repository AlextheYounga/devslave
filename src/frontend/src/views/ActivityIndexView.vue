<template>
    <main class="min-h-screen text-white">
        <header class="border-b border-white/10">
            <div class="flex items-center justify-between px-4 py-3 sm:hidden">
                <button type="button" class="-m-2.5 p-2.5 text-white" @click="emit('open-sidebar')">
                    <span class="sr-only">Open sidebar</span>
                    <Bars3Icon class="size-5" aria-hidden="true" />
                </button>
            </div>

            <div class="px-4 py-6 sm:px-6 lg:px-8">
                <div class="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p class="text-sm font-semibold text-gray-400">Activity</p>
                        <h1 class="text-xl font-semibold text-white">Latest events</h1>
                        <p class="mt-1 text-sm text-gray-400">Search and monitor system events.</p>
                        <p v-if="lastUpdated" class="mt-2 text-xs text-gray-500">
                            Updated {{ formatTimestamp(lastUpdated) }}
                        </p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <form class="flex w-full flex-wrap items-center gap-2 sm:w-auto" @submit.prevent="handleSearch">
                            <label for="activity-query" class="sr-only">Search</label>
                            <div
                                class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
                            >
                                <MagnifyingGlassIcon class="size-4 text-gray-400" aria-hidden="true" />
                                <input
                                    id="activity-query"
                                    v-model="query"
                                    type="text"
                                    placeholder="Search events"
                                    class="w-48 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
                                    @keyup.enter="handleSearch"
                                />
                            </div>
                            <button
                                type="submit"
                                class="inline-flex items-center rounded-full bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
                                :disabled="loading"
                            >
                                {{ loading ? "Searching…" : "Search" }}
                            </button>
                        </form>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
                            :disabled="loading"
                            @click="fetchEvents"
                        >
                            <ArrowPathIcon class="size-4" :class="loading ? 'animate-spin' : ''" aria-hidden="true" />
                            <span>{{ loading ? "Refreshing…" : "Refresh" }}</span>
                        </button>
                    </div>
                </div>
                <p v-if="currentQuery" class="mt-2 text-xs text-gray-400">Filtering by: "{{ currentQuery }}"</p>
            </div>
        </header>

        <section class="px-4 py-10 sm:px-6 lg:px-8">
            <p v-if="error" class="text-sm text-rose-300">{{ error }}</p>
            <p v-else-if="loading && !events.length" class="text-sm text-gray-300">Loading events…</p>

            <div
                v-if="!loading && !events.length"
                class="mt-6 rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-gray-400 sm:px-6 lg:px-8"
            >
                <p class="font-semibold text-white">No events found.</p>
                <p class="mt-2 text-sm text-gray-400">Adjust your search to see activity.</p>
            </div>

            <div v-else class="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-gray-900/60 shadow-lg">
                <table class="min-w-full divide-y divide-white/10">
                    <colgroup>
                        <col class="w-full lg:w-3/12" />
                        <col class="lg:w-2/12" />
                        <col class="lg:w-1/12" />
                        <col class="lg:w-2/12" />
                        <col class="lg:w-2/12" />
                    </colgroup>
                    <thead class="bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                        <tr>
                            <th scope="col" class="px-4 py-3 sm:px-6 lg:px-8">Event</th>
                            <th scope="col" class="px-3 py-3">Event ID</th>
                            <th scope="col" class="px-3 py-3">Status</th>
                            <th scope="col" class="px-3 py-3">Codebase</th>
                            <th scope="col" class="px-3 py-3 text-right">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-sm text-gray-200">
                        <tr v-for="item in events" :key="item.id">
                            <td class="px-4 py-4 sm:px-6 lg:px-8">
                                <div class="space-y-1">
                                    <RouterLink
                                        :to="`/activity/${item.id}`"
                                        class="font-semibold text-white hover:text-indigo-200"
                                    >
                                        {{ item.type }}
                                    </RouterLink>
                                    <p class="text-xs text-gray-400 line-clamp-2">
                                        Agent ID: {{ pluckAgentId(item.data) ?? "--" }}
                                    </p>
                                </div>
                            </td>
                            <td class="px-3 py-4">
                                <div class="text-xs text-gray-300">{{ item.id }}</div>
                            </td>
                            <td class="px-3 py-4">
                                <span
                                    class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset"
                                    :class="statusBadgeClasses[getStatus(item)]"
                                >
                                    {{ getStatus(item) }}
                                </span>
                            </td>
                            <td class="px-3 py-4">
                                <span class="text-sm text-gray-300">{{ pluckCodebaseId(item.data) ?? "–" }}</span>
                            </td>
                            <td class="px-3 py-4 text-right text-sm text-gray-300">
                                {{ formatDate(item.timestamp) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { ArrowPathIcon, Bars3Icon, MagnifyingGlassIcon } from "@heroicons/vue/24/outline";

type EventRecord = {
    id: string;
    parentId?: string | null;
    type: string;
    data?: unknown;
    timestamp: string;
};

const emit = defineEmits<{
    (e: "open-sidebar"): void;
}>();

const events = ref<EventRecord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const lastUpdated = ref<string | null>(null);
const query = ref("");
const currentQuery = ref("");

const statusBadgeClasses: Record<string, string> = {
    Successful: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
    Failed: "bg-rose-400/10 text-rose-200 ring-rose-400/30",
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "–");
const formatTimestamp = (value?: string | null) =>
    value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "–";

const pluckCodebaseId = (data: any): string | null => {
    const eventData = data?.data;
    if (
        eventData &&
        typeof eventData === "object" &&
        "codebaseId" in eventData &&
        typeof eventData.codebaseId === "string"
    ) {
        return eventData.codebaseId;
    }
    return null;
};

const pluckAgentId = (data: any): string | null => {
    const eventData = data?.data;
    if (eventData && typeof eventData === "object" && "agentId" in eventData && typeof eventData.agentId === "string") {
        return eventData.agentId;
    }
    return null;
};

const getStatus = (event: EventRecord) => (/fail/i.test(event.type) ? "Failed" : "Successful");

const fetchEvents = async () => {
    try {
        loading.value = true;
        error.value = null;
        const params = new URLSearchParams();
        if (currentQuery.value.trim()) params.set("query", currentQuery.value.trim());
        params.set("limit", "50");
        const response = await fetch(`/api/events?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to load events");
        }
        events.value = payload.data?.events ?? [];
        lastUpdated.value = new Date().toISOString();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
};

const handleSearch = async () => {
    currentQuery.value = query.value.trim();
    await fetchEvents();
};

onMounted(async () => {
    await fetchEvents();
});
</script>
