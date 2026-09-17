import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getCotBoard = createServerFn({ method: "POST" })
  .validator(z.object({ force: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const { loadBoard } = await import("./cftc.server.ts");
    return loadBoard(Boolean(data.force));
  });
