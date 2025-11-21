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
                        <p class="text-sm font-semibold text-gray-400">Tickets</p>
                        <h1 class="text-xl font-semibold text-white">Work items</h1>
                        <p class="mt-1 text-sm text-gray-400">Latest tickets across active codebases.</p>
                        <p v-if="lastUpdated" class="mt-2 text-xs text-gray-500">
                            Updated {{ formatTimestamp(lastUpdated) }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
                        :disabled="loading"
                        @click="fetchTickets"
                    >
                        <ArrowPathIcon class="size-4" :class="loading ? 'animate-spin' : ''" aria-hidden="true" />
                        <span>{{ loading ? "Refreshing…" : "Refresh" }}</span>
                    </button>
                </div>
            </div>
        </header>

        <section class="px-4 pb-10 sm:px-6 lg:px-8">
            <p v-if="error" class="mt-4 text-sm text-rose-300">{{ error }}</p>

            <div class="mt-6 grid gap-6 lg:grid-cols-4">
                <aside class="rounded-2xl border border-white/10 bg-gray-900/60 p-4 sm:p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Projects</p>
                            <p class="text-sm text-gray-300">Filter tickets by codebase.</p>
                        </div>
                        <ArrowPathIcon
                            class="size-5 cursor-pointer text-gray-400 transition hover:text-white"
                            :class="projectsLoading ? 'animate-spin' : ''"
                            @click="fetchProjects"
                        />
                    </div>

                    <div class="mt-4 space-y-2 text-sm">
                        <button
                            type="button"
                            :class="[
                                !selectedCodebaseId ? 'bg-white/10 text-white' : 'text-gray-200 hover:bg-white/5',
                                'w-full rounded-md px-3 py-2 text-left font-semibold transition',
                            ]"
                            @click="selectCodebase(null)"
                        >
                            All tickets
                        </button>
                        <div v-if="projectsLoading" class="text-xs text-gray-400">Loading projects…</div>
                        <div v-else-if="!projects.length" class="text-xs text-gray-500">No projects found.</div>
                        <ul v-else class="space-y-1">
                            <li v-for="project in projects" :key="project.id">
                                <button
                                    type="button"
                                    :class="[
                                        selectedCodebaseId === project.id
                                            ? 'bg-white/10 text-white'
                                            : 'text-gray-200 hover:bg-white/5',
                                        'w-full rounded-md px-3 py-2 text-left font-semibold transition',
                                    ]"
                                    @click="selectCodebase(project.id)"
                                >
                                    {{ project.name }}
                                </button>
                            </li>
                        </ul>
                    </div>
                </aside>

                <div class="lg:col-span-3">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p class="text-sm font-semibold text-gray-200">
                                Tickets
                                <span v-if="selectedProjectLabel" class="text-gray-400"
                                    >— {{ selectedProjectLabel }}</span
                                >
                            </p>
                            <p class="text-xs text-gray-400" v-if="selectedCodebaseId">
                                Filtering by {{ selectedCodebaseId }}
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                class="rounded-md px-3 py-1.5 text-sm font-semibold text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/5"
                                v-if="selectedCodebaseId"
                                @click="selectCodebase(null)"
                            >
                                Clear filter
                            </button>
                            <button
                                type="button"
                                class="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
                                :disabled="loading"
                                @click="fetchTickets"
                            >
                                <ArrowPathIcon
                                    class="size-4"
                                    :class="loading ? 'animate-spin' : ''"
                                    aria-hidden="true"
                                />
                                <span>{{ loading ? "Refreshing…" : "Refresh" }}</span>
                            </button>
                        </div>
                    </div>

                    <p v-if="loading && !tickets.length" class="mt-4 text-sm text-gray-300">Loading tickets…</p>

                    <div
                        v-else-if="!hasTickets"
                        class="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-gray-400 sm:px-6 lg:px-8"
                    >
                        <p class="font-semibold text-white">No tickets found.</p>
                        <p class="mt-2 text-sm text-gray-400">Run a scan to sync tickets from your codebases.</p>
                    </div>

                    <div v-else class="mt-4 rounded-2xl border border-white/10 bg-gray-900/60 shadow-lg">
                        <ul role="list" class="divide-y divide-white/5">
                            <li
                                v-for="ticket in tickets"
                                :key="ticket.id"
                                class="flex items-start justify-between gap-x-4 px-4 py-5 sm:px-6 lg:px-8"
                            >
                                <div class="min-w-0">
                                    <div class="flex items-center gap-2">
                                        <TicketIcon class="size-5 text-indigo-300" aria-hidden="true" />
                                        <RouterLink
                                            :to="`/tickets/${ticket.id}`"
                                            class="text-sm font-semibold text-white hover:text-indigo-200 truncate"
                                        >
                                            {{ ticket.title || ticket.ticketId }}
                                        </RouterLink>
                                    </div>
                                    <div class="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                                        <span class="inline-flex items-center gap-1">
                                            <span class="text-gray-500">ID</span>
                                            <span>{{ ticket.ticketId }}</span>
                                        </span>
                                        <span class="inline-flex items-center gap-1" v-if="ticket.branchName">
                                            <span class="text-gray-500">Branch</span>
                                            <span class="truncate">{{ ticket.branchName }}</span>
                                        </span>
                                        <span class="inline-flex items-center gap-1" v-if="ticket.codebase?.name">
                                            <span class="text-gray-500">Codebase</span>
                                            <span>{{ ticket.codebase.name }}</span>
                                        </span>
                                        <span class="inline-flex items-center gap-1">
                                            <span class="text-gray-500">Updated</span>
                                            <span>{{ formatDate(ticket.updatedAt) }}</span>
                                        </span>
                                    </div>
                                </div>
                                <span
                                    class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset"
                                    :class="statusBadgeClasses[ticket.status] || defaultBadgeClass"
                                >
                                    {{ ticket.status }}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Bars3Icon } from "@heroicons/vue/20/solid";
