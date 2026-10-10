import json
import unittest
from unittest.mock import Mock, patch

from backend import main


class OllamaSupportTests(unittest.TestCase):
    def setUp(self):
        self.base_url = patch.object(main, "OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        self.model = patch.object(main, "OLLAMA_MODEL", "qwen2.5:3b")
        self.base_url.start()
        self.model.start()
        self.addCleanup(self.base_url.stop)
        self.addCleanup(self.model.stop)

    def test_ollama_is_configured_only_with_url_and_model(self):
        self.assertTrue(main.ollama_configured())
        with patch.object(main, "OLLAMA_BASE_URL", ""):
            self.assertFalse(main.ollama_configured())

    def test_ollama_reply_sends_chat_request_and_returns_content(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps({
            "message": {"content": "Hello from Ollama"}
        }).encode("utf-8")

        with patch.object(main, "urlopen", return_value=response) as open_url:
            answer = main.ai_model_reply("Say hello", [])

        self.assertEqual(answer, "Hello from Ollama")
        request = open_url.call_args.args[0]
        self.assertEqual(request.full_url, "http://127.0.0.1:11434/api/chat")
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(payload["model"], "qwen2.5:3b")
        self.assertFalse(payload["stream"])
        self.assertEqual(payload["messages"][-1], {"role": "user", "content": "Say hello"})

    def test_ollama_empty_reply_is_rejected(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = b'{"message":{"content":" "}}'

        with patch.object(main, "urlopen", return_value=response):
            with self.assertRaises(RuntimeError):
                main.ai_model_reply("Say hello", [])


if __name__ == "__main__":
    unittest.main()
