import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import {
  ApiError,
  hasPermission,
  requireSession,
  withErrorHandler,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

const KINDS = {
  products: {
    folder: "products",
    permissions: ["products_add", "products_edit"],
    maxFiles: 5,
  },
  logos: { folder: "logos", permissions: ["setting_system"], maxFiles: 1 },
  avatars: { folder: "avatars", permissions: [], maxFiles: 1 },
} as const;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function hasSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png")
    return (
      bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (value, index) => bytes[index] === value,
      )
    );
  if (mime === "image/webp")
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}

export const POST = withErrorHandler(
  async (request: Request, context: { params: { kind: string } }) => {
    const user = await requireSession();
    const config = KINDS[context.params.kind as keyof typeof KINDS];
    if (!config) throw new ApiError(404, "Unknown upload type");
    if (
      config.permissions.length &&
      !config.permissions.some((permission) => hasPermission(user, permission))
    ) {
      throw new ApiError(403, "Forbidden: insufficient permissions");
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    if (!files.length)
      throw new ApiError(422, "At least one image is required");
    if (files.length > config.maxFiles)
      throw new ApiError(
        422,
        `A maximum of ${config.maxFiles} image(s) can be uploaded at once`,
      );
    if (files.reduce((total, file) => total + file.size, 0) > 10 * 1024 * 1024)
      throw new ApiError(413, "The combined upload cannot exceed 10 MB");

    const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
    const destination = path.resolve(uploadRoot, config.folder);
    if (!destination.startsWith(`${uploadRoot}${path.sep}`))
      throw new ApiError(400, "Invalid upload destination");
    await mkdir(destination, { recursive: true });

    const names: string[] = [];
    for (const file of files) {
      const extension = EXTENSIONS[file.type];
      if (!extension)
        throw new ApiError(422, "Only JPEG, PNG, and WebP images are accepted");
      if (!file.size || file.size > 5 * 1024 * 1024)
        throw new ApiError(413, "Each image must be between 1 byte and 5 MB");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasSignature(bytes, file.type))
        throw new ApiError(
          422,
          `The file ${file.name} does not match its declared image type`,
        );
      const filename = `${randomUUID()}${extension}`;
      await writeFile(path.join(destination, filename), bytes, { flag: "wx" });
      names.push(filename);
    }

    return NextResponse.json(
      { files: names },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  },
);
