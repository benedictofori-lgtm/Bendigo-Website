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

    async def test_python_variable_question_gets_an_explanation(self):
        result = await main.chat(main.ChatRequest(
            message="Explain what a Python variable is and give me a simple example.",
            sessionId="variable-test",
        ))
        self.assertTrue(result["success"])
        self.assertIn("variable", result["reply"].lower())
        self.assertIn("name =", result["reply"])
        self.assertTrue(result["fallback"])

    async def test_python_loop_question_gets_an_example(self):
        result = await main.chat(main.ChatRequest(
            message="Explain a Python for loop with an example.",
            sessionId="loop-test",
        ))
        self.assertIn("range(1, 4)", result["reply"])
        self.assertIn("loop", result["reply"].lower())

    async def test_general_question_does_not_claim_to_be_full_ai(self):
        result = await main.chat(main.ChatRequest(
            message="What is the capital of France?",
            sessionId="general-test",
        ))
        self.assertTrue(result["fallback"])
        self.assertIn("language model", result["reply"].lower())

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
        self.assertEqual(result["connectionStatus"], "not_configured")
        self.assertFalse(result["browserSecretExposure"])
        self.assertNotIn("apiKey", result)
        self.assertNotIn("token", result)

    async def test_ollama_probe_reports_unconfigured_without_network_call(self):
        result = main.probe_ollama()
        self.assertEqual(result, {
            "status": "not_configured",
            "reachable": False,
            "modelAvailable": False,
        })

    async def test_ollama_probe_confirms_selected_model_is_available(self):
        response = type("Response", (), {
            "__enter__": lambda self: self,
            "__exit__": lambda self, *args: None,
            "read": lambda self: b'{"models":[{"name":"qwen2.5:3b"}]}',
        })()
        with patch.object(main, "OLLAMA_BASE_URL", "https://ollama.example"), \\
             patch.object(main, "OLLAMA_MODEL", "qwen2.5:3b"), \\
             patch.object(main, "urlopen", return_value=response):
            result = main.probe_ollama()
        self.assertEqual(result["status"], "ready")
        self.assertTrue(result["reachable"])
        self.assertTrue(result["modelAvailable"])

    async def test_ollama_probe_hides_connection_errors(self):
        with patch.object(main, "OLLAMA_BASE_URL", "https://ollama.example"), \\
             patch.object(main, "OLLAMA_MODEL", "qwen2.5:3b"), \\
             patch.object(main, "urlopen", side_effect=TimeoutError("private endpoint detail")):
            result = main.probe_ollama()
        self.assertEqual(result["status"], "unreachable")
        self.assertNotIn("private endpoint detail", str(result))


if __name__ == "__main__":
    unittest.main()
