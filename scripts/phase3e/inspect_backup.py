#!/usr/bin/env python3
"""Non-executing, aggregate-only inspector for the owner-confirmed Phase 3E dump."""
from __future__ import annotations

import hashlib
import json
import os
import re
import stat
from collections import Counter
from pathlib import Path
from typing import Any, Iterator

BACKUP = Path("/Volumes/DEV-LAB/Projects/Private-Backups/db_cluster-15-06-2025@15-25-31.backup")
APP_TABLES = {
    "bug_reports", "content", "content_media", "media", "post_media", "posts", "users"
}
COPY_RE = re.compile(r"^\s*COPY\s+((?:\"[^\"]+\"|[\w$]+)\.)?(\"[^\"]+\"|[\w$]+)\s*\((.*?)\)\s+FROM\s+stdin\s*;\s*$", re.I | re.S)


def _copy_command(statement: str) -> re.Match[str] | None:
    clean = re.sub(r"(?m)^\s*--[^\n]*(?:\n|$)", "", statement).strip()
    return COPY_RE.match(clean)


def _statements(text: str) -> Iterator[tuple[str, int, int, int, list[list[str | None]]]]:
    """Yield SQL statements and the offset after each semicolon, honoring quotes/comments."""
    start = 0
    i = 0
    single = double = line_comment = False
    block_depth = 0
    dollar = ""
    while i < len(text):
        if line_comment:
            if text[i] == "\n":
                line_comment = False
            i += 1
            continue
        if block_depth:
            if text.startswith("/*", i):
                block_depth += 1; i += 2
            elif text.startswith("*/", i):
                block_depth -= 1; i += 2
            else:
                i += 1
            continue
        if dollar:
            if text.startswith(dollar, i):
                i += len(dollar); dollar = ""
            else:
                i += 1
            continue
        ch = text[i]
        if single:
            if ch == "'":
                if i + 1 < len(text) and text[i + 1] == "'":
                    i += 2; continue
                single = False
            elif ch == "\\" and i + 1 < len(text):
                i += 2; continue
            i += 1; continue
        if double:
            if ch == '"':
                if i + 1 < len(text) and text[i + 1] == '"':
                    i += 2; continue
                double = False
            i += 1; continue
        if text.startswith("--", i):
            line_comment = True; i += 2; continue
        if text.startswith("/*", i):
            block_depth = 1; i += 2; continue
        if ch == "'":
            single = True; i += 1; continue
        if ch == '"':
            double = True; i += 1; continue
        if ch == "$":
            match = re.match(r"\$[A-Za-z_0-9]*\$", text[i:])
            if match:
                dollar = match.group(0); i += len(dollar); continue
        if ch == ";":
            i += 1
            statement = text[start:i]
            data_rows = width_errors = 0
            app_values: list[list[str | None]] = []
            copy_match = _copy_command(statement)
            if copy_match:
                # PostgreSQL COPY payload is opaque data. Skip it as lines and
                # never pass it through the SQL lexer or retain row values.
                pos = i
                if text.startswith("\r\n", pos): pos += 2
                elif text.startswith("\n", pos): pos += 1
                schema = _unquote((copy_match.group(1) or "public.")[:-1])
                table = _unquote(copy_match.group(2))
                while pos < len(text):
                    nl = text.find("\n", pos)
                    if nl < 0: nl = len(text)
                    line = text[pos:nl]
                    pos = min(nl + 1, len(text))
                    if line == r"\.":
                        i = pos
                        break
                    data_rows += 1
                    fields = line.split("\t")
                    columns = _split_top_level(copy_match.group(3))
                    if len(fields) != len(columns):
                        width_errors += 1
                    elif schema == "public" and table in APP_TABLES:
                        app_values.append([None if value == r"\N" else value for value in fields])
                else:
                    raise ValueError("unterminated COPY block")
            yield statement, i, data_rows, width_errors, app_values
            start = i
            continue
        i += 1
    tail = re.sub(r"(?s)/\*.*?\*/", "", text[start:])
    tail = re.sub(r"(?m)^\s*--[^\n]*(?:\n|$)", "", tail)
    if tail.strip():
        yield text[start:], len(text), 0, 0, []


def _unquote(identifier: str) -> str:
    identifier = identifier.strip()
    if identifier.startswith('"') and identifier.endswith('"'):
        return identifier[1:-1].replace('""', '"')
    return identifier