import { ArrowPathIcon, TicketIcon } from "@heroicons/vue/24/outline";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "QA_REVIEW" | "QA_CHANGES_REQUESTED" | "CLOSED";

type TicketRecord = {
    id: string;
    ticketId: string;
    branchName: string;
    title: string;
    status: TicketStatus;
    updatedAt: string;
    codebase?: {
        id: string;
        name: string;
    } | null;
};

type ProjectRecord = {
    id: string;
    name: string;
};

const emit = defineEmits<{
    (e: "open-sidebar"): void;
}>();
const route = useRoute();
const router = useRouter();

const tickets = ref<TicketRecord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const lastUpdated = ref<Date | null>(null);
const projects = ref<ProjectRecord[]>([]);
const projectsLoading = ref(false);
const selectedCodebaseId = ref<string | null>(null);

const statusBadgeClasses: Record<TicketStatus, string> = {
    OPEN: "bg-sky-400/10 text-sky-200 ring-sky-400/30",
    IN_PROGRESS: "bg-indigo-400/10 text-indigo-200 ring-indigo-400/30",
    QA_REVIEW: "bg-purple-400/10 text-purple-200 ring-purple-400/30",
    QA_CHANGES_REQUESTED: "bg-amber-400/10 text-amber-200 ring-amber-400/30",
    CLOSED: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
};
const defaultBadgeClass = "bg-white/5 text-gray-200 ring-white/20";

const hasTickets = computed(() => tickets.value.length > 0);
const selectedProjectLabel = computed(() => {
    if (!selectedCodebaseId.value) return "";
    const project = projects.value.find((p) => p.id === selectedCodebaseId.value);
    return project?.name ?? "";
});

const formatTimestamp = (value: Date) => value.toLocaleTimeString();
const formatDate = (value: string) => new Date(value).toLocaleString();

const syncSelectedFromRoute = () => {
    const param = route.query.codebaseId;
    selectedCodebaseId.value = typeof param === "string" ? param : null;
};

const selectCodebase = (codebaseId: string | null) => {
    const query = { ...route.query };
    if (codebaseId) {
        query.codebaseId = codebaseId;
    } else {
        delete query.codebaseId;
    }
    router.replace({ path: route.path, query });
};

const fetchTickets = async () => {
    try {
        loading.value = true;
        error.value = null;
        const params = new URLSearchParams();
        if (selectedCodebaseId.value) {
            params.set("codebaseId", selectedCodebaseId.value);
        }
        const query = params.toString();
        const response = await fetch(`/api/tickets${query ? `?${query}` : ""}`);
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to load tickets");
        }
        tickets.value = payload.data?.tickets ?? [];
        lastUpdated.value = new Date();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
};

const fetchProjects = async () => {
    try {
        projectsLoading.value = true;
        const response = await fetch("/api/codebases");
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to load projects");
        }
        projects.value = (payload.data?.codebases ?? []).map((p: any) => ({
            id: p.id,
            name: p.name,
        }));
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        projectsLoading.value = false;
    }
};

watch(
    () => route.query.codebaseId,
    () => {
        syncSelectedFromRoute();
        fetchTickets();
    },
);

onMounted(async () => {
    syncSelectedFromRoute();
    await Promise.all([fetchProjects(), fetchTickets()]);
});
</script>
