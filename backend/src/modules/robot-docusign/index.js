import routes from "./routes.js";
import seletorApiRobot, { trigger, executeJob } from "./seletorApiRobot/index.js";
import browserrobot from "./browserrobot/index.js";
import robotScheduler from "./seletorApiRobot/robotScheduler.js";
import robotSession from "./browserrobot/robotSession.js";

export { routes, seletorApiRobot, browserrobot, robotScheduler, robotSession, trigger, executeJob };

/**
 * Robot DocuSign module facade exporting routes, orchestrator, session manager, scheduler, and submodules.
 */
export default {
  routes,
  orchestrator: seletorApiRobot,
  seletorApiRobot,
  browserrobot,
  session: robotSession,
  scheduler: robotScheduler,
  trigger,
  executeJob,
};
