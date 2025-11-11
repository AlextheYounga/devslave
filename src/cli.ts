#!/usr/bin/env tsx

import { startCli } from "./cli/index";

startCli().catch((error) => {
    console.error("\n❌ CLI failed to start:", error);
    process.exit(1);
});
