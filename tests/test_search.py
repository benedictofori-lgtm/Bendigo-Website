import unittest
from unittest.mock import Mock, patch

from backend import main


class WebSearchTests(unittest.TestCase):
    def response(self, html, status=200):
        response = Mock()
        response.status = status
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = html.encode("utf-8")
        return response

    def test_search_parses_valid_result_and_snippet(self):
        html = '''
        <a class="result__a" href="https://example.com/page">Example <b>Page</b></a>
        <div class="result__snippet">A useful <b>summary</b> here.</div>
        '''
        with patch.object(main, "urlopen", return_value=self.response(html)):
            result = main.search("example")

        self.assertTrue(result["success"])
        self.assertEqual(result["query"], "example")
        self.assertEqual(len(result["results"]), 1)
        self.assertEqual(result["results"][0]["title"], "Example Page")
        self.assertEqual(result["results"][0]["url"], "https://example.com/page")
        self.assertIn("useful summary", result["results"][0]["snippet"])
        self.assertIsNone(result["notice"])

    def test_search_extracts_duckduckgo_redirect_destination(self):
        html = '''
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Farticle">Article</a>
        '''
        with patch.object(main, "urlopen", return_value=self.response(html)):
            result = main.search("article")

        self.assertTrue(result["success"])
        self.assertEqual(result["results"][0]["url"], "https://example.com/article")

    def test_search_skips_invalid_result_links(self):
        html = '''
        <a class="result__a" href="javascript:alert(1)">Unsafe result</a>
        <a class="result__a" href="https://example.com/good">Good result</a>
        '''
        with patch.object(main, "urlopen", return_value=self.response(html)):
            result = main.search("test")

        self.assertTrue(result["success"])
        self.assertEqual([item["title"] for item in result["results"]], ["Good result"])

    def test_search_empty_results_returns_notice(self):
        with patch.object(main, "urlopen", return_value=self.response("<html><body>No matches</body></html>")):
            result = main.search("nothing")

        self.assertTrue(result["success"])
        self.assertEqual(result["results"], [])
        self.assertIn("No usable search results", result["notice"])

    def test_search_provider_failure_returns_safe_error(self):
        with patch.object(main, "urlopen", side_effect=TimeoutError("private connection detail")):
            result = main.search("test")

        self.assertFalse(result["success"])
        self.assertEqual(result["results"], [])
        self.assertIn("temporarily unavailable", result["error"])
        self.assertNotIn("private connection detail", str(result))

    def test_search_non_success_http_status_is_handled(self):
        with patch.object(main, "urlopen", return_value=self.response("<html>blocked</html>", status=503)):
            result = main.search("test")

        self.assertFalse(result["success"])
        self.assertEqual(result["results"], [])


if __name__ == "__main__":
    unittest.main()
