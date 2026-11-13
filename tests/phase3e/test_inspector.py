import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/phase3e"))
SPEC = importlib.util.spec_from_file_location("phase3e_inspector", ROOT / "scripts/phase3e/inspect_backup.py")
inspector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(inspector)
SPEC_COMPAT = importlib.util.spec_from_file_location("phase3e_compat", ROOT / "scripts/phase3e/compatibility.py")
compat = importlib.util.module_from_spec(SPEC_COMPAT)
SPEC_COMPAT.loader.exec_module(compat)
SPEC_MAP = importlib.util.spec_from_file_location("phase3e_mapping", ROOT / "scripts/phase3e/legacy_mapping.py")
mapping = importlib.util.module_from_spec(SPEC_MAP)
SPEC_MAP.loader.exec_module(mapping)
from validate_migration import compare_snapshots, validate_batch


class DumpParserTests(unittest.TestCase):
    def test_copy_values_are_counted_but_never_returned(self):
        dump = b'''-- PostgreSQL database dump\nCREATE TABLE public.posts (id uuid, content text);\nCOPY public.posts (id, content) FROM stdin;\n00000000-0000-0000-0000-000000000001\tprivate body\n\\.\n'''
        report = inspector.inspect_bytes(dump)
        self.assertEqual(report["applicationCopyRows"], {"public.posts": 1})
        self.assertEqual(report["copyWidthErrors"], {})
        self.assertNotIn("private body", repr(report))
        self.assertFalse(report["rawContentEmitted"])

    def test_copy_width_error_is_detected_without_echoing_row(self):
        dump = b'''CREATE TABLE public.users (id integer, email text);\nCOPY public.users (id, email) FROM stdin;\n1\tsecret@example.invalid\textra\n\\.\n'''
        report = inspector.inspect_bytes(dump)
        self.assertEqual(report["copyWidthErrors"], {"public.users": 1})
        self.assertNotIn("secret@example.invalid", repr(report))

    def test_semicolons_inside_dollar_quoted_functions_do_not_split(self):
        dump = b'''CREATE FUNCTION public.synthetic() RETURNS void AS $tag$ BEGIN PERFORM 'not; a statement'; END $tag$ LANGUAGE plpgsql;\n'''
        report = inspector.inspect_bytes(dump)
        self.assertEqual(report["statementCount"], 1)

    def test_column_inventory_excludes_default_values(self):
        dump = b'''CREATE TABLE public.users (id integer NOT NULL, email text DEFAULT 'private@example.invalid', password text);\n'''
        report = inspector.inspect_bytes(dump)
        self.assertEqual(report["applicationColumns"]["users"], [
            {"name": "id", "type": "integer", "nullable": False},
            {"name": "email", "type": "text", "nullable": True},
            {"name": "password", "type": "text", "nullable": True},
        ])
        self.assertNotIn("private@example.invalid", repr(report))


