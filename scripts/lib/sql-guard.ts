// Guards for the remote pgTAP runner: a test file may only run inside the one
// transaction the runner aborts at the end, so nothing it does is committed.

/** Removes comments, string literals and dollar-quoted bodies (function/DO code). */
export function stripSqlLiterals(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (rest.startsWith("--")) {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl;
      continue;
    }
    if (rest.startsWith("/*")) {
      const close = sql.indexOf("*/", i + 2);
      if (close === -1) throw new Error("Unterminated block comment.");
      i = close + 2;
      out += " ";
      continue;
    }
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j++;
      }
      if (j >= sql.length) throw new Error("Unterminated string literal.");
      i = j + 1;
      out += "''";
      continue;
    }
    const tag = rest.match(/^\$[A-Za-z_]*\$/)?.[0];
    if (tag) {
      const close = sql.indexOf(tag, i + tag.length);
      if (close === -1) throw new Error(`Unterminated dollar-quoted body ${tag}.`);
      i = close + tag.length;
      out += "''";
      continue;
    }
    out += sql[i];
    i++;
  }
  return out;
}

const TX_CONTROL =
  /^(begin|start\s+transaction|commit|end|abort|rollback|prepare\s+transaction|set\s+(session\s+)?transaction|set\s+session\s+characteristics)\b/;
const ALLOWED = /^(rollback\s+(work\s+|transaction\s+)?to\b|release\b)/;

/**
 * Throws unless `body` opens with `begin;` and contains no other transaction
 * control (commit, rollback, nested begin, …). Savepoints are allowed.
 * `body` is the test file without its final `finish(); rollback;`.
 */
export function assertSingleTransaction(body: string, file = "test"): void {
  const statements = stripSqlLiterals(body)
    .split(";")
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean);
  if (statements[0] !== "begin") {
    throw new Error(`${file}: the first statement must be "begin;".`);
  }
  for (const statement of statements.slice(1)) {
    if (TX_CONTROL.test(statement) && !ALLOWED.test(statement)) {
      throw new Error(`${file}: transaction control is not allowed here: "${statement}".`);
    }
  }
}
