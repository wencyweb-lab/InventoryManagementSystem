export type SqlScalar = string | number | null;
export type SqlRow = Record<string, SqlScalar>;
export type SqlTables = Record<string, SqlRow[]>;

const ESCAPES: Record<string, string> = {
  "0": "\0",
  b: "\b",
  n: "\n",
  r: "\r",
  t: "\t",
  Z: "\x1a",
  "\\": "\\",
  "'": "'",
  '"': '"',
};

function parseQuoted(input: string, start: number) {
  let value = "";
  let index = start + 1;

  while (index < input.length) {
    const character = input[index];
    if (character === "\\") {
      const next = input[index + 1];
      value += ESCAPES[next] ?? next;
      index += 2;
      continue;
    }
    if (character === "'") {
      if (input[index + 1] === "'") {
        value += "'";
        index += 2;
        continue;
      }
      return { value, index: index + 1 };
    }
    value += character;
    index += 1;
  }

  throw new Error("Unterminated SQL string literal");
}

function parseBare(token: string): SqlScalar {
  const value = token.trim();
  if (/^null$/i.test(value)) return null;
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return value;
}

function parseValueTuples(input: string): SqlScalar[][] {
  const rows: SqlScalar[][] = [];
  let index = 0;

  while (index < input.length) {
    while (index < input.length && /[\s,]/.test(input[index])) index += 1;
    if (index >= input.length) break;
    if (input[index] !== "(") throw new Error(`Expected SQL tuple at offset ${index}`);
    index += 1;

    const row: SqlScalar[] = [];
    while (index < input.length) {
      while (index < input.length && /\s/.test(input[index])) index += 1;

      if (input[index] === "'") {
        const quoted = parseQuoted(input, index);
        row.push(quoted.value);
        index = quoted.index;
      } else {
        const start = index;
        while (index < input.length && input[index] !== "," && input[index] !== ")") index += 1;
        row.push(parseBare(input.slice(start, index)));
      }

      while (index < input.length && /\s/.test(input[index])) index += 1;
      if (input[index] === ",") {
        index += 1;
        continue;
      }
      if (input[index] === ")") {
        index += 1;
        rows.push(row);
        break;
      }
      throw new Error(`Expected comma or tuple terminator at offset ${index}`);
    }
  }

  return rows;
}

export function parseLegacySqlDump(sql: string): SqlTables {
  const tables: SqlTables = {};
  const insertPattern = /INSERT INTO\s+`([^`]+)`\s*\(([^;]+?)\)\s*VALUES\s*([\s\S]*?);/gi;
  let match: RegExpExecArray | null;

  while ((match = insertPattern.exec(sql))) {
    const [, table, rawColumns, rawValues] = match;
    const columns = Array.from(rawColumns.matchAll(/`([^`]+)`/g), (column) => column[1]);
    if (!columns.length) throw new Error(`No columns found for ${table}`);

    const values = parseValueTuples(rawValues);
    const rows = values.map((valuesRow, rowIndex) => {
      if (valuesRow.length !== columns.length) {
        throw new Error(`${table} row ${rowIndex + 1} has ${valuesRow.length} values for ${columns.length} columns`);
      }
      return Object.fromEntries(columns.map((column, columnIndex) => [column, valuesRow[columnIndex]]));
    });
    tables[table] = [...(tables[table] ?? []), ...rows];
  }

  return tables;
}

export function asString(value: SqlScalar | undefined, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

export function asNumber(value: SqlScalar | undefined, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Expected a finite number, received ${String(value)}`);
  return number;
}

export function asBoolean(value: SqlScalar | undefined) {
  return asNumber(value) !== 0;
}

export function asDate(value: SqlScalar | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value).replace(" ", "T").replace(/\.\d+$/, "Z"));
  if (Number.isNaN(date.valueOf())) throw new Error(`Invalid SQL date ${String(value)}`);
  return date;
}
