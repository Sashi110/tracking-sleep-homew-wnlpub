import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerSleepRoutes } from './routes/sleep.js';
import { registerHomeworkRoutes } from './routes/homework.js';
import { registerChoresRoutes } from './routes/chores.js';

const schema = { ...appSchema, ...authSchema };

export const app = await createApplication(schema);
export type App = typeof app;

app.withAuth();

registerSleepRoutes(app);
registerHomeworkRoutes(app);
registerChoresRoutes(app);

await app.run();
app.logger.info('Application running');
