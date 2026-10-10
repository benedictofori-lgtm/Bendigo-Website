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

    def test_current_prompt_is_not_duplicated_when_in_history(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps({
            "message": {"content": "A response"}
        }).encode("utf-8")
        history = [
            {"role": "user", "content": "Earlier question"},
            {"role": "assistant", "content": "Earlier answer"},
            {"role": "user", "content": "Current question"},
        ]

        with patch.object(main, "urlopen", return_value=response) as mocked_urlopen:
            main.ai_model_reply("Current question", history)

        request = mocked_urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        user_messages = [
            item for item in payload["messages"]
            if item["role"] == "user" and item["content"] == "Current question"
        ]
        self.assertEqual(len(user_messages), 1)


    def test_code_endpoint_uses_configured_model_and_returns_code(self):
        import asyncio

        with patch.object(main, "ai_configured", return_value=True), \
             patch.object(main, "ollama_configured", return_value=True), \
             patch.object(main, "ai_model_reply", return_value="print('Hello')") as mocked_reply:
            result = asyncio.run(main.code(main.CodeRequest(language="python", prompt="Print hello")))

        self.assertEqual(result["code"], "print('Hello')")
        self.assertEqual(result["model"], "qwen2.5:3b")
        self.assertEqual(result["status"], "model_generated")
        self.assertTrue(result["modelUsed"])
        self.assertFalse(result["fallback"])
        self.assertIn("Generate working python code", mocked_reply.call_args.args[0])

    def test_code_endpoint_falls_back_to_template_without_model(self):
        import asyncio

        with patch.object(main, "ai_configured", return_value=False):
            result = asyncio.run(main.code(main.CodeRequest(language="python", prompt="Print hello")))

        self.assertEqual(result["model"], "bendigo-template-engine")
        self.assertEqual(result["status"], "template_fallback")
        self.assertFalse(result["modelUsed"])
        self.assertTrue(result["fallback"])
        self.assertIn("No AI model is configured", result["notice"])
        self.assertIn("Bendigo AI Python starter", result["code"])

    def test_ollama_empty_reply_is_rejected(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps({"message": {"content": " "}}).encode("utf-8")

        with patch.object(main, "urlopen", return_value=response):
            with self.assertRaises(RuntimeError):
                main.ai_model_reply("Say hello", [])


    def test_chat_reports_fallback_when_configured_model_fails(self):
        import asyncio

        request = main.ChatRequest(message="Explain Python", sessionId="test-session")
        with (
            patch.object(main, "ai_configured", return_value=True),
            patch.object(main, "ai_model_reply", side_effect=TimeoutError()),
            patch.object(main, "db_get_history", return_value=[]),
            patch.object(main, "db_add_messages") as save_messages,
        ):
            result = asyncio.run(main.chat(request))

        self.assertTrue(result["success"])
        self.assertTrue(result["fallback"])
        self.assertFalse(result["modelUsed"])
        self.assertTrue(result["modelError"])
        self.assertIn("could not be reached", result["notice"])
        save_messages.assert_called_once()

    def test_stream_done_event_reports_fallback_when_model_fails(self):
        import asyncio

        request = main.ChatRequest(message="Explain Python", sessionId="stream-session")
        with (
            patch.object(main, "ai_configured", return_value=True),
            patch.object(main, "ollama_configured", return_value=True),
            patch.object(main, "ai_model_reply", side_effect=TimeoutError()),
            patch.object(main, "db_get_history", return_value=[]),
            patch.object(main, "db_add_messages"),
        ):
            response = asyncio.run(main.chat_stream(request))

            async def read_body():
                chunks = []
                async for chunk in response.body_iterator:
                    chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
                return "".join(chunks)

            body = asyncio.run(read_body())

        done_line = next(
            line[6:] for line in body.splitlines()
            if line.startswith("data: {") and '"fallback"' in line
        )
        done = json.loads(done_line)
        self.assertTrue(done["fallback"])
        self.assertFalse(done["modelUsed"])
        self.assertTrue(done["modelError"])
        self.assertEqual(done["model"], "bendigo-backend")

if __name__ == "__main__":
    unittest.main()
