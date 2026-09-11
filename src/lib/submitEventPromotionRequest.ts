import type { EventFormPayload } from "@/services/api";

type RequestCampaignFn = (args: {
  bizId: string;
  plan_id: number;
  title: string;
  banner_image_url?: string;
  category?: string;
  target_type?: string;
  target_id?: string;
  start_date: string;
}) => { unwrap: () => Promise<unknown> };

/** After an event is saved/submitted, create the optional marketing campaign request. */
export async function submitEventPromotionRequest(opts: {
  bizId: string;
  eventId: string;
  payload: EventFormPayload;
  requestCampaign: RequestCampaignFn;
}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const promo = opts.payload.promotion_request;
  if (!promo?.plan_id || !promo.title?.trim() || !promo.start_date || !opts.bizId || !opts.eventId) {
    return { ok: true };
  }
  try {
    await opts
      .requestCampaign({
        bizId: opts.bizId,
        plan_id: promo.plan_id,
        title: promo.title.trim(),
        banner_image_url: promo.banner_image_url,
        category: "EVENTS",
        target_type: "EVENT",
        target_id: opts.eventId,
        start_date: promo.start_date,
      })
      .unwrap();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
