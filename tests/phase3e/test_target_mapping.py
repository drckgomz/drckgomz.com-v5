import unittest

from scripts.phase3e.legacy_mapping import target_candidate


class TargetCandidateTests(unittest.TestCase):
    def test_active_posts_are_private_drafts_with_stable_legacy_slug(self):
        row = {"id": "a1", "title": "old title", "content": "<p>kept</p>", "status": "active", "created_at": "2020-01-02 03:04:05"}
        candidate = target_candidate("posts", row)
        self.assertEqual(candidate["target"]["id"], "a1")
        self.assertEqual(candidate["target"]["publicationState"], "draft")
        self.assertEqual(candidate["target"]["visibility"], "private")
        self.assertIsNone(candidate["target"]["publishedAt"])
        self.assertIn("slug-not-present-in-source", candidate["issues"])
        self.assertEqual(candidate["source"]["created_at"], row["created_at"])

    def test_users_never_become_auth_accounts_or_roles(self):
        row = {"id": 3, "username": "legacy", "email": "private@example.invalid", "is_admin": True, "password": "secret-hash"}
        candidate = target_candidate("users", row)
        self.assertEqual(candidate["target"], {"schema": "legacy", "table": "users", "id": "3"})
        self.assertNotIn("password", candidate["source"])
        self.assertEqual(candidate["reviewState"], "quarantined")

    def test_media_relationships_remain_in_restricted_staging(self):
        candidate = target_candidate("post_media", {"id": 7, "post_id": "p", "media_id": "m", "media_order": 2})
        self.assertEqual(candidate["target"]["table"], "post_media")
        self.assertEqual(candidate["source"]["media_id"], "m")


if __name__ == "__main__":
    unittest.main()
