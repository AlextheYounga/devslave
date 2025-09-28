import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes";
import { prisma } from "./prisma";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/", routes);

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
