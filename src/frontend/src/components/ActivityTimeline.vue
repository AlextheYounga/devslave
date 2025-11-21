<template>
    <div class="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-lg max-h-[45vh] overflow-y-auto">
        <div class="flex items-center justify-between">
            <h2 class="text-sm/6 font-semibold text-white">Activity</h2>
            <button
                type="button"
                class="text-xs font-semibold text-gray-300 hover:text-white"
                :disabled="loading"
                @click="$emit('refresh')"
            >
                {{ loading ? "Refreshing…" : "Refresh" }}
            </button>
        </div>
        <div v-if="loading" class="mt-3 text-xs text-gray-400">Loading events…</div>
        <ul v-else class="mt-6 space-y-6">
            <li v-for="(event, idx) in events" :key="event.id" class="relative flex gap-x-4">
                <div
                    :class="[
                        idx === events.length - 1 ? 'h-6' : '-bottom-8',
                        'absolute left-0 top-8 flex w-6 justify-center',
                    ]"
                >
                    <div class="w-px bg-white/10"></div>
                </div>
                <div class="relative flex mt-2 size-6 flex-none items-center justify-center">
                    <div class="size-1.5 rounded-full bg-white/10 ring-1 ring-white/20"></div>
                </div>
                <div class="flex-auto py-0.5 text-xs/5 text-gray-400">
                    <div class="flex items-center justify-between gap-x-4">
                        <span class="font-semibold text-white">{{ event.type }}</span>
                        <span>{{ formatDate(event.timestamp) }}</span>
                    </div>
                </div>
            </li>
            <li v-if="!events.length" class="text-sm text-gray-400">No recent events.</li>
        </ul>
    </div>
</template>

<script setup lang="ts">
type EventRecord = {
    id: string;
    type: string;
    timestamp: string;
};

defineProps<{
    events: EventRecord[];
    loading: boolean;
}>();

defineEmits<{
    (e: "refresh"): void;
}>();

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "–");
</script>
