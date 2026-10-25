// Guards for the remote pgTAP runner: a test file may only run inside the one
// transaction the runner aborts at the end, so nothing it does is committed.

const IDENT = /[A-Za-z0-9_$\u0080-\uffff]/;
const DOLLAR_TAG = /^\$(?:[A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*)?\$/;

/** End index (exclusive) of a quoted run opened at `i` by `quote`; doubled quote escapes. */
function closeQuoted(sql: string, i: number, quote: string, backslash: boolean, what: string) {
  let j = i + 1;
  while (j < sql.length) {
    if (backslash && sql[j] === "\\") j += 2;
    else if (sql[j] === quote && sql[j + 1] === quote) j += 2;
    else if (sql[j] === quote) return j + 1;
    else j++;
  }
  throw new Error(`Unterminated ${what}.`);
}

/**
 * Removes comments, string literals, quoted identifiers and dollar-quoted
 * bodies (function/DO code), following PostgreSQL's lexer: nested block
 * comments, E'' strings with backslash escapes (standard_conforming_strings
 * on otherwise), "" identifiers and $tag$ bodies whose tag may hold digits.
 */
export function stripSqlLiterals(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const prevIdent = i > 0 && IDENT.test(sql.charAt(i - 1));
    if (c === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl;
      continue;
    }
    if (c === "/" && sql[i + 1] === "*") {
      let depth = 1;
      let j = i + 2;
      while (depth > 0) {
        if (j >= sql.length) throw new Error("Unterminated block comment.");
        const pair = sql.slice(j, j + 2);
        if (pair === "/*" || pair === "*/") {
          depth += pair === "/*" ? 1 : -1;
          j += 2;
        } else j++;
      }
      i = j;
      out += " ";
      continue;
    }
    if ((c === "E" || c === "e") && sql[i + 1] === "'" && !prevIdent) {
      i = closeQuoted(sql, i + 1, "'", true, "string literal");
      out += "''";
      continue;
    }
    if (c === "'") {
      i = closeQuoted(sql, i, "'", false, "string literal");
      out += "''";
      continue;
    }
    if (c === '"') {
      i = closeQuoted(sql, i, '"', false, "quoted identifier");
      out += '""';
      continue;
    }
    const tag = c === "$" && !prevIdent ? sql.slice(i).match(DOLLAR_TAG)?.[0] : undefined;
    if (tag) {
      const close = sql.indexOf(tag, i + tag.length);
      if (close === -1) throw new Error(`Unterminated dollar-quoted body ${tag}.`);
      i = close + tag.length;
      out += "''";
      continue;
    }
    out += c;
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
