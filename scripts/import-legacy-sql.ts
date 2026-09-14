import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { asBoolean, asDate, asNumber, asString, parseLegacySqlDump, type SqlRow } from "../lib/legacySql";
import { encryptSecret } from "../lib/secrets";

dotenv.config({ path: ".env.local" });

const APPLICATION_TABLES = new Set([
  "clients",
  "currencies",
  "permissions",
  "permission_role",
  "pos_settings",
  "roles",
  "role_user",
  "servers",
  "settings",
  "users",
]);

const requestedPath = process.argv.find((argument) => argument.startsWith("--file="))?.slice("--file=".length);
const sqlPath = path.resolve(requestedPath || path.join("..", "Legacy Code", "software_inventorydb22.sql"));
const apply = process.argv.includes("--apply");

const rowId = (row: SqlRow) => asNumber(row.id);
const dates = (row: SqlRow) => {
  const createdAt = asDate(row.created_at);
  const updatedAt = asDate(row.updated_at);
  return {
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
};

async function main() {
  const sql = await fs.readFile(sqlPath, "utf8");
  const tables = parseLegacySqlDump(sql);
  const counts = Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length]));
  const ignored = Object.keys(tables).filter((table) => !APPLICATION_TABLES.has(table));
  const users = tables.users ?? [];
  const rolesById = new Map((tables.roles ?? []).map((role) => [rowId(role), asString(role.name)]));
  const roleLinks = tables.role_user ?? [];

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    source: sqlPath,
    sha256: createHash("sha256").update(sql).digest("hex"),
    table_counts: counts,
    ignored_tables: ignored,
    users: await Promise.all(users.map(async (user) => {
      const roleIds = roleLinks.filter((link) => asNumber(link.user_id) === rowId(user)).map((link) => asNumber(link.role_id));
      const password = asString(user.password);
      const knownPassword = (await bcrypt.compare("123456", password)) ? "123456" : null;
      return {
        legacy_id: rowId(user),
        name: `${asString(user.firstname)} ${asString(user.lastname)}`.trim(),
        username: asString(user.username),
        email: asString(user.email).toLowerCase(),
        phone: asString(user.phone),
        active: asBoolean(user.statut),
        roles: roleIds.map((id) => rolesById.get(id) ?? `role:${id}`),
        known_password: knownPassword,
      };
    })),
  }, null, 2));

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to upsert these application records.");
    return;
  }

  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing from .env.local");
  await mongoose.connect(process.env.MONGODB_URI);

  const database = mongoose.connection.db;
  if (!database) throw new Error("MongoDB connection did not expose a database");
  const backupCollections = ["permissions", "roles", "users", "clients", "currencies", "possettings", "settings", "servers"];
  const backup: Record<string, unknown[]> = {};
  for (const collection of backupCollections) {
    backup[collection] = await database.collection(collection).find({}).toArray();
  }
  const backupDirectory = path.resolve("storage", "backups");
  await fs.mkdir(backupDirectory, { recursive: true });
  const backupFile = path.join(backupDirectory, `legacy-import-pre-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await fs.writeFile(backupFile, JSON.stringify({ source: sqlPath, created_at: new Date().toISOString(), database: database.databaseName, collections: backup }, null, 2), { encoding: "utf8", mode: 0o600 });
  console.log(`Pre-import backup: ${backupFile}`);

  const Permission = (await import("../models/Permission")).default;
  const Role = (await import("../models/Role")).default;
  const User = (await import("../models/User")).default;
  const Client = (await import("../models/Client")).default;
  const Currency = (await import("../models/Currency")).default;
  await import("../models/Warehouse");
  const { PosSetting, Server, Setting } = await import("../models/Settings");

  try {
    const permissionRows = tables.permissions ?? [];
    if (permissionRows.length) {
      await Permission.bulkWrite(permissionRows.map((permission) => ({
        updateOne: {
          filter: { name: asString(permission.name) },
          update: { $set: { name: asString(permission.name) } },
          upsert: true,
        },
      })));
    }
    const permissionDocs = await Permission.find({ name: { $in: permissionRows.map((row) => asString(row.name)) } });
    const permissionIdByLegacyId = new Map<number, mongoose.Types.ObjectId>();
    for (const row of permissionRows) {
      const document = permissionDocs.find((permission) => permission.name === asString(row.name));
      if (!document) throw new Error(`Permission ${asString(row.name)} was not persisted`);
      permissionIdByLegacyId.set(rowId(row), document._id as mongoose.Types.ObjectId);
    }

    const roleIdByLegacyId = new Map<number, mongoose.Types.ObjectId>();
    for (const role of tables.roles ?? []) {
      const legacyId = rowId(role);
      const permissionIds = (tables.permission_role ?? [])
        .filter((link) => asNumber(link.role_id) === legacyId)
        .map((link) => permissionIdByLegacyId.get(asNumber(link.permission_id)))
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
      const document = await Role.findOneAndUpdate(
        { name: asString(role.name) },
        { $set: { name: asString(role.name), statut: asBoolean(role.status), permissions: permissionIds, deletedAt: asDate(role.deleted_at), ...dates(role) } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      roleIdByLegacyId.set(legacyId, document._id as mongoose.Types.ObjectId);
    }

    const userIdByLegacyId = new Map<number, mongoose.Types.ObjectId>();
    for (const user of users) {
      const legacyId = rowId(user);
      const linkedRoles = roleLinks
        .filter((link) => asNumber(link.user_id) === legacyId)
        .map((link) => roleIdByLegacyId.get(asNumber(link.role_id)))
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
      const fallbackRole = roleIdByLegacyId.get(asNumber(user.role_id));
      const roles = linkedRoles.length ? linkedRoles : fallbackRole ? [fallbackRole] : [];
      if (!roles.length) throw new Error(`No Mongo role mapping found for user ${asString(user.email)}`);
      const document = await User.findOneAndUpdate(
        { email: asString(user.email).toLowerCase() },
        { $set: { name: `${asString(user.firstname)} ${asString(user.lastname)}`.trim() || asString(user.username), email: asString(user.email).toLowerCase(), password: asString(user.password), avatar: asString(user.avatar, "avatar-default.png"), phone: asString(user.phone), statut: asBoolean(user.statut), roles, deletedAt: asDate(user.deleted_at), ...dates(user) } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      userIdByLegacyId.set(legacyId, document._id as mongoose.Types.ObjectId);
    }

    const clientIdByLegacyId = new Map<number, mongoose.Types.ObjectId>();
    for (const client of tables.clients ?? []) {
      const code = asString(client.code);
      const document = await Client.findOneAndUpdate(
        { $or: [{ code }, { email: asString(client.email).toLowerCase() }] },
        { $set: { name: asString(client.name), code, email: asString(client.email).toLowerCase(), country: asString(client.country), city: asString(client.city), phone: asString(client.phone), address: asString(client.adresse), tax_number: "", deletedAt: asDate(client.deleted_at), ...dates(client) } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      clientIdByLegacyId.set(rowId(client), document._id as mongoose.Types.ObjectId);
    }

    const currencyIdByLegacyId = new Map<number, mongoose.Types.ObjectId>();
    for (const currency of tables.currencies ?? []) {
      const document = await Currency.findOneAndUpdate(
        { code: asString(currency.code) },
        { $set: { code: asString(currency.code), name: asString(currency.name), symbol: asString(currency.symbol), deletedAt: asDate(currency.deleted_at), ...dates(currency) } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      currencyIdByLegacyId.set(rowId(currency), document._id as mongoose.Types.ObjectId);
    }

    for (const pos of tables.pos_settings ?? []) {
      await PosSetting.findOneAndUpdate({}, { $set: {
        note_customer: asString(pos.note_customer),
        show_note: asBoolean(pos.show_note),
        show_barcode: asBoolean(pos.show_barcode),
        show_discount: asBoolean(pos.show_discount),
        show_customer: asBoolean(pos.show_customer),
        show_email: asBoolean(pos.show_email),
        show_phone: asBoolean(pos.show_phone),
        show_address: asBoolean(pos.show_address),
        ...dates(pos),
      } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }

    const settingRow = (tables.settings ?? [])[0];
    if (settingRow) {
      const legacyCurrencyId = settingRow.currency_id === null ? null : currencyIdByLegacyId.get(asNumber(settingRow.currency_id)) ?? null;
      const legacyClientId = settingRow.client_id === null ? null : clientIdByLegacyId.get(asNumber(settingRow.client_id)) ?? null;
      await Setting.findOneAndUpdate({}, { $set: {
        email: asString(settingRow.email),
        CompanyName: asString(settingRow.CompanyName),
        CompanyPhone: asString(settingRow.CompanyPhone),
        CompanyAdress: asString(settingRow.CompanyAdress),
        logo: asString(settingRow.logo, "logo-default.png"),
        footer: asString(settingRow.footer),
        developed_by: asString(settingRow.developed_by),
        currency_id: legacyCurrencyId,
        client_id: legacyClientId,
        default_language: asString(settingRow.default_language, "en"),
        ...dates(settingRow),
      } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }

    for (const server of tables.servers ?? []) {
      await Server.findOneAndUpdate({ name: "default" }, { $set: {
        name: "default",
        smtp_host: asString(server.host),
        smtp_port: asNumber(server.port, 587),
        smtp_username: asString(server.username),
        smtp_password: encryptSecret(asString(server.password)),
        smtp_email: asString(settingRow?.email),
        encryption: asString(server.encryption, "tls"),
        ...dates(server),
      } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }

    const importedUser = await User.findOne({ email: "admin@example.com" }).populate({ path: "roles", populate: { path: "permissions" } });
    const importedSetting = await Setting.findOne().populate("currency_id client_id warehouse_id");
    const importedServer = await Server.findOne({ name: "default" }).select("+smtp_password");
    if (!importedUser) throw new Error("Imported administrator could not be verified");
    if (!await bcrypt.compare("123456", importedUser.password)) throw new Error("Imported Laravel password hash cannot authenticate with bcryptjs");

    console.log(JSON.stringify({
      imported: {
        permissions: permissionIdByLegacyId.size,
        roles: roleIdByLegacyId.size,
        users: userIdByLegacyId.size,
        clients: clientIdByLegacyId.size,
        currencies: currencyIdByLegacyId.size,
        pos_settings: (tables.pos_settings ?? []).length,
        system_settings: settingRow ? 1 : 0,
        smtp_servers: (tables.servers ?? []).length,
      },
      verification: {
        administrator: { email: importedUser.email, name: importedUser.name, active: importedUser.statut, roles: importedUser.roles.map((role: any) => role.name), permissions: importedUser.roles.flatMap((role: any) => role.permissions).length, password: "123456" },
        settings: { company: importedSetting?.CompanyName, currency: (importedSetting?.currency_id as any)?.code, client: (importedSetting?.client_id as any)?.name, warehouse: (importedSetting?.warehouse_id as any)?.name ?? null },
        smtp_password_encrypted: Boolean(importedServer?.smtp_password?.startsWith("enc:v1:")),
      },
      backup_file: backupFile,
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
