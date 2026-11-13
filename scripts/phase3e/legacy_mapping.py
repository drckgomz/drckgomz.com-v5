"""Pure, versioned row mapping for a future restricted legacy staging import.

This module has no database driver, filesystem writes, network access, or CLI.
It preserves source payloads in memory except legacy credentials/reset tokens,
which are intentionally excluded. A reviewed database adapter is a separate gate.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

MAPPING_VERSION = "phase3e-legacy-stage-v1"
TARGET_MAPPING_VERSION = "phase3e-target-candidate-v1"
TABLES = {
    "bug_reports", "content", "content_media", "media", "post_media", "posts", "users"
}
USER_SECRETS = {"password", "reset_token", "reset_token_expires"}


def stable_source_key(table: str, source_id: object) -> str:
    if table not in TABLES or source_id is None:
        raise ValueError("unsupported source key")
    canonical = f"supabase-backup-unverified:{table}:{source_id}"
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def map_row(table: str, row: dict[str, Any]) -> dict[str, Any]:
    """Return a staging envelope; never grant access or make content public."""
    if table not in TABLES or not isinstance(row, dict) or "id" not in row:
        raise ValueError("unsupported source row")
    payload = dict(row)
    if table == "users":
        for field in USER_SECRETS:
            payload.pop(field, None)
    envelope: dict[str, Any] = {
        "mappingVersion": MAPPING_VERSION,
        "sourceNamespace": "supabase-backup-unverified",
        "sourceTable": table,
        "sourceId": str(row["id"]),
        "sourceKey": stable_source_key(table, row["id"]),
        "payload": payload,
        "reviewState": "pending",
    }
    if table == "posts":
        envelope["publicationDisposition"] = "quarantined"
        envelope["publiclyReadable"] = False
    elif table == "users":
        envelope["identityDisposition"] = "verification-required"
        envelope["privilegesGranted"] = []
    elif table == "media":
        envelope["deliveryDisposition"] = "unverified"
    elif table == "bug_reports":
        envelope["retentionDisposition"] = "owner-review-required"
    return envelope


def canonical_row_fingerprint(table: str, row: dict[str, Any]) -> str:
    """Stable internal equality token; callers must not publish row fingerprints."""
    mapped = map_row(table, row)
    stable = json.dumps(mapped, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(stable.encode("utf-8")).hexdigest()


def target_candidate(table: str, row: dict[str, Any]) -> dict[str, Any]:
    """Produce a non-writing, reviewable candidate for the new app schema.

    Source values are retained verbatim in `source`; candidates deliberately do
    not claim route/publication compatibility where the backup lacks that data.
    """
    envelope = map_row(table, row)
    candidate: dict[str, Any] = {
        "mappingVersion": TARGET_MAPPING_VERSION,
        "sourceTable": table,
        "sourceId": envelope["sourceId"],
        "sourceKey": envelope["sourceKey"],
        "source": envelope["payload"],
        "target": None,
        "reviewState": "quarantined",
        "issues": [],
    }
    if table == "posts":
        source_id = str(row["id"])
        candidate["target"] = {
            "schema": "app", "table": "posts", "id": source_id,
            # The legacy dump has no slug. This stable placeholder must not
            # become a public URL until an explicit route map is approved.
            "slug": f"legacy-{source_id}", "title": row.get("title") or "Untitled legacy post",
            "content": row.get("content") or "", "publicationState": "draft",
            "visibility": "private", "publishedAt": None,
            "legacyStatus": row.get("status"), "legacyViews": row.get("views"),
        }
        candidate["issues"] = ["slug-not-present-in-source", "source-timezone-unresolved", "publication-review-required"]
    elif table == "media":
        candidate["target"] = {"schema": "legacy", "table": "media", "id": str(row["id"])}
        candidate["issues"] = ["asset-publication-and-delivery-unverified"]
    elif table == "post_media":
        candidate["target"] = {"schema": "legacy", "table": "post_media", "id": str(row["id"])}
        candidate["issues"] = ["relationship-preserved-in-restricted-staging"]
    elif table in {"content", "content_media", "users", "bug_reports"}:
        candidate["target"] = {"schema": "legacy", "table": table, "id": str(row["id"])}
        candidate["issues"] = ["semantic-or-retention-review-required"]
    else:
        raise ValueError("unsupported source row")
    return candidate
