<template>
    <main class="min-h-screen bg-black text-white">
        <section
            class="relative isolate overflow-hidden border-b border-white/10 bg-linear-to-br from-indigo-900/40 to-gray-900/40 px-4 pb-10 pt-16 sm:px-6 lg:px-8"
        >
            <div class="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
                <div class="space-y-2">
                    <p class="text-sm font-semibold text-gray-400">Event</p>
                    <h1 class="text-2xl font-semibold text-white">{{ eventRecord?.type || "Event detail" }}</h1>
                    <p class="text-sm text-gray-300">ID: {{ eventRecord?.id ?? eventId }}</p>
                    <p v-if="error" class="text-sm text-rose-300">{{ error }}</p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <span
                        v-if="eventRecord"
                        class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset"
                        :class="statusBadge"
                    >
                        {{ statusLabel }}
                    </span>
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
                        <span class="text-xs text-gray-400">Captured {{ formatDate(eventRecord?.timestamp) }}</span>
                    </div>
                    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm text-gray-300">
                        <div>
                            <dt class="text-gray-400">Type</dt>
                            <dd class="font-semibold text-white">{{ eventRecord?.type ?? "–" }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Parent ID</dt>
                            <dd class="font-semibold text-white">{{ eventRecord?.parentId ?? "–" }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Event ID</dt>
                            <dd class="font-semibold text-white">{{ eventRecord?.id ?? "–" }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-400">Status</dt>
                            <dd>
                                <span
                                    class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset"
                                    :class="statusBadge"
                                >
                                    {{ statusLabel }}
                                </span>
                            </dd>
                        </div>
                    </dl>

                    <div class="border-t border-white/10 pt-4">
                        <h3 class="text-sm font-semibold text-white">Payload</h3>
                        <pre
                            class="mt-2 max-h-[420px] overflow-auto rounded-lg bg-black/40 p-3 text-xs text-gray-200"
                            >{{ formattedData }}</pre
                        >
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-lg">
                        <h2 class="text-sm/6 font-semibold text-white">Snapshot</h2>
                        <dl class="mt-4 space-y-2 text-sm text-gray-300">
                            <div class="flex justify-between">
                                <dt class="text-gray-400">Event ID</dt>
                                <dd class="text-right">{{ eventRecord?.id ?? "–" }}</dd>
                            </div>
                            <div class="flex justify-between">
                                <dt class="text-gray-400">Parent</dt>
                                <dd class="text-right">{{ eventRecord?.parentId ?? "–" }}</dd>
                            </div>
                            <div class="flex justify-between">
                                <dt class="text-gray-400">Timestamp</dt>
                                <dd class="text-right">{{ formatDate(eventRecord?.timestamp) }}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

type EventRecord = {
    id: string;
    parentId?: string | null;
    type: string;
    data?: unknown;
    timestamp: string;
};

const route = useRoute();
const eventId = computed(() => route.params.id as string);

const eventRecord = ref<EventRecord | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const copied = ref(false);

const statusLabel = computed(() =>
    eventRecord.value && /fail/i.test(eventRecord.value.type) ? "Failed" : "Successful",
);
const statusBadge = computed(() =>
    statusLabel.value === "Failed"
        ? "bg-rose-400/10 text-rose-200 ring-rose-400/30"
        : "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
);
const formattedData = computed(() =>
    eventRecord.value?.data ? JSON.stringify(eventRecord.value.data, null, 2) : "No payload captured.",
);

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "–");

const copyId = async () => {
    const id = eventRecord.value?.id ?? eventId.value;
    if (!id) return;
    try {
        await navigator.clipboard.writeText(id);
        copied.value = true;
        setTimeout(() => (copied.value = false), 1200);
    } catch (err) {
        console.error(err);
    }
};

const fetchEvent = async () => {
    if (!eventId.value) return;
    try {
        loading.value = true;
        error.value = null;
        const response = await fetch(`/api/events?query=${encodeURIComponent(eventId.value)}&limit=1`);
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to load event");
        }
        const [first] = payload.data?.events ?? [];
        if (!first) {
            throw new Error("Event not found");
        }
        eventRecord.value = first;
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
};

onMounted(async () => {
    await fetchEvent();
});
</script>
