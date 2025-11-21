<template>
    <main class="min-h-screen bg-black text-white">
        <section
            class="relative isolate overflow-hidden border-b border-white/10 bg-linear-to-br from-orange-900/40 to-gray-900/40 px-4 pb-10 pt-16 sm:px-6 lg:px-8"
        >
            <div class="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
                <div class="space-y-2">
                    <p class="text-sm font-semibold text-gray-200">Workflows</p>
                    <h1 class="text-2xl font-semibold text-white">Start master workflow</h1>
                    <p class="text-sm text-gray-200">Same payload the CLI sends to n8n.</p>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-400">
                    <span
                        class="rounded-full bg-orange-500/20 px-3 py-1 font-semibold text-orange-200 ring-1 ring-inset ring-orange-400/40"
                    >
                        Master Workflow
                    </span>
                </div>
            </div>
        </section>

        <section class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
            <div class="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-base font-semibold text-white">Workflow configuration</h2>
                        <p class="text-sm text-gray-400">Pick a codebase, optional model, and debug toggle.</p>
                    </div>
                    <span v-if="successMessage" class="text-sm font-semibold text-emerald-300">
                        {{ successMessage }}
                    </span>
                </div>

                <p v-if="preflightError" class="mt-4 text-sm text-rose-300">{{ preflightError }}</p>
                <p v-else-if="loading" class="mt-4 text-sm text-gray-300">Loading options…</p>

                <form v-else class="mt-6 space-y-6" @submit.prevent="handleSubmit">
                    <p v-if="!codebases.length" class="text-sm text-amber-300">
                        No codebases available. Create a project before starting a workflow.
                    </p>
                    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div class="space-y-2">
                            <label class="text-sm font-medium text-white" for="codebase"> Codebase </label>
                            <select
                                id="codebase"
                                v-model="codebaseId"
                                class="w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 *:bg-gray-800 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-orange-500"
                                required
                            >
                                <option value="" disabled>Select a codebase</option>
                                <option v-for="cb in codebases" :key="cb.id" :value="cb.id">
                                    {{ cb.name }} ({{ cb.path }})
                                </option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-sm font-medium text-white" for="model">Ollama model (optional)</label>
                            <select
                                id="model"
                                v-model="model"
                                class="w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 *:bg-gray-800 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-orange-500"
                            >
                                <option value="">Use default</option>
                                <option v-for="name in models" :key="name" :value="name">{{ name }}</option>
                            </select>
                        </div>
                        <div class="flex items-center gap-3 sm:col-span-2">
                            <input
                                id="debugMode"
                                v-model="debugMode"
                                type="checkbox"
                                class="size-4 rounded border-white/10 bg-gray-900 text-orange-500 focus:ring-orange-500"
                            />
                            <label for="debugMode" class="text-sm text-white">Enable debug mode</label>
                        </div>
                    </div>

                    <div class="flex items-center justify-between">
                        <RouterLink
                            to="/agents"
                            class="rounded-md px-3 py-2 text-sm font-semibold text-gray-200 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                        >
                            Cancel
                        </RouterLink>
                        <button
                            type="submit"
                            class="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-60"
                            :disabled="submitLoading || !codebaseId"
                        >
                            {{ submitLoading ? "Starting…" : "Start workflow" }}
                        </button>
                    </div>

                    <p v-if="error" class="text-sm text-rose-300">{{ error }}</p>
                </form>
            </div>
        </section>
    </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

type CodebaseSummary = {
    id: string;
    name: string;
    path: string;
};

type PreflightResponse = {
    codebases: CodebaseSummary[];
    models: { name?: string; model?: string }[];
};

const router = useRouter();

const codebases = ref<CodebaseSummary[]>([]);
const models = ref<string[]>([]);
const codebaseId = ref("");
const model = ref("");
const debugMode = ref(false);
const loading = ref(false);
const submitLoading = ref(false);
const error = ref<string | null>(null);
const preflightError = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const normalizeModels = (list: PreflightResponse["models"]) => {
    const names = list.map((entry) => entry.name || entry.model).filter((val): val is string => Boolean(val));
    return Array.from(new Set(names));
};

const fetchPreflight = async () => {
    try {
        loading.value = true;
        preflightError.value = null;
        const response = await fetch("/api/workflows/preflight");
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Preflight failed");
        }
        const data = (payload.data ?? {}) as PreflightResponse;
        codebases.value = data.codebases || [];
        models.value = normalizeModels(data.models || []);
        if (codebases.value.length) {
            codebaseId.value = codebases.value[0]?.id ?? "";
        }
    } catch (err) {
        preflightError.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
};

const handleSubmit = async () => {
    if (!codebaseId.value) {
        error.value = "Select a codebase.";
        return;
    }
    try {
        submitLoading.value = true;
        error.value = null;
        successMessage.value = null;
        const response = await fetch("/api/workflows/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                codebaseId: codebaseId.value,
                model: model.value || undefined,
                debugMode: debugMode.value,
            }),
        });
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Failed to start workflow");
        }
        successMessage.value = "Workflow triggered. Redirecting to Agents…";
        setTimeout(() => router.push("/agents"), 900);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        submitLoading.value = false;
    }
};

onMounted(async () => {
    await fetchPreflight();
});
</script>
