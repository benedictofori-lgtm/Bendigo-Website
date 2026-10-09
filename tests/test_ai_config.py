import json
import unittest
from unittest.mock import Mock, patch

from backend import main


class OllamaConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.base_url = patch.object(main, "OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        self.model = patch.object(main, "OLLAMA_MODEL", "qwen2.5:3b")
        self.gateway_url = patch.object(main, "AI_BASE_URL", "")
        self.gateway_model = patch.object(main, "AI_MODEL", "")
        for patcher in (self.base_url, self.model, self.gateway_url, self.gateway_model):
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_ollama_is_reported_as_configured(self):
        self.assertTrue(main.ollama_configured())
        self.assertTrue(main.ai_configured())

    def test_ollama_is_not_configured_without_base_url(self):
        with patch.object(main, "OLLAMA_BASE_URL", ""):
            self.assertFalse(main.ollama_configured())
            self.assertFalse(main.ai_configured())

    def test_ollama_reply_uses_chat_endpoint_and_model(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps({
            "message": {"content": "Hello from Ollama"}
        }).encode("utf-8")

        with patch.object(main, "urlopen", return_value=response) as mocked_urlopen:
            answer = main.ai_model_reply(
                "What is HTML?",
                [{"role": "user", "content": "I am learning web development."}],
            )

        self.assertEqual(answer, "Hello from Ollama")
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "http://127.0.0.1:11434/api/chat")
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(payload["model"], "qwen2.5:3b")
        self.assertFalse(payload["stream"])
        self.assertEqual(payload["messages"][-2]["content"], "I am learning web development.")
        self.assertEqual(payload["messages"][-1]["content"], "What is HTML?")

    def test_ollama_empty_reply_is_rejected(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps({"message": {"content": " "}}).encode("utf-8")

        with patch.object(main, "urlopen", return_value=response):
            with self.assertRaises(RuntimeError):
                main.ai_model_reply("Say hello", [])


if __name__ == "__main__":
    unittest.main()
