import { createFileRoute } from "@tanstack/react-router";
import { loadBoard } from "@/lib/cot/cftc.server";
import { sendPushToAll } from "@/lib/cot/push.functions";

export const Route = createFileRoute("/api/push/cron")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.PUSH_CRON_SECRET?.trim();
        const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
        if (!expected || provided !== expected) return new Response("Unauthorized", { status: 401 });

        const board = await loadBoard(true);
        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        const inserted = await sql.query<{ as_of: string }>(
          "insert into push_runs (as_of) values ($1) on conflict (as_of) do nothing returning as_of",
          [board.asOf],
        );
        if (!inserted.length) return Response.json({ ok: true, skipped: true, asOf: board.asOf });

        const result = await sendPushToAll(JSON.stringify({
          title: "Oak & Ledger · new COT print",
          body: `The ${board.asOf} positioning snapshot is ready to review.`,
          tag: `cot-${board.asOf}`,
        }));
        return Response.json({ ok: true, asOf: board.asOf, ...result });
      },
    },
  },
});
