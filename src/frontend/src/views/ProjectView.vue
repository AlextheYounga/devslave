<template>
    <main class="min-h-screen bg-black text-white">
        <section
            class="relative isolate overflow-hidden border-b border-white/10 bg-linear-to-br from-indigo-900/40 to-gray-900/40 px-4 pb-10 pt-16 sm:px-6 lg:px-8"
        >
            <div class="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
                <div class="space-y-2">
                    <p class="text-sm font-semibold text-gray-400">Project</p>
                    <h1 class="text-2xl font-semibold text-white">{{ project?.name ?? "Project" }}</h1>
                    <p class="text-sm text-gray-300">ID: {{ project?.id ?? "–" }}</p>
                    <p class="text-sm text-gray-300">Path: {{ project?.path ?? "–" }}</p>
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
                        <span class="text-xs text-gray-400">Updated {{ formatDate(project?.updatedAt) }}</span>
                    </div>
                    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm text-gray-300">
                        <div>
                            <dt class="text-gray-400">Phase</dt>
                            <dd>
                                <span
                                    class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset"
                                    :class="phaseBadge"
                                >
                                    {{ project?.phase ?? "–" }}
                                </span>
                            </dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Path</dt>
                            <dd class="font-semibold text-white break-all">{{ project?.path ?? "–" }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Active</dt>
                            <dd class="font-semibold text-white">{{ project?.active ? "Yes" : "No" }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Setup</dt>
                            <dd class="font-semibold text-white">{{ project?.setup ? "Complete" : "Pending" }}</dd>
                        </div>
                    </dl>

                    <div v-if="hasMasterPrompt" class="border-t border-white/10 pt-4">
                        <h3 class="text-sm font-semibold text-white">Master Prompt</h3>
                        <div class="mt-2 whitespace-pre-wrap text-sm text-gray-200">
                            <vue-markdown :source="masterPrompt" />
                        </div>
                    </div>

                    <div v-if="project?.data" class="border-t border-white/10 pt-4">
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
                                <dd>{{ formatDate(project?.createdAt) }}</dd>
                            </div>
                            <div class="flex justify-between">
                                <dt class="text-gray-400">Updated</dt>
                                <dd>{{ formatDate(project?.updatedAt) }}</dd>
                            </div>
                            <div class="flex justify-between">
                                <dt class="text-gray-400">Setup Type</dt>
                                <dd>{{ setupType }}</dd>
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
import { useRoute } from "vue-router";
import ActivityTimeline from "../components/ActivityTimeline.vue";
import VueMarkdown from 'vue-markdown-render'

type ProjectPhase = "DESIGN" | "PLANNING" | "DEVELOPMENT" | "COMPLETED";

type ProjectRecord = {
    id: string;
    name: string;
    path: string;
    phase: ProjectPhase;
    data?: unknown;
    setup: boolean;
    active: boolean;
    createdAt: string;
    updatedAt: string;
};

type EventRecord = { id: string; type: string; data: any; timestamp: string };

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const project = ref<ProjectRecord | null>(null);
const events = ref<EventRecord[]>([]);
const loading = ref(false);
const eventsLoading = ref(false);
const error = ref<string | null>(null);
const copied = ref(false);

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "–");
const formattedData = computed(() => (project.value?.data ? JSON.stringify(project.value.data, null, 2) : "None"));
const setupType = computed(() => {
    const data = project.value?.data as any;
    return data?.setupType ?? "–";
});
const masterPrompt = computed(() => {
    const data = project.value?.data as any;
    return typeof data?.masterPrompt === "string" ? data.masterPrompt : "";
});
const hasMasterPrompt = computed(() => masterPrompt.value.trim().length > 0);

const phaseBadge = computed(() => {
    switch (project.value?.phase) {
        case "DESIGN":
            return "bg-sky-400/10 text-sky-200 ring-sky-400/30";
        case "PLANNING":
            return "bg-amber-400/10 text-amber-200 ring-amber-400/30";
        case "DEVELOPMENT":
            return "bg-indigo-400/10 text-indigo-200 ring-indigo-400/30";
        case "COMPLETED":
            return "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30";
        default:
            return "bg-white/10 text-white ring-white/20";
    }
});

const copyId = async () => {
    if (!project.value?.id) return;
    try {
        await navigator.clipboard.writeText(project.value.id);
        copied.value = true;
        setTimeout(() => (copied.value = false), 1200);
    } catch (err) {
        console.error(err);
    }
};

const fetchProject = async () => {
    try {
        loading.value = true;
        error.value = null;
        const response = await fetch(`/api/codebase/${projectId.value}`);
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to load project");
        }
        project.value = payload.data?.codebase ?? null;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
};

const fetchEvents = async () => {
    if (!projectId.value) return;
    try {
        eventsLoading.value = true;
        const response = await fetch(`/api/events?codebaseId=${projectId.value}&limit=50`);
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
    await fetchProject();
    await fetchEvents();
});
</script>