class CompatibilityTests(unittest.TestCase):
    def test_reported_backup_does_not_satisfy_v5_table_contracts(self):
        inventory = {"applicationColumns": {
            "posts": [{"name": x} for x in ["id", "title", "content", "views", "created_at", "updated_at", "deleted_at", "status", "deletion_date"]],
            "media": [{"name": x} for x in ["id", "url", "key", "caption", "type", "uploaded_at", "context", "title", "order_index"]],
        }}
        report = compat.compare_contracts(inventory)
        self.assertFalse(report["currentDatabaseCompared"])
        self.assertFalse(report["contracts"]["posts"]["dropInCompatible"])
        self.assertIn("slug", report["contracts"]["posts"]["targetFieldsMissingFromCandidate"])
        self.assertFalse(report["contracts"]["home_sections"]["candidateSource"])
        self.assertFalse(report["contracts"]["terminal_commands"]["candidateSource"])

    def test_post_mapping_is_idempotent_and_never_publishes(self):
        row = {"id": "00000000-0000-0000-0000-000000000001", "status": "active", "content": "synthetic body", "created_at": "2025-01-02 03:04:05"}
        first = mapping.map_row("posts", row)
        second = mapping.map_row("posts", row)
        self.assertEqual(first, second)
        self.assertEqual(first["payload"], row)
        self.assertFalse(first["publiclyReadable"])
        self.assertEqual(first["publicationDisposition"], "quarantined")
        self.assertEqual(first["sourceKey"], mapping.stable_source_key("posts", row["id"]))

    def test_user_secrets_are_excluded_and_admin_is_not_granted(self):
        row = {"id": 5, "username": "synthetic", "email": "synthetic@example.invalid", "is_admin": True, "password": "hash", "reset_token": "token", "reset_token_expires": "date"}
        mapped = mapping.map_row("users", row)
        self.assertNotIn("password", mapped["payload"])
        self.assertNotIn("reset_token", mapped["payload"])
        self.assertNotIn("reset_token_expires", mapped["payload"])
        self.assertTrue(mapped["payload"]["is_admin"])
        self.assertEqual(mapped["privilegesGranted"], [])

    def test_media_urls_and_timestamp_strings_are_preserved(self):
        row = {"id": "media-1", "url": "https://example.invalid/existing.webp", "key": "original/key.webp", "uploaded_at": "2025-01-02 03:04:05"}
        mapped = mapping.map_row("media", row)
        self.assertEqual(mapped["payload"], row)
        self.assertEqual(mapped["deliveryDisposition"], "unverified")
        self.assertEqual(mapping.canonical_row_fingerprint("media", row), mapping.canonical_row_fingerprint("media", row))

    def test_unknown_table_is_fail_closed(self):
        with self.assertRaises(ValueError):
            mapping.map_row("terminal_commands", {"id": "x"})

    def test_batch_preserves_source_counts_and_checks_relationships(self):
        source = {
            "posts": [{"id": "p-1", "status": "active", "content": "synthetic"}],
            "media": [{"id": "m-1", "url": "https://example.invalid/a.jpg", "uploaded_at": "2025-01-01 00:00:00"}],
            "post_media": [{"id": 1, "post_id": "p-1", "media_id": "m-1", "media_order": 0}],
        }
        result = validate_batch(source)
        self.assertTrue(result["valid"])
        self.assertEqual(result["sourceCounts"], result["mappedCounts"])
        self.assertEqual(result["sourceCounts"], result["candidateCounts"])
        self.assertEqual(result, validate_batch(source))
        self.assertFalse(result["recordValuesEmitted"])

    def test_batch_rejects_orphans_and_duplicate_identifiers(self):
        source = {
            "posts": [{"id": "same"}, {"id": "same"}],
            "post_media": [{"id": 1, "post_id": "missing", "media_id": "missing-media"}],
        }
        result = validate_batch(source)
        self.assertFalse(result["valid"])
        self.assertEqual(result["violations"]["duplicate_source_id"], 1)
        self.assertEqual(result["violations"]["orphan_reference"], 2)

    def test_batch_detects_existing_target_id_and_slug_conflicts_without_echoing_values(self):
        source = {"posts": [{"id": "p-1", "title": "Synthetic", "status": "active"}]}
        existing = [{"id": "p-1", "slug": "legacy-p-1"}]
        result = validate_batch(source, existing)
        self.assertFalse(result["valid"])
        self.assertEqual(result["violations"]["target_id_conflict"], 1)
        self.assertEqual(result["violations"]["target_slug_conflict"], 1)
        self.assertNotIn("p-1", repr(result))
        self.assertFalse(result["importReady"])

    def test_snapshot_diff_reports_only_aggregate_changes(self):
        before = {"posts": [{"id": "p1", "title": "Old synthetic title"}, {"id": "p2", "title": "Removed"}]}
        after = {"posts": [{"id": "p1", "title": "New synthetic title"}, {"id": "p3", "title": "Added"}]}
        result = compare_snapshots(before, after)
        self.assertEqual(result["tables"]["posts"]["changed"], 1)
        self.assertEqual(result["tables"]["posts"]["added"], 1)
        self.assertEqual(result["tables"]["posts"]["removed"], 1)
        self.assertNotIn("synthetic", repr(result))
        self.assertFalse(result["credentialFieldsCompared"])

    def test_snapshot_diff_fails_visibly_on_duplicate_identifiers(self):
        result = compare_snapshots(
            {"posts": [{"id": "repeat", "title": "first"}, {"id": "repeat", "title": "second"}]},
            {"posts": [{"id": "repeat", "title": "first"}]},
        )
        self.assertEqual(result["duplicateIdCount"], 1)
        self.assertEqual(result["tables"]["posts"]["duplicateIds"], 1)
        self.assertEqual(result["tables"]["posts"]["beforeCount"], 1)
        self.assertFalse(result["recordValuesEmitted"])


if __name__ == "__main__":
    unittest.main()
