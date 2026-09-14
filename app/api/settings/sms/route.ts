import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import {
  requirePermission,
  requireSession,
  withErrorHandler,
} from "@/lib/permissions";
import { SmsSetting } from "@/models/Settings";
import { smsSettingSchema } from "@/lib/validation";
import { encryptSecret } from "@/lib/secrets";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  await requirePermission(user, "setting_system");
  await dbConnect();
  const setting: any = await SmsSetting.findOne().select("+auth_token").lean();
  if (!setting)
    return NextResponse.json({
      provider: "twilio",
      enabled: false,
      token_configured: false,
    });
  const tokenConfigured = Boolean(setting.auth_token);
  delete setting.auth_token;
  return NextResponse.json({ ...setting, token_configured: tokenConfigured });
});

export const PUT = withErrorHandler(async (request: Request) => {
  const user = await requireSession();
  await requirePermission(user, "setting_system");
  await dbConnect();
  const body = smsSettingSchema.parse(await request.json());
  const update: Record<string, unknown> = { ...body };
  if (!body.auth_token) delete update.auth_token;
  else update.auth_token = encryptSecret(body.auth_token);
  const setting: any = await SmsSetting.findOneAndUpdate({}, update, {
    new: true,
    upsert: true,
    runValidators: true,
  }).select("+auth_token");
  return NextResponse.json({
    provider: setting.provider,
    enabled: setting.enabled,
    account_sid: setting.account_sid,
    from_number: setting.from_number,
    token_configured: Boolean(setting.auth_token),
  });
});

export const POST = PUT;

