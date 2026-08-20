import routes from "./routes.js";
import robotOrchestrator from "./services/robotOrchestrator.js";
import robotSession from "./services/robotSession.js";
import robotScheduler from "./services/robotScheduler.js";

export default {
  routes,
  orchestrator: robotOrchestrator,
  session: robotSession,
  scheduler: robotScheduler,
};