def _split_top_level(text: str) -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    single = double = False
    i = 0
    while i < len(text):
        ch = text[i]
        if single:
            if ch == "'":
                if i + 1 < len(text) and text[i + 1] == "'": i += 2; continue
                single = False
            elif ch == "\\": i += 2; continue
        elif double:
            if ch == '"':
                if i + 1 < len(text) and text[i + 1] == '"': i += 2; continue
                double = False
        elif ch == "'": single = True
        elif ch == '"': double = True
        elif ch == "(": depth += 1
        elif ch == ")": depth -= 1
        elif ch == "," and depth == 0:
            parts.append(text[start:i].strip()); start = i + 1
        i += 1
    tail = text[start:].strip()
    if tail: parts.append(tail)
    return parts


def _table_columns(statement: str) -> list[dict[str, str]] | None:
    match = re.search(r"CREATE\s+TABLE\s+(?:ONLY\s+)?(?:\"([^\"]+)\"|([\w$]+))\.(?:\"([^\"]+)\"|([\w$]+))\s*\((.*)\)\s*;\s*$", statement, re.I | re.S)
    if not match: return None
    schema = _unquote(match.group(1) or match.group(2))
    table = _unquote(match.group(3) or match.group(4))
    if schema != "public" or table not in APP_TABLES: return None
    body = match.group(5)
    columns = []
    for item in _split_top_level(body):
        if re.match(r"^(?:CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)\b", item, re.I):
            continue
        name = re.match(r'^("(?:[^"]|"")+"|[\w$]+)\s+(.+)$', item, re.S)
        if not name: continue
        definition = name.group(2).strip()
        # Publish only type and nullability. Never publish defaults or literals.
        type_match = re.match(r"([\w.\[\]]+(?:\s+varying)?(?:\s*\([^)]*\))?(?:\s+without\s+time\s+zone)?(?:\s+with\s+time\s+zone)?)", definition, re.I)
        columns.append({"name": _unquote(name.group(1)), "type": " ".join(type_match.group(1).split()) if type_match else "unparsed", "nullable": not bool(re.search(r"\bNOT\s+NULL\b", definition, re.I))})
    return columns


