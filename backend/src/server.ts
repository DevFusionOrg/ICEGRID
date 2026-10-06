import "dotenv/config";
import { createServer } from "node:http";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 8780);

const httpServer = createServer(app);

httpServer.listen(port, () => {
  console.log(`NCPOR backend listening on http://localhost:${port}`);
});
