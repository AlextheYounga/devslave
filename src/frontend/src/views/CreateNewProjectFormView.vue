<template>
    <main class="min-h-screen bg-black text-white">
        <section
            class="relative isolate overflow-hidden border-b border-white/10 bg-linear-to-br from-emerald-900/40 to-gray-900/40 px-4 pb-10 pt-16 sm:px-6 lg:px-8"
        >
            <div class="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
                <div class="space-y-2">
                    <p class="text-sm font-semibold text-gray-400">Projects</p>
                    <h1 class="text-2xl font-semibold text-white">Create a new project</h1>
                    <p class="text-sm text-gray-300">Set up a codebase for agents to work on.</p>
                </div>
            </div>
        </section>

        <section class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
            <form @submit.prevent="handleSubmit" class="space-y-6">
                <div class="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-lg">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-base font-semibold text-white">Project details</h2>
                            <p class="text-sm text-gray-400">Same flow used by the CLI create-project command.</p>
                        </div>
                        <span v-if="successMessage" class="text-sm font-semibold text-emerald-300">
                            {{ successMessage }}
                        </span>
                    </div>

                    <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div class="space-y-2">
                            <label class="text-sm font-medium text-white" for="project-name">Name</label>
                            <input
                                id="project-name"
                                v-model="name"
                                type="text"
                                class="w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-emerald-500"
                                placeholder="My Project"
                                required
                            />
                        </div>
                        <div class="space-y-2">
                            <label class="text-sm font-medium text-white" for="project-folder">Folder</label>
                            <input
                                id="project-folder"
                                v-model="folderName"
                                type="text"
                                class="w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-emerald-500"
                                placeholder="my-project"
                                required
                            />
                            <p class="text-xs text-gray-400">Relative to the /app/dev workspace.</p>
                        </div>
                        <div class="space-y-2">
                            <label class="text-sm font-medium text-white" for="setup">Setup type</label>
                            <select
                                id="setup"
                                v-model="setup"
                                class="w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 *:bg-gray-800 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-emerald-500"
                            >
                                <option v-for="option in setupOptions" :key="option" :value="option">
                                    {{ option }}
                                </option>
                            </select>
                        </div>
                        <div class="space-y-2 sm:col-span-2">
                            <label class="text-sm font-medium text-white" for="prompt">Master prompt</label>
                            <textarea
                                id="prompt"
                                v-model="prompt"
                                rows="6"
                                class="w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-emerald-500"
                                placeholder="High-level goals for agents..."
                                required
                            ></textarea>
                            <p class="text-xs text-gray-400">Used by the master workflow just like the CLI flow.</p>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-between">
                    <p class="text-sm text-gray-400">
                        Need to import an existing folder? Use the CLI for host-to-container import.
                    </p>
                    <div class="flex gap-3">
                        <RouterLink
                            to="/projects"
                            class="rounded-md px-3 py-2 text-sm font-semibold text-gray-200 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                        >
                            Cancel
                        </RouterLink>
                        <button
                            type="submit"
                            class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                            :disabled="loading"
                        >
                            {{ loading ? "Creating…" : "Create Project" }}
                        </button>
                    </div>
                </div>

                <p v-if="error" class="text-sm text-rose-300">{{ error }}</p>
            </form>
        </section>
    </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter, RouterLink } from "vue-router";

const setupOptions = ["default", "node", "python", "rust", "laravel", "vue"];

const router = useRouter();

const name = ref("");
const folderName = ref("");
const prompt = ref("");
const setup = ref(setupOptions[0]);
const loading = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const handleSubmit = async () => {
    if (!name.value.trim() || !folderName.value.trim() || !prompt.value.trim()) {
        error.value = "Name, folder, and master prompt are required.";
        return;
    }

    try {
        loading.value = true;
        error.value = null;
        successMessage.value = null;

        const response = await fetch("/api/codebase/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name.value.trim(),
                folderName: folderName.value.trim(),
                prompt: prompt.value.trim(),
                setup: setup.value,
            }),
        });
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to create project");
        }

        successMessage.value = `Project "${name.value.trim()}" created.`;
        setTimeout(() => router.push("/projects"), 900);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
};
</script>
