import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2_000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

export const getPushPublicKey = createServerFn({ method: "GET" }).handler(() => {
  const key = process.env.VAPID_PUBLIC_KEY?.trim();
  return { key: key || null };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(subscriptionSchema)
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`
      insert into push_subscriptions (id, user_id, endpoint, p256dh, auth)
      values (${id}, ${context.userId}, ${data.endpoint}, ${data.keys.p256dh}, ${data.keys.auth})
      on conflict (endpoint) do update set
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        updated_at = now()
    `;
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ endpoint: z.string().url().max(2_000) }))
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`delete from push_subscriptions where endpoint = ${data.endpoint} and user_id = ${context.userId}`;
    return { ok: true };
  });

export async function sendPushToUsers(userIds: string[], payload: string) {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject || !userIds.length) return { sent: 0, configured: false };

  const webpush = await import("web-push");
  webpush.default.setVapidDetails(subject, publicKey, privateKey);
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const subscriptions = await sql.query<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>("select id, endpoint, p256dh, auth from push_subscriptions where user_id = any($1)", [userIds]);

  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.default.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
      );
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await sql`delete from push_subscriptions where id = ${subscription.id}`;
      }
    }
  }
  return { sent, configured: true };
}
