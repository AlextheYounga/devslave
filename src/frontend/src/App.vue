<template>
    <div>
        <TransitionRoot as="template" :show="sidebarOpen">
            <Dialog class="relative z-50 xl:hidden" @close="sidebarOpen = false">
                <TransitionChild
                    as="template"
                    enter="transition-opacity ease-linear duration-300"
                    enter-from="opacity-0"
                    enter-to=""
                    leave="transition-opacity ease-linear duration-300"
                    leave-from=""
                    leave-to="opacity-0"
                >
                    <div class="fixed inset-0 bg-gray-900/80"></div>
                </TransitionChild>

                <div class="fixed inset-0 flex">
                    <TransitionChild
                        as="template"
                        enter="transition ease-in-out duration-300 transform"
                        enter-from="-translate-x-full"
                        enter-to="translate-x-0"
                        leave="transition ease-in-out duration-300 transform"
                        leave-from="translate-x-0"
                        leave-to="-translate-x-full"
                    >
                        <DialogPanel class="relative mr-16 flex w-full max-w-xs flex-1">
                            <TransitionChild
                                as="template"
                                enter="ease-in-out duration-300"
                                enter-from="opacity-0"
                                enter-to=""
                                leave="ease-in-out duration-300"
                                leave-from=""
                                leave-to="opacity-0"
                            >
                                <div class="absolute left-full top-0 flex w-16 justify-center pt-5">
                                    <button type="button" class="-m-2.5 p-2.5" @click="sidebarOpen = false">
                                        <span class="sr-only">Close sidebar</span>
                                        <XMarkIcon class="size-6 text-white" aria-hidden="true" />
                                    </button>
                                </div>
                            </TransitionChild>

                            <SideNavigation :active="activeView" @navigate="handleNavigate" />
                        </DialogPanel>
                    </TransitionChild>
                </div>
            </Dialog>
        </TransitionRoot>

        <!-- Static sidebar for desktop -->
        <div class="hidden bg-gray-900 xl:fixed xl:inset-y-0 xl:z-50 xl:flex xl:w-72 xl:flex-col">
            <div class="flex grow flex-col gap-y-5 overflow-y-auto bg-black/10 ring-1 ring-white/5">
                <SideNavigation :active="activeView" @navigate="handleNavigate" />
            </div>
        </div>

        <div class="xl:pl-72">
            <component
                :is="CurrentView"
                :key="componentKey"
                @open-sidebar="sidebarOpen = true"
                @view-tickets="handleViewTickets"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Dialog, DialogPanel, TransitionChild, TransitionRoot } from "@headlessui/vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import SideNavigation from "./components/SideNavigation.vue";
import AgentsView from "./views/AgentsView.vue";
import ProjectsView from "./views/ProjectsView.vue";
import TicketsView from "./views/TicketsView.vue";

const sidebarOpen = ref(false);
const activeView = ref<"projects" | "agents" | "tickets">("agents");
const ticketsReloadKey = ref(0);

const viewMap = {
    projects: ProjectsView,
    agents: AgentsView,
    tickets: TicketsView,
};

const CurrentView = computed(() => viewMap[activeView.value] ?? AgentsView);
const componentKey = computed(() =>
    activeView.value === "tickets" ? `${activeView.value}-${ticketsReloadKey.value}` : activeView.value,
);

const handleNavigate = (target: "projects" | "agents" | "tickets" | "activity" | "settings") => {
    if (target === "activity" || target === "settings") return;
    activeView.value = target;
    sidebarOpen.value = false;
};

const updateTicketQueryParam = (codebaseId?: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (codebaseId) {
        params.set("codebaseId", codebaseId);
    } else {
        params.delete("codebaseId");
    }
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
};

const handleViewTickets = (codebaseId?: string | null) => {
    updateTicketQueryParam(codebaseId ?? null);
    activeView.value = "tickets";
    ticketsReloadKey.value += 1;
    sidebarOpen.value = false;
};
</script>
