import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import {
  requirePermission,
  requireSession,
  withErrorHandler,
} from "@/lib/permissions";
import { PaymentGatewaySetting } from "@/models/Settings";
import { paymentGatewaySchema } from "@/lib/validation";
import { encryptSecret } from "@/lib/secrets";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  await requirePermission(user, "setting_system");
  await dbConnect();
  const setting: any = await PaymentGatewaySetting.findOne()
    .select("+secret_key")
    .lean();
  if (!setting)
    return NextResponse.json({
      provider: "stripe",
      enabled: false,
      currency: "USD",
      secret_configured: false,
    });
  const secretConfigured = Boolean(setting.secret_key);
  delete setting.secret_key;
  return NextResponse.json({ ...setting, secret_configured: secretConfigured });
});

export const PUT = withErrorHandler(async (request: Request) => {
  const user = await requireSession();
  await requirePermission(user, "setting_system");
  await dbConnect();
  const body = paymentGatewaySchema.parse(await request.json());
  const update: Record<string, unknown> = { ...body };
  if (!body.secret_key) delete update.secret_key;
  else update.secret_key = encryptSecret(body.secret_key);
  const setting: any = await PaymentGatewaySetting.findOneAndUpdate(
    {},
    update,
    { new: true, upsert: true, runValidators: true },
  ).select("+secret_key");
  return NextResponse.json({
    provider: setting.provider,
    enabled: setting.enabled,
    public_key: setting.public_key,
    currency: setting.currency,
    secret_configured: Boolean(setting.secret_key),
  });
});

export const POST = PUT;

