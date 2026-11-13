"""Code-observed v5 contracts compared with a sanitized legacy inventory."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

CURRENT_V5_CONTRACTS = {
    "user_profiles": {"id", "email", "username", "first_name", "last_name", "avatar_color", "role", "enabled", "is_owner", "is_whitelist_admin", "can_view_private", "is_banned", "banned_at", "banned_reason", "created_at", "updated_at"},
    "posts": {"id", "slug", "title", "excerpt", "content", "status", "date", "thumbnail_url", "created_at", "updated_at"},
    "media": {"id", "post_id", "type", "url", "caption", "idx", "title", "created_at"},
    "home_sections": {"key", "title", "description", "thumbnail_url", "body"},
    "home_media": {"id", "section_key", "type", "url", "caption", "idx"},
    "home_projects": {"id", "idx", "title", "slug", "excerpt", "href", "color", "image_url", "content", "status", "created_at", "updated_at"},
    "home_project_media": {"id", "project_id", "type", "url", "caption", "idx", "meta", "created_at"},
    "terminal_commands": {"id", "name", "aliases", "description", "actions", "requires_auth", "role", "show_in_help", "enabled", "rate_limit_per_min", "updated_at"},
}

SOURCE_TO_V5 = {
    "user_profiles": "users",
    "posts": "posts",
    "media": "media",
    "home_sections": "content",
    "home_media": "content_media",
    "home_projects": "content",
    "home_project_media": "content_media",
    "terminal_commands": None,
}


def compare_contracts(inventory: dict) -> dict:
    source = inventory.get("applicationColumns", {})
    result = {}
    for target, expected in CURRENT_V5_CONTRACTS.items():
        source_name = SOURCE_TO_V5[target]
        source_fields = {column["name"] for column in source.get(source_name, [])} if source_name else set()
        result[target] = {
            "candidateSource": f"public.{source_name}" if source_name and source_name in source else None,
            "sourceFieldsPresent": sorted(expected & source_fields),
            "targetFieldsMissingFromCandidate": sorted(expected - source_fields),
            "sourceFieldsNotInTargetContract": sorted(source_fields - expected),
            "dropInCompatible": bool(source_name and expected <= source_fields),
        }
    return {
        "evidence": "backup schema versus code-observed v5 query/payload contracts",
        "currentDatabaseCompared": False,
        "contracts": result,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare sanitized backup schema with code-observed v5 model contracts")
    parser.add_argument("--inventory", type=Path, default=Path(".artifacts/phase3e/backup-inspection.json"))
    args = parser.parse_args()
    with args.inventory.open(encoding="utf-8") as source:
        inventory = json.load(source)
    print(json.dumps(compare_contracts(inventory), sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
