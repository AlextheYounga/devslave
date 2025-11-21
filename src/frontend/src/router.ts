import { createRouter, createWebHistory } from "vue-router";
import AgentsIndexView from "./views/AgentsIndexView.vue";
import ProjectsIndexView from "./views/ProjectsIndexView.vue";
import TicketsIndexView from "./views/TicketsIndexView.vue";
import AgentView from "./views/AgentView.vue";
import ProjectView from "./views/ProjectView.vue";
import TicketView from "./views/TicketView.vue";
import ActivityIndexView from "./views/ActivityIndexView.vue";
import ActivityView from "./views/ActivityView.vue";
import CreateNewProjectFormView from "./views/CreateNewProjectFormView.vue";
import StartWorkflowFormView from "./views/StartWorkflowFormView.vue";

const routes = [
    { path: "/", redirect: "/agents" },
    { path: "/agents", name: "agents", component: AgentsIndexView },
    { path: "/agents/:id", name: "agent-detail", component: AgentView, props: true },
    { path: "/projects", name: "projects", component: ProjectsIndexView },
    { path: "/projects/new", name: "project-new", component: CreateNewProjectFormView },
    { path: "/projects/:id", name: "project-detail", component: ProjectView, props: true },
    { path: "/tickets", name: "tickets", component: TicketsIndexView },
    { path: "/tickets/:id", name: "ticket-detail", component: TicketView, props: true },
    { path: "/activity", name: "activity", component: ActivityIndexView },
    { path: "/activity/:id", name: "activity-detail", component: ActivityView, props: true },
    { path: "/agents/start-workflow", name: "workflow-start", component: StartWorkflowFormView },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
