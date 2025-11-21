import { createRouter, createWebHistory } from "vue-router";
import AgentsView from "./views/AgentsView.vue";
import ProjectsView from "./views/ProjectsView.vue";
import TicketsView from "./views/TicketsView.vue";
import AgentView from "./views/AgentView.vue";
import ProjectView from "./views/ProjectView.vue";
import TicketView from "./views/TicketView.vue";

const routes = [
    { path: "/", redirect: "/agents" },
    { path: "/agents", name: "agents", component: AgentsView },
    { path: "/agents/:id", name: "agent-detail", component: AgentView, props: true },
    { path: "/projects", name: "projects", component: ProjectsView },
    { path: "/projects/:id", name: "project-detail", component: ProjectView, props: true },
    { path: "/tickets", name: "tickets", component: TicketsView },
    { path: "/tickets/:id", name: "ticket-detail", component: TicketView, props: true },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
