import twilio from "twilio";
import { ApiError } from "@/lib/permissions";
import { SmsSetting } from "@/models/Settings";
import { decryptSecret } from "@/lib/secrets";

export async function sendConfiguredSms(input: { to: string; body: string }) {
  const setting: any = await SmsSetting.findOne().select("+auth_token").lean();
  if (
    !setting?.enabled ||
    !setting.account_sid ||
    !setting.auth_token ||
    !setting.from_number
  ) {
    throw new ApiError(503, "Twilio SMS is not enabled and fully configured");
  }
  const client = twilio(setting.account_sid, decryptSecret(setting.auth_token));
  const message = await client.messages.create({
    to: input.to,
    from: setting.from_number,
    body: input.body,
  });
  return message.sid;
}
