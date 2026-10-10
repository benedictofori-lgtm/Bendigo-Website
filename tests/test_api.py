"""Small dependency-light tests for the Bendigo AI FastAPI endpoints.

Run from the repository root with: python -m unittest discover -s tests
"""
import unittest
from unittest.mock import patch

from backend import main


class BackendEndpointTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        main.chat_history.clear()
        self.env_patches = [
            patch.object(main, "DATABASE_URL", ""),
            patch.object(main, "GITHUB_TOKEN", ""),
            patch.object(main, "AI_BASE_URL", ""),
            patch.object(main, "AI_MODEL", ""),
            patch.object(main, "AI_API_KEY", ""),
            patch.object(main, "OLLAMA_BASE_URL", ""),
            patch.object(main, "OLLAMA_MODEL", "qwen2.5:3b"),
        ]
        for item in self.env_patches:
            item.start()
            self.addCleanup(item.stop)

    async def test_health_reports_core_services_without_network_call(self):
        with patch.object(main, "github_repository_accessible", return_value=True):
            result = await main.health()
        self.assertEqual(result["status"], "healthy")
        self.assertEqual(result["service"], "bendigo-ai-backend")
        self.assertTrue(result["github"]["connected"])
        self.assertFalse(result["aiConfigured"])

    async def test_chat_returns_clear_fallback_metadata(self):
        result = await main.chat(main.ChatRequest(message="hello", sessionId="unit-test"))
        self.assertTrue(result["success"])
        self.assertIn("Bendigo AI", result["reply"])
        self.assertTrue(result["fallback"])
        self.assertFalse(result["modelUsed"])
        history = await main.get_chat_history("unit-test")
        self.assertEqual(len(history["messages"]), 2)

    async def test_delete_chat_history_clears_session(self):
        await main.chat(main.ChatRequest(message="hello", sessionId="delete-test"))
        result = await main.delete_chat_history("delete-test")
        history = await main.get_chat_history("delete-test")
        self.assertTrue(result["success"])
        self.assertEqual(history["messages"], [])

    async def test_html_code_template_escapes_prompt(self):
        result = await main.code(main.CodeRequest(
            language="html",
            prompt="<script>alert('x')</script>",
        ))
        self.assertTrue(result["success"])
        self.assertIn("&lt;script&gt;", result["code"])
        self.assertNotIn("<script>alert('x')</script>", result["code"])
        self.assertTrue(result["fallback"])

    async def test_ai_status_does_not_expose_credentials(self):
        result = await main.ai_status()
        self.assertFalse(result["configured"])
        self.assertFalse(result["browserSecretExposure"])
        self.assertNotIn("apiKey", result)
        self.assertNotIn("token", result)


if __name__ == "__main__":
    unittest.main()
