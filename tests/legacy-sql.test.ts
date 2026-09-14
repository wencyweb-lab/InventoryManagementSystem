import assert from "node:assert/strict";
import test from "node:test";
import { parseLegacySqlDump } from "../lib/legacySql";

test("legacy SQL parser preserves commas, quotes, nulls, and numeric values", () => {
  const tables = parseLegacySqlDump("INSERT INTO `people` (`id`, `name`, `note`, `deleted_at`) VALUES\n(1, 'O\\'Brien, Pat', 'Line\\nTwo', NULL),\n(2, 'Second', 'It''s valid', 3.5);");
  assert.deepEqual(tables.people, [
    { id: 1, name: "O'Brien, Pat", note: "Line\nTwo", deleted_at: null },
    { id: 2, name: "Second", note: "It's valid", deleted_at: 3.5 },
  ]);
});

test("legacy SQL parser combines multiple insert statements for one table", () => {
  const tables = parseLegacySqlDump("INSERT INTO `items` (`id`, `value`) VALUES (1, 'a');\nINSERT INTO `items` (`id`, `value`) VALUES (2, 'b');");
  assert.equal(tables.items.length, 2);
});