def inspect_bytes(raw: bytes) -> dict[str, Any]:
    text = raw.decode("utf-8", errors="strict")
    tables: Counter[str] = Counter()
    copy_counts: Counter[str] = Counter()
    copy_columns: dict[str, int] = {}
    copy_width_errors: Counter[str] = Counter()
    columns: dict[str, list[dict[str, str]]] = {}
    app_rows: dict[str, list[dict[str, str | None]]] = {}
    statements = 0
    copy_blocks = 0
    copied_rows = 0
    for statement, end, data_rows, width_errors, values in _statements(text):
        statements += 1
        create_match = re.search(r"CREATE\s+TABLE\s+(?:ONLY\s+)?(?:\"([^\"]+)\"|([\w$]+))\.(?:\"([^\"]+)\"|([\w$]+))\s*\(", statement, re.I)
        if create_match:
            schema = _unquote(create_match.group(1) or create_match.group(2))
            table = _unquote(create_match.group(3) or create_match.group(4))
            tables[f"{schema}.{table}"] += 1
            parsed = _table_columns(statement)
            if parsed is not None: columns[table] = parsed
        copy_match = _copy_command(statement)
        if copy_match:
            schema = _unquote((copy_match.group(1) or "public.")[:-1])
            table = _unquote(copy_match.group(2))
            key = f"{schema}.{table}"
            names = _split_top_level(copy_match.group(3))
            copy_blocks += 1
            copy_columns[key] = len(names)
            copy_counts[key] += data_rows
            copied_rows += data_rows
            if width_errors: copy_width_errors[key] += width_errors
            if schema == "public" and table in APP_TABLES and values:
                app_rows[table] = [dict(zip((_unquote(n) for n in names), row)) for row in values]
    app_counts = {name: count for name, count in sorted(copy_counts.items()) if name.startswith("public.") and name.split(".",1)[1] in APP_TABLES}
    provider_counts = {name: count for name, count in sorted(copy_counts.items()) if name.startswith("auth.") or name.startswith("storage.") or name.startswith("realtime.") or name.startswith("vault.") or name.startswith("pgsodium.")}
    fk_checks = {
        "post_media.post_id->posts.id": sum(1 for row in app_rows.get("post_media", []) if row.get("post_id") is not None and row["post_id"] not in {r.get("id") for r in app_rows.get("posts", [])}),
        "post_media.media_id->media.id": sum(1 for row in app_rows.get("post_media", []) if row.get("media_id") is not None and row["media_id"] not in {r.get("id") for r in app_rows.get("media", [])}),
        "content_media.content_id->content.id": sum(1 for row in app_rows.get("content_media", []) if row.get("content_id") is not None and row["content_id"] not in {r.get("id") for r in app_rows.get("content", [])}),
        "content_media.media_id->media.id": sum(1 for row in app_rows.get("content_media", []) if row.get("media_id") is not None and row["media_id"] not in {r.get("id") for r in app_rows.get("media", [])}),
        "content.media_id->media.id": sum(1 for row in app_rows.get("content", []) if row.get("media_id") is not None and row["media_id"] not in {r.get("id") for r in app_rows.get("media", [])}),
    }
    pk_duplicates = {}
    for table in APP_TABLES:
        rows = app_rows.get(table, [])
        ids = [row.get("id") for row in rows]
        pk_duplicates[table] = len(ids) - len(set(ids))
    duplicate_order_pairs = {}
    for table, parent_field, order_field in (("post_media", "post_id", "media_order"), ("content_media", "content_id", "position")):
        pairs = [(row.get(parent_field), row.get(order_field)) for row in app_rows.get(table, []) if row.get(parent_field) is not None and row.get(order_field) is not None]
        duplicate_order_pairs[table] = len(pairs) - len(set(pairs))
    content_type_allowlist = {"hero", "about", "skills", "experience", "resume", "project", "contact"}
    content_types = Counter((row.get("type") if row.get("type") in content_type_allowlist else "unrecognized") for row in app_rows.get("content", []))
    known_statuses = {"active", "draft", "public", "private", "published", "archived"}
    post_statuses = Counter((row.get("status") if row.get("status") in known_statuses else "unrecognized") for row in app_rows.get("posts", []))
    media_url_schemes = Counter()
    for row in app_rows.get("media", []):
        url = row.get("url") or ""
        media_url_schemes["https" if url.lower().startswith("https://") else "http" if url.lower().startswith("http://") else "empty" if not url else "other"] += 1
    return {
        "format": "utf8-plain-postgresql-cluster-dump",
        "sizeBytes": len(raw),
        "sourcePostgreSQLVersion": re.search(r"Dumped from database version\s+([\d.]+)", text).group(1) if re.search(r"Dumped from database version\s+([\d.]+)", text) else "unreported",
        "pgDumpVersion": re.search(r"Dumped by pg_dump version\s+([\d.]+)", text).group(1) if re.search(r"Dumped by pg_dump version\s+([\d.]+)", text) else "unreported",
        "statementCount": statements,
        "explicitTableDefinitions": sum(tables.values()),
        "identifiedTables": len(tables),
        "copyBlockCount": copy_blocks,
        "serializedRows": copied_rows,
        "applicationCopyRows": app_counts,
        "providerCopyRows": provider_counts,
        "copyColumns": dict(sorted(copy_columns.items())),
        "copyWidthErrors": dict(sorted(copy_width_errors.items())),
        "applicationColumns": {key: columns[key] for key in sorted(columns)},
        "applicationRelationshipOrphans": fk_checks,
        "applicationPrimaryKeyDuplicates": pk_duplicates,
        "duplicateParentOrderPairs": duplicate_order_pairs,
        "contentTypeCountsAllowlisted": dict(sorted(content_types.items())),
        "postStatusCountsAllowlisted": dict(sorted(post_statuses.items())),
        "mediaUrlSchemeCounts": dict(sorted(media_url_schemes.items())),
        "rawContentEmitted": False,
    }


def read_confirmed_backup() -> tuple[bytes, os.stat_result]:
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(BACKUP, flags)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode): raise ValueError("confirmed input is not a regular file")
        with os.fdopen(fd, "rb", closefd=False) as stream:
            raw = stream.read(info.st_size + 1)
        if len(raw) != info.st_size: raise ValueError("source size changed during read")
        return raw, info
    finally:
        os.close(fd)


def main() -> int:
    raw, before = read_confirmed_backup()
    report = inspect_bytes(raw)
    after = BACKUP.stat()
    if (before.st_size, before.st_mtime_ns, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_ino):
        raise SystemExit("source changed during inspection; no report written")
    report["sourceStableDuringRead"] = True
    report["sha256"] = hashlib.sha256(raw).hexdigest()
    print(json.dumps(report, ensure_ascii=True, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
