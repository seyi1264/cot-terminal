import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getCotBoard = createServerFn({ method: "POST" })
  .validator(z.object({ force: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const { loadBoard } = await import("./cftc.server.ts");
    return loadBoard(Boolean(data.force));
  });

export const getCotInstrumentHistory = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().regex(/^\d{6}$/) }))
  .handler(async ({ data }) => {
    const { loadInstrumentHistory } = await import("./cftc.server.ts");
    return loadInstrumentHistory(data.code);
  });
