import { createRouter, createWebHistory } from "vue-router";
import AgentsIndexView from "./views/AgentsIndexView.vue";
import ProjectsIndexView from "./views/ProjectsIndexView.vue";
import TicketsIndexView from "./views/TicketsIndexView.vue";
import AgentView from "./views/AgentView.vue";
import ProjectView from "./views/ProjectView.vue";
import TicketView from "./views/TicketView.vue";

const routes = [
    { path: "/", redirect: "/agents" },
    { path: "/agents", name: "agents", component: AgentsIndexView },
    { path: "/agents/:id", name: "agent-detail", component: AgentView, props: true },
    { path: "/projects", name: "projects", component: ProjectsIndexView },
    { path: "/projects/:id", name: "project-detail", component: ProjectView, props: true },
    { path: "/tickets", name: "tickets", component: TicketsIndexView },
    { path: "/tickets/:id", name: "ticket-detail", component: TicketView, props: true },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
