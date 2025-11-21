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
                        <p class="text-sm font-semibold text-gray-400">Projects</p>
                        <h1 class="text-xl font-semibold text-white">Active codebases</h1>
                        <p class="mt-1 text-sm text-gray-400">Browse tracked repositories and their current phase.</p>
                        <p v-if="lastUpdated" class="mt-2 text-xs text-gray-500">
                            Updated {{ formatTimestamp(lastUpdated) }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
                        :disabled="loading"
                        @click="fetchProjects"
                    >
                        <ArrowPathIcon class="size-4" :class="loading ? 'animate-spin' : ''" aria-hidden="true" />
                        <span>{{ loading ? "Refreshing…" : "Refresh" }}</span>
                    </button>
                </div>
            </div>
        </header>

        <section class="px-4 pb-10 sm:px-6 lg:px-8">
            <p v-if="error" class="mt-4 text-sm text-rose-300">{{ error }}</p>
            <p v-else-if="loading" class="mt-6 text-sm text-gray-300">Loading projects…</p>

            <div
                v-else-if="!hasProjects"
                class="mt-6 rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-gray-400 sm:px-6 lg:px-8"
            >
                <p class="font-semibold text-white">No projects found.</p>
                <p class="mt-2 text-sm text-gray-400">Set up a codebase to see it appear here.</p>
            </div>

            <div v-else class="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-gray-900/60 shadow-lg">
                <table class="min-w-full divide-y divide-white/10">
                    <thead class="bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                        <tr>
                            <th scope="col" class="px-4 py-3 sm:px-6 lg:px-8">Name</th>
                            <th scope="col" class="px-3 py-3">Phase</th>
                            <th scope="col" class="px-3 py-3">Path</th>
                            <th scope="col" class="px-3 py-3">Updated</th>
                            <th scope="col" class="px-3 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-sm">
                        <tr v-for="project in projects" :key="project.id" class="text-gray-200">
                            <td class="px-4 py-4 sm:px-6 lg:px-8">
                                <div class="flex items-center gap-3">
                                    <FolderIcon class="size-5 text-indigo-300" aria-hidden="true" />
                                    <div>
                                        <RouterLink
                                            :to="`/projects/${project.id}`"
                                            class="font-semibold text-white hover:text-indigo-200"
                                        >
                                            {{ project.name }}
                                        </RouterLink>
                                        <div class="text-xs text-gray-400">{{ project.id }}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-3 py-4">
                                <span
                                    class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset"
                                    :class="phaseBadgeClasses[project.phase] || defaultBadgeClass"
                                >
                                    {{ project.phase }}
                                </span>
                            </td>
                            <td class="px-3 py-4">
                                <p class="truncate text-sm text-gray-200">{{ project.path }}</p>
                            </td>
                            <td class="px-3 py-4 text-sm text-gray-300">{{ formatDate(project.updatedAt) }}</td>
                            <td class="px-3 py-4 text-right">
                                <Menu as="div" class="relative inline-block text-left">
                                    <MenuButton
                                        class="inline-flex items-center rounded-md p-1 text-gray-300 hover:bg-white/10 hover:text-white focus:outline-none"
                                        :disabled="actionLoadingId === project.id"
                                    >
                                        <EllipsisVerticalIcon class="size-5" aria-hidden="true" />
                                    </MenuButton>
                                    <transition
                                        enter-active-class="transition ease-out duration-100"
                                        enter-from-class="transform opacity-0 scale-95"
                                        enter-to-class="transform opacity-100 scale-100"
                                        leave-active-class="transition ease-in duration-75"
                                        leave-from-class="transform opacity-100 scale-100"
                                        leave-to-class="transform opacity-0 scale-95"
                                    >
                                        <MenuItems
                                            class="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-gray-800 py-2 shadow-lg outline-1 -outline-offset-1 outline-white/10"
                                        >
                                            <MenuItem v-slot="{ active }">
                                                <RouterLink
                                                    :to="`/projects/${project.id}`"
                                                    :class="[
                                                        active ? 'bg-white/5 text-white' : 'text-gray-200',
                                                        'block px-3 py-1.5 text-sm font-semibold',
                                                    ]"
                                                >
                                                    View Details
                                                </RouterLink>
                                            </MenuItem>
                                            <MenuItem v-slot="{ active }">
                                                <button
                                                    type="button"
                                                    :class="[
                                                        active ? 'bg-white/5 text-white' : 'text-gray-200',
                                                        'block w-full px-3 py-1.5 text-left text-sm font-semibold',
                                                    ]"
                                                    @click="viewTickets(project)"
                                                >
                                                    View Tickets
                                                </button>
                                            </MenuItem>
                                            <MenuItem v-slot="{ active }">
                                                <button
                                                    type="button"
                                                    :disabled="actionLoadingId === project.id"
                                                    :class="[
                                                        active ? 'bg-white/5 text-white' : 'text-gray-200',
                                                        'block w-full px-3 py-1.5 text-left text-sm font-semibold disabled:opacity-50',
                                                    ]"
                                                    @click="cloneProject(project)"
                                                >
                                                    <span v-if="actionLoadingId === project.id">Cloning…</span>
                                                    <span v-else>Clone Project</span>
                                                </button>
                                            </MenuItem>
                                        </MenuItems>
                                    </transition>
                                </Menu>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p v-if="actionError" class="mt-4 text-sm text-rose-300">{{ actionError }}</p>
        </section>
    </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { Bars3Icon } from "@heroicons/vue/20/solid";
