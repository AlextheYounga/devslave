import express from "express";
import cors from "cors";
import routes from "./routes";
import { JobQueue } from "./queue";
import { Worker } from "./worker";

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/", routes);

// Start worker
const queue = new JobQueue();
const worker = new Worker();
worker.process().catch((err) => {
  console.error("Worker encountered an error:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully");
  await queue.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully");
  await queue.close();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Job queue API server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});
