"""Aggregate-only checks for a source-row batch before any future DB adapter."""
from __future__ import annotations

from collections import Counter
from typing import Any

from legacy_mapping import TABLES, USER_SECRETS, canonical_row_fingerprint, map_row, target_candidate

RELATIONSHIPS = (
    ("post_media", "post_id", "posts"),
    ("post_media", "media_id", "media"),
    ("content_media", "content_id", "content"),
    ("content_media", "media_id", "media"),
    ("content", "media_id", "media"),
)


def validate_batch(
    source: dict[str, list[dict[str, Any]]],
    existing_target_posts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    violations: Counter[str] = Counter()
    counts: dict[str, int] = {}
    envelopes = {}
    candidates = {}
    target_ids: set[tuple[str, str]] = set()
    source_slugs: set[str] = set()
    existing_target_posts = existing_target_posts or []
    target_id_set = {str(row.get("id")) for row in existing_target_posts if isinstance(row, dict) and row.get("id") is not None}
    target_slug_set = {str(row.get("slug")).casefold() for row in existing_target_posts if isinstance(row, dict) and isinstance(row.get("slug"), str)}
    for table, rows in source.items():
        if table not in TABLES or not isinstance(rows, list):
            violations["unsupported_table_or_shape"] += 1
            continue
        counts[table] = len(rows)
        seen = set()
        mapped = []
        planned = []
        for row in rows:
            if not isinstance(row, dict) or "id" not in row:
                violations["missing_source_id"] += 1
                continue
            key = (type(row["id"]).__name__, str(row["id"]))
            if key in seen: violations["duplicate_source_id"] += 1
            seen.add(key)
            envelope = map_row(table, row)
            if table == "users":
                if USER_SECRETS & envelope["payload"].keys(): violations["credential_field_present"] += 1
                if envelope["privilegesGranted"]: violations["unexpected_privilege"] += 1
            if table == "posts" and envelope["publiclyReadable"]: violations["unexpected_publication"] += 1
            mapped.append(envelope)
            planned.append(target_candidate(table, row))
            target = planned[-1]["target"]
            if target and target.get("schema") == "app" and target.get("table") == "posts":
                target_id = str(target["id"])
                target_slug = str(target["slug"]).casefold()
                target_key = ("app.posts", target_id)
                if target_id in target_id_set or target_key in target_ids:
                    violations["target_id_conflict"] += 1
                if target_slug in target_slug_set or target_slug in source_slugs:
                    violations["target_slug_conflict"] += 1
                target_ids.add(target_key)
                source_slugs.add(target_slug)
        envelopes[table] = mapped
        candidates[table] = planned

    source_index: dict[str, set[str]] = {
        table: {str(row.get("id")) for row in rows if isinstance(row, dict) and row.get("id") is not None}
        for table, rows in source.items() if isinstance(rows, list)
    }
    for child_table, field, parent_table in RELATIONSHIPS:
        for row in source.get(child_table, []):
            value = row.get(field)
            if value is not None and str(value) not in source_index.get(parent_table, set()):
                violations["orphan_reference"] += 1

    unresolved = sum(len(item["issues"]) for rows in candidates.values() for item in rows)
    return {
        "valid": not violations,
        "importReady": not violations and unresolved == 0,
        "sourceCounts": dict(sorted(counts.items())),
        "mappedCounts": {key: len(value) for key, value in sorted(envelopes.items())},
        "candidateCounts": {key: len(value) for key, value in sorted(candidates.items())},
        "quarantinedCandidateCounts": {
            key: sum(1 for item in value if item["reviewState"] == "quarantined")
            for key, value in sorted(candidates.items())
        },
        "unresolvedCandidateIssueCount": unresolved,
        "violations": dict(sorted(violations.items())),
        "recordValuesEmitted": False,
    }


def compare_snapshots(before: dict[str, list[dict[str, Any]]], after: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """Aggregate-only keyed diff for two explicitly authorized source snapshots."""
    table_results = {}
    duplicate_ids: Counter[str] = Counter()
    for table in sorted(TABLES):
        def index(rows: list[dict[str, Any]]) -> dict[str, str]:
            result = {}
            seen = set()
            for row in rows:
                if not isinstance(row, dict) or "id" not in row:
                    continue
                key = f"{type(row['id']).__name__}:{row['id']}"
                if key in seen:
                    duplicate_ids[table] += 1
                    continue
                seen.add(key)
                result[key] = canonical_row_fingerprint(table, row)
            return result
        old = index(before.get(table, []))
        new = index(after.get(table, []))
        shared = old.keys() & new.keys()
        table_results[table] = {
            "beforeCount": len(old),
            "afterCount": len(new),
            "added": len(new.keys() - old.keys()),
            "removed": len(old.keys() - new.keys()),
            "changed": sum(1 for key in shared if old[key] != new[key]),
            "duplicateIds": duplicate_ids.get(table, 0),
        }
    return {
        "tables": table_results,
        "duplicateIdCount": sum(duplicate_ids.values()),
        "recordValuesEmitted": False,
        "credentialFieldsCompared": False,
    }
