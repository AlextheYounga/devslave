<template>
    <div
        class="relative flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 ring ring-white/10 before:pointer-events-none before:absolute before:inset-0 before:bg-black/10"
    >
        <div class="relative flex h-20 mt-4 shrink-0 items-center">
            <img class="h-20 w-auto" src="../images/logo.png" alt="Devslave" />
            <h1>DEVSLAVE</h1>
        </div>

        <nav class="relative flex flex-1 flex-col">
            <ul role="list" class="flex flex-1 flex-col gap-y-7">
                <li>
                    <ul role="list" class="-mx-2 space-y-1">
                        <li v-for="item in navigation" :key="item.name">
                            <button
                                v-if="item.clickable"
                                type="button"
                                :class="[
                                    isActive(item.key)
                                        ? 'bg-white/5 text-white'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-white',
                                    'group flex w-full gap-x-3 rounded-md p-2 text-left text-sm/6 font-semibold',
                                ]"
                                @click="emit('navigate', item.key)"
                            >
                                <component
                                    :is="item.icon"
                                    :class="[
                                        isActive(item.key) ? 'text-white' : 'text-gray-400 group-hover:text-white',
                                        'size-6 shrink-0',
                                    ]"
                                    aria-hidden="true"
                                />
                                {{ item.name }}
                            </button>
                            <div
                                v-else
                                class="group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold text-gray-600"
                                aria-disabled="true"
                            >
                                <component :is="item.icon" class="size-6 shrink-0 text-gray-600" aria-hidden="true" />
                                {{ item.name }}
                            </div>
                        </li>
                    </ul>
                </li>

                <li>
                    <div class="text-xs/6 font-semibold text-gray-400">Utilities</div>

                    <div class="-mx-2 mt-2 space-y-1">
                        <a
                            :href="n8nUrl"
                            target="_blank"
                            rel="noreferrer"
                            class="group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold text-gray-400 hover:bg-white/5 hover:text-white"
                        >
                            <span
                                class="flex size-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[0.625rem] font-medium text-gray-300"
                                >n8n</span
                            >
                            <span class="truncate">Open n8n</span>
                        </a>
                        <button
                            type="button"
                            class="group flex w-full gap-x-3 rounded-md p-2 text-left text-sm/6 font-semibold text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                            :disabled="utilityLoading !== null"
                            @click="runUtilityAction('app-shell')"
                        >
                            <span
                                class="flex size-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[0.625rem] font-medium text-gray-300"
                                >sh</span
                            >
                            <span class="truncate">
                                <span v-if="utilityLoading === 'app-shell'">Opening shell…</span>
                                <span v-else>Open App Shell</span>
                            </span>
                        </button>
                        <button
                            type="button"
                            class="group flex w-full gap-x-3 rounded-md p-2 text-left text-sm/6 font-semibold text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                            :disabled="utilityLoading !== null"
                            @click="runUtilityAction('open-vscode')"
                        >
                            <span
                                class="flex size-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[0.625rem] font-medium text-gray-300"
                                >VS</span
                            >
                            <span class="truncate">
                                <span v-if="utilityLoading === 'open-vscode'"> Opening VS Code… </span>
                                <span v-else>Open VS Code</span>
                            </span>
                        </button>
                        <button
                            type="button"
                            class="group flex w-full gap-x-3 rounded-md p-2 text-left text-sm/6 font-semibold text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                            :disabled="utilityLoading !== null"
                            @click="runUtilityAction('codex-login')"
                        >
                            <span
                                class="flex size-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[0.625rem] font-medium text-gray-300"
                                >CX</span
                            >
                            <span class="truncate">
                                <span v-if="utilityLoading === 'codex-login'">Logging in…</span>
                                <span v-else>Login to Codex</span>
                            </span>
                        </button>
                    </div>
                    <p
                        v-if="utilityNotice"
                        class="mt-3 text-xs/6"
                        :class="utilityNotice.type === 'error' ? 'text-rose-300' : 'text-emerald-300'"
                    >
                        {{ utilityNotice.message }}
                    </p>
                </li>

                <li class="-mx-6 mt-auto">
                    <a
                        href="#"
                        class="flex items-center gap-x-4 px-6 py-3 text-sm/6 font-semibold text-white hover:bg-white/5"
                    >
                        <img
                            class="size-8 rounded-full bg-gray-800 outline outline-1 -outline-offset-1 outline-white/10"
                            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                            alt=""
                        />
                        <span class="sr-only">Your profile</span>
                        <span aria-hidden="true">Tom Cook</span>
                    </a>
                </li>
            </ul>
        </nav>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { Cog6ToothIcon, FolderIcon, ServerIcon, SignalIcon, TicketIcon } from "@heroicons/vue/24/outline";

type UtilityAction = "app-shell" | "open-vscode" | "codex-login";
type UtilityNotice = {
    type: "success" | "error";
    message: string;
};

type NavigationKey = "projects" | "agents" | "tickets" | "activity" | "settings";
type NavigationItem = {
    name: string;
    key: NavigationKey;
    icon: any;
    clickable: boolean;
};

const emit = defineEmits<{
    (e: "navigate", key: NavigationKey): void;
}>();

const navigation: NavigationItem[] = [
    { name: "Projects", key: "projects", icon: FolderIcon, clickable: true },
    { name: "Agents", key: "agents", icon: ServerIcon, clickable: true },
    { name: "Tickets", key: "tickets", icon: TicketIcon, clickable: true },
    { name: "Activity", key: "activity", icon: SignalIcon, clickable: false },
    { name: "Settings", key: "settings", icon: Cog6ToothIcon, clickable: false },
];

const n8nUrl = "https://localhost:5678";
const utilityLoading = ref<UtilityAction | null>(null);
const utilityNotice = ref<UtilityNotice | null>(null);
const route = useRoute();

const isActive = (key: NavigationKey) => {
    const path = route.path || "";
    return path.startsWith(`/${key}`);
};

const utilityEndpoints: Record<UtilityAction, string> = {
    "app-shell": "/api/utilities/app-shell",
    "open-vscode": "/api/utilities/open-vscode",
    "codex-login": "/api/utilities/codex-login",
};

const runUtilityAction = async (action: UtilityAction) => {
    if (utilityLoading.value) return;
    utilityLoading.value = action;
    utilityNotice.value = null;
    try {
        const response = await fetch(utilityEndpoints[action], { method: "POST" });
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
            throw new Error(payload.error ?? "Utility action failed");
        }
        utilityNotice.value = {
            type: "success",
            message: payload.message ?? "Utility action completed.",
        };
    } catch (err) {
        utilityNotice.value = {
            type: "error",
            message: err instanceof Error ? err.message : String(err),
        };
    } finally {
        utilityLoading.value = null;
    }
};
</script>
