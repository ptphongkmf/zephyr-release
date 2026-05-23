import { VERSION } from "./version.ts";
import { logger } from "./tasks/logger.ts";
import { failedNonCriticalTasks, startTime } from "./main.ts";

export function markProcessStart() {
  logger.info(
    `🔹 Zephyr Release Started 🍃 • version: ${VERSION} • at: ${startTime.toISOString()}`,
  );
}

export function markProcessEnd(reason: "Finished" | "Failed" | "Exit") {
  const endTime = new Date();

  logger.info(
    `🔹 Zephyr Release ${reason} 🍃 • version: ${VERSION} • at: ${endTime.toISOString()} (took ${
      endTime.getTime() - startTime.getTime()
    }ms)`,
  );

  if (failedNonCriticalTasks.length > 0) {
    logger.startGroup(
      `⚠️ Collected ${failedNonCriticalTasks.length} non-critical errors:`,
    );

    logger.info([...failedNonCriticalTasks].sort().join("\n"));

    logger.endGroup();
  } else {
    logger.info("✔ No non-critical errors occurred");
  }
}
