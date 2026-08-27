import routes from "./routes.js";
import robotOrchestrator from "./services/robotOrchestrator.js";
import robotSession from "./services/robotSession.js";
import robotScheduler from "./services/robotScheduler.js";

/**
 * Robot DocuSign module facade exporting routes, orchestrator, session manager, and scheduler.
 */
export default {
  routes,
  orchestrator: robotOrchestrator,
  session: robotSession,
  scheduler: robotScheduler,
};

