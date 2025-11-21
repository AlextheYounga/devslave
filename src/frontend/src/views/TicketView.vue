<template>
    <main class="min-h-screen bg-black text-white">
        <section
            class="relative isolate overflow-hidden border-b border-white/10 bg-linear-to-br from-indigo-900/40 to-gray-900/40 px-4 pb-10 pt-16 sm:px-6 lg:px-8"
        >
            <div class="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
                <div class="space-y-2">
                    <p class="text-sm font-semibold text-gray-400">Ticket</p>
                    <h1 class="text-2xl font-semibold text-white">{{ ticket?.title || "Ticket" }}</h1>
                    <p class="text-sm text-gray-300">ID: {{ ticket?.ticketId ?? ticket?.id ?? "–" }}</p>
                    <p v-if="ticket?.codebase" class="text-sm text-gray-300">
                        Codebase:
                        <RouterLink
                            :to="`/projects/${ticket.codebase.id}`"
                            class="text-indigo-300 hover:text-indigo-200"
                            >{{ ticket.codebase.name }}</RouterLink
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
                </div>
            </div>
        </section>

        <section class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <div class="grid gap-6 lg:grid-cols-3 lg:items-start">
                <div class="lg:col-span-2 space-y-4 rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-lg">
                    <div class="flex items-center justify-between">
                        <h2 class="text-base font-semibold text-white">Details</h2>
                        <span class="text-xs text-gray-400">Updated {{ formatDate(ticket?.updatedAt) }}</span>
                    </div>
                    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm text-gray-300">
                        <div>
                            <dt class="text-gray-400">Ticket ID</dt>
                            <dd class="font-semibold text-white">{{ ticket?.ticketId ?? "–" }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Branch</dt>
                            <dd class="font-semibold text-white">{{ ticket?.branchName ?? "–" }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Status</dt>
                            <dd>
                                <span
                                    class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset"
                                    :class="statusBadge"
                                >
                                    {{ ticket?.status ?? "–" }}
                                </span>
                            </dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Codebase</dt>
                            <dd>
                                <RouterLink
                                    v-if="ticket?.codebase"
                                    :to="`/projects/${ticket.codebase.id}`"
                                    class="text-indigo-300 hover:text-indigo-200"
                                >
                                    {{ ticket.codebase.name }}
                                </RouterLink>
                                <span v-else class="text-gray-400">–</span>
                            </dd>
                        </div>
                    </dl>

                    <div v-if="ticket?.description" class="border-t border-white/10 pt-4">
                        <h3 class="text-sm font-semibold text-white">Description</h3>
                        <vue-markdown class="markdown-content mt-2" :source="ticket.description" />
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-lg">
                        <h2 class="text-sm/6 font-semibold text-white">Snapshot</h2>
                        <dl class="mt-4 space-y-2 text-sm text-gray-300">
                            <div class="flex justify-between">
                                <dt class="text-gray-400">Created</dt>
                                <dd>{{ formatDate(ticket?.createdAt) }}</dd>
                            </div>
                            <div class="flex justify-between">
                                <dt class="text-gray-400">Updated</dt>
                                <dd>{{ formatDate(ticket?.updatedAt) }}</dd>
                            </div>
                        </dl>
                    </div>

                    <ActivityTimeline :events="events" :loading="eventsLoading" @refresh="fetchEvents" />
                </div>
            </div>
        </section>
    </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import ActivityTimeline from "../components/ActivityTimeline.vue";
import VueMarkdown from "vue-markdown-render";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "QA_REVIEW" | "QA_CHANGES_REQUESTED" | "CLOSED";

type TicketRecord = {
    id: string;
    ticketId: string;
    title: string;
    description?: string | null;
    status: TicketStatus;
    branchName?: string | null;
    codebase?: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
};

type EventRecord = { id: string; type: string; data: any; timestamp: string };

const route = useRoute();
const ticketId = computed(() => route.params.id as string);

const ticket = ref<TicketRecord | null>(null);
const events = ref<EventRecord[]>([]);
const loading = ref(false);
const eventsLoading = ref(false);
const error = ref<string | null>(null);
const copied = ref(false);

const statusBadge = computed(() => {
    switch (ticket.value?.status) {
        case "OPEN":
            return "bg-sky-400/10 text-sky-200 ring-sky-400/30";
        case "IN_PROGRESS":
            return "bg-indigo-400/10 text-indigo-200 ring-indigo-400/30";
        case "QA_REVIEW":
            return "bg-purple-400/10 text-purple-200 ring-purple-400/30";
        case "QA_CHANGES_REQUESTED":
            return "bg-amber-400/10 text-amber-200 ring-amber-400/30";
        case "CLOSED":
            return "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30";
        default:
            return "bg-white/10 text-white ring-white/20";
    }
});

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "–");

const copyId = async () => {
    if (!ticket.value?.id) return;
    try {
        await navigator.clipboard.writeText(ticket.value.id);
        copied.value = true;
        setTimeout(() => (copied.value = false), 1200);
    } catch (err) {
        console.error(err);
    }
};

const fetchTicket = async () => {
    try {
        loading.value = true;
        error.value = null;
        const response = await fetch(`/api/tickets/${ticketId.value}/detail`);
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to load ticket");
        }
        ticket.value = payload.data?.ticket ?? null;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
};

const fetchEvents = async () => {
    if (!ticketId.value) return;
    try {
        eventsLoading.value = true;
        const response = await fetch(`/api/events?query=${encodeURIComponent(ticketId.value)}&limit=50`);
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

onMounted(async () => {
    await fetchTicket();
    await fetchEvents();
});
</script>