import { ArrowPathIcon, EllipsisVerticalIcon, FolderIcon } from "@heroicons/vue/24/outline";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";

export type ProjectPhase = "DESIGN" | "PLANNING" | "DEVELOPMENT" | "COMPLETED";

export type ProjectRecord = {
    id: string;
    name: string;
    path: string;
    phase: ProjectPhase;
    createdAt: string;
    updatedAt: string;
};

const emit = defineEmits<{
    (e: "open-sidebar"): void;
}>();
const router = useRouter();

const projects = ref<ProjectRecord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const lastUpdated = ref<Date | null>(null);
const actionLoadingId = ref<string | null>(null);
const actionError = ref<string | null>(null);

const phaseBadgeClasses: Record<ProjectPhase, string> = {
    DESIGN: "bg-sky-400/10 text-sky-200 ring-sky-400/30",
    PLANNING: "bg-amber-400/10 text-amber-200 ring-amber-400/30",
    DEVELOPMENT: "bg-indigo-400/10 text-indigo-200 ring-indigo-400/30",
    COMPLETED: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
};
const defaultBadgeClass = "bg-white/5 text-gray-200 ring-white/20";

const hasProjects = computed(() => projects.value.length > 0);
const formatTimestamp = (value: Date) => value.toLocaleTimeString();
const formatDate = (value: string) => new Date(value).toLocaleString();
const fetchProjects = async () => {
    try {
        loading.value = true;
        error.value = null;
        const response = await fetch("/api/codebases");
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to load projects");
        }
        projects.value = payload.data?.codebases ?? [];
        lastUpdated.value = new Date();
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
};

const viewTickets = (project: ProjectRecord) => {
    router.push({ path: "/tickets", query: { codebaseId: project.id } });
};

const cloneProject = async (project: ProjectRecord) => {
    if (actionLoadingId.value) return;
    actionError.value = null;
    try {
        actionLoadingId.value = project.id;
        const response = await fetch(`/api/codebase/${project.id}/clone`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to clone project");
        }
    } catch (err) {
        actionError.value = err instanceof Error ? err.message : String(err);
    } finally {
        actionLoadingId.value = null;
    }
};

onMounted(() => {
    fetchProjects();
});
</script>
