import "dotenv/config";
import { createServer } from "node:http";
import { app } from "./app.js";
import { createRealtimeServer } from "./realtime.js";
const port = Number(process.env.PORT ?? 4000);

const httpServer = createServer(app);
createRealtimeServer(httpServer);

httpServer.listen(port, () => {
  console.log(`NCPOR backend listening on http://localhost:${port}`);
});
