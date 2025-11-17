import express from "express";
import cors from "cors";
import path from "path";
import { existsSync } from "fs";
import routes from "./routes";
import { prisma } from "./prisma";
import { loadEnv } from "./constants";

loadEnv();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/", routes);

const frontendDistPath = path.resolve(__dirname, "../frontend/dist");
const frontendIndex = path.join(frontendDistPath, "index.html");
const hasFrontendBuild = existsSync(frontendIndex);

if (hasFrontendBuild) {
    app.use(express.static(frontendDistPath));
    app.get(/^(?!\/api|\/health).*/, (req, res) => {
        res.sendFile(frontendIndex);
    });
} else {
    console.warn("Dashboard build not found. Run `npm run frontend:build` to generate assets.");
}

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("Received SIGTERM, shutting down gracefully");
    await prisma.$disconnect();
    process.exit(0);
});

process.on("SIGINT", async () => {
    console.log("Received SIGINT, shutting down gracefully");
    await prisma.$disconnect();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`API server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
});
