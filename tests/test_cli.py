import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs

from pypdf import PdfWriter

from tcool.catalog import download_jobs, parse_search
from tcool.browser import navigate_pdf
from tcool.cli import crawl, download, main, parser, pdf_pages, plan_downloads


def pdf():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()


def html(page=1, identifier=20002871, answer="pdf", last=2):
    answers = {'pdf': f'<a data-exam-id="{identifier}" data-download-kind="a"></a>',
               'ai': '<form action="/answer.php"><button>答案</button></form>', '': ''}
    return f'''<form id="exam-filter-form"></form>
    <div id="results-container"><div class="result">
      <span class="school">安和國小</span><span class="city">新北市</span>
      <span class="grade-subject">5年級 數學</span><span class="year-period">114上 期末2</span>
      <span class="publisher">南一</span>
      <a data-exam-id="{identifier}" data-download-kind="q" href="#"></a>
      <div class="answer">{answers[answer]}</div>
      <div class="mock"><a href="/mock/{identifier}/"></a></div>
      <div class="ai"><a href="/ai/{identifier}/"></a></div>
    </div></div>
    <div id="merged-container"><div class="result"><div class="col-start">段考範圍</div>
    <a class="mockButton" href="/mock/-30/"></a><a class="mergedButton" href="/ai/-30/"></a></div></div>
    <div id="pagination-container"><button class="current" onclick="gotoPage({page})">{page}</button>
    <button onclick="gotoPage({last})">{last}</button></div>'''


class CLITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name)
        self.args = parser().parse_args(['download', '--grade', '5', '--subject', '數學',
                                         '--output', str(self.output)])

    def test_html_three_answer_types(self):
        for kind in ('pdf', 'ai', ''):
            result = parse_search(html(answer=kind), 1)
            self.assertEqual(result.rows[0]['answer'], kind)
            self.assertEqual(result.rows[0]['exam_id'], 20002871)
            self.assertEqual(result.last_page, 2)
            self.assertEqual(result.merged[0]['ai'], 'https://www.tcool.cc/ai/-30/')

    def test_blocked_html_is_not_empty_success(self):
        with self.assertRaises(ValueError):
            parse_search('<title>Cloudflare</title>', 1)

    def test_wrong_page_detected(self):
        with self.assertRaises(ValueError):
            parse_search(html(page=1), 2)

    def test_missing_identifier_detected(self):
        with self.assertRaises(ValueError):
            parse_search(html().replace('20002871', 'invalid'), 1)

    def test_empty_result(self):
        self.assertEqual(parse_search('<div id="results-container"></div>', 1).rows, [])

    def test_jobs_deduplicate_and_skip_ai(self):
        rows = [{'exam_id': 1, 'answer': 'pdf'}, {'exam_id': 1, 'answer': 'pdf'},
                {'exam_id': 2, 'answer': 'ai'}, {'exam_id': 3, 'answer': '', 'has_question': False}]
        self.assertEqual(list(download_jobs(rows, 'both')), [(1, 'q'), (1, 'a'), (2, 'q')])

    def test_crawl_complete_and_exports(self):
        with patch('tcool.cli.request', side_effect=[html(), html(2, 20002872)]), patch('tcool.cli.time.sleep'):
            rows = crawl(None, self.args)
        self.assertEqual(len(rows), 2)
        result = json.loads((self.output / 'exams.json').read_text())
        self.assertTrue(result['complete'])
        self.assertEqual(result['pages_fetched'], 2)
        self.assertTrue((self.output / 'exams.csv').read_bytes().startswith(b'\xef\xbb\xbf'))

    def test_page_cap_marks_partial(self):
        self.args.max_pages = 1
        with patch('tcool.cli.request', return_value=html()):
            crawl(None, self.args)
        self.assertFalse(json.loads((self.output / 'exams.json').read_text())['complete'])

    def test_repeated_page_stops_keeps_partial(self):
        with patch('tcool.cli.request', side_effect=[html(), html(2)]), patch('tcool.cli.time.sleep'):
            with self.assertRaises(ValueError):
                crawl(None, self.args)
        self.assertFalse(json.loads((self.output / 'exams.json').read_text())['complete'])

    def test_pdf_validation(self):
        self.assertEqual(pdf_pages(pdf()), 1)
        with self.assertRaises(ValueError):
            pdf_pages(b'<html>denied</html>')

    def test_resume_and_limit(self):
        path = self.output / 'pdf' / 'tcool_1_q.pdf'
        path.parent.mkdir()
        path.write_bytes(pdf())
        self.args.limit = 1
        tasks = plan_downloads([{'exam_id': i} for i in [1, 2, 3]], self.args)
        self.assertEqual([(i, k) for i,k,p in tasks], [(2, 'q')])

    def test_corrupt_existing_stops(self):
        path = self.output / 'pdf' / 'tcool_1_q.pdf'
        path.parent.mkdir()
        path.write_bytes(b'<html>blocked</html>')
        with self.assertRaises(ValueError):
            plan_downloads([{'exam_id': 1}], self.args)

    def test_save_new_pdf_and_manifest(self):
        tasks = plan_downloads([{'exam_id': 1}], self.args)
        with patch('tcool.cli.api', return_value={'download_url': '/dl.php?t=fresh'}), \
             patch('tcool.cli.navigate_pdf', return_value=pdf()), \
             patch('tcool.cli.time.sleep'):
            download(None, self.args, tasks)
        self.assertTrue(tasks[0][2].exists())
        record = json.loads((self.output / 'downloads.jsonl').read_text())
        self.assertEqual(record['pages'], 1)
        self.assertNotIn('fresh', json.dumps(record))

    def test_html_download_not_saved_as_pdf(self):
        tasks = plan_downloads([{'exam_id': 1}], self.args)
        with patch('tcool.cli.api', return_value={'download_url': '/dl.php?t=fresh'}), \
             patch('tcool.cli.navigate_pdf', return_value=b'<html>blocked</html>'), \
             patch('tcool.cli.time.sleep'):
            with self.assertRaises(ValueError):
                download(None, self.args, tasks)
        self.assertFalse(tasks[0][2].exists())
        self.assertFalse((self.output / 'downloads.jsonl').exists())

    def test_interactive_download_recovery(self):
        self.args.interactive = True
        page = MagicMock()
        page.url = 'https://www.tcool.cc/'
        page.context.new_page.return_value.url = 'https://www.tcool.cc/v/example.pdf'
        first, second = MagicMock(), MagicMock()
        first.__enter__.return_value.value.failure.return_value = 'canceled'
        second.__enter__.return_value.value.failure.return_value = None
        second.__enter__.return_value.value.path.return_value = str(self.output / 'saved.pdf')
        (self.output / 'saved.pdf').write_bytes(pdf())
        page.expect_download.side_effect = [first, second]
        with patch('builtins.input', return_value=''):
            data = navigate_pdf(page, self.args, '/dl.php?t=fresh')
        self.assertEqual(pdf_pages(data), 1)
        self.assertEqual(page.expect_download.call_count, 2)
        page.context.new_page.return_value.close.assert_called_once()

    def test_reject_ambiguous_sources(self):
        with self.assertRaises(SystemExit) as e:
            main(['download', '--exam-id', '123', '--grade', '5'])
        self.assertEqual(e.exception.code, 2)

    def test_id_dry_run_needs_no_browser(self):
        with patch('tcool.cli.session') as browser, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(main(['download', '--exam-id', '1', '--dry-run', '--output', str(self.output)]), 0)
        browser.assert_not_called()

    def test_manual_import_without_browser_or_api(self):
        source = self.output / '手動下載.pdf'
        source.write_bytes(pdf())
        with patch('tcool.cli.session') as browser, patch('tcool.cli.api') as api_call, \
             patch('builtins.input', return_value=str(source)):
            result = main(['download', '--exam-id', '123', '--manual', '--output', str(self.output)])
        self.assertEqual(result, 0)
        browser.assert_not_called()
        api_call.assert_not_called()
        self.assertEqual((self.output / 'pdf' / 'tcool_123_q.pdf').read_bytes(), source.read_bytes())
        self.assertEqual(json.loads((self.output / 'downloads.jsonl').read_text())['exam_id'], 123)
        # Resuming never asks for a completed file again.
        with patch('builtins.input') as prompt:
            self.assertEqual(main(['download', '--exam-id', '123', '--manual', '--output', str(self.output)]), 0)
        prompt.assert_not_called()

    def test_manual_rejects_html_and_can_stop(self):
        source = self.output / 'blocked.pdf'
        source.write_text('<html>Cloudflare</html>')
        with patch('builtins.input', side_effect=[str(source), 'q']):
            result = main(['download', '--exam-id', '123', '--manual', '--output', str(self.output)])
        self.assertEqual(result, 130)
        self.assertFalse((self.output / 'pdf' / 'tcool_123_q.pdf').exists())
        self.assertFalse((self.output / 'downloads.jsonl').exists())

    def test_interactive_failure_falls_back_to_file_import(self):
        self.args.interactive = True
        source = self.output / 'download.pdf'
        source.write_bytes(pdf())
        tasks = plan_downloads([{'exam_id': 1}], self.args)
        with patch('tcool.cli.api', return_value={'download_url': '/dl.php?t=fresh'}), \
             patch('tcool.cli.navigate_pdf', side_effect=ValueError('尚未進入 PDF 分頁')), \
             patch('tcool.cli.time.sleep'), patch('builtins.input', return_value=str(source)):
            download(None, self.args, tasks)
        self.assertEqual(tasks[0][2].read_bytes(), source.read_bytes())

    def test_manual_requires_direct_source(self):
        with self.assertRaises(SystemExit) as error:
            main(['download', '--grade', '5', '--subject', '數學', '--manual'])
        self.assertEqual(error.exception.code, 2)


@unittest.skipUnless(os.environ.get('TCOOL_BROWSER_TESTS') == '1', 'set TCOOL_BROWSER_TESTS=1')
class BrowserIntegration(unittest.TestCase):
    def test_two_pages_api_redirect_pdf_and_resume(self):
        from playwright.sync_api import sync_playwright
        calls = []
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def send_body(self, body, mime='text/html; charset=utf-8'):
                body = body.encode() if isinstance(body, str) else body
                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                if self.path == '/dl.php?t=fresh':
                    self.send_response(302)
                    self.send_header('Location', '/v/test.pdf')
                    self.end_headers()
                elif self.path == '/v/test.pdf':
                    self.send_body(pdf(), 'application/pdf')
                else:
                    self.send_body('<form id="exam-filter-form"></form>')

            def do_POST(self):
                raw = self.rfile.read(int(self.headers['Content-Length'])).decode()
                if self.path == '/api-exam.php':
                    calls.append(json.loads(raw))
                    self.send_body(json.dumps({'error': None, 'download_url': '/dl.php?t=fresh'}), 'application/json')
                else:
                    form = parse_qs(raw)
                    number = int(form['p'][0])
                    self.send_body(html(number, 20002870 + number))
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        with tempfile.TemporaryDirectory() as temp, sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, channel=os.environ.get('TCOOL_TEST_CHANNEL'))
            try:
                context = browser.new_context(accept_downloads=True)
                page = context.new_page()
                page.goto(f'http://127.0.0.1:{server.server_port}/')
                args = parser().parse_args(['download', '--grade', '5', '--subject', '數學', '--output', temp])
                with patch('tcool.cli.time.sleep'):
                    rows = crawl(page, args)
                    download(page, args, plan_downloads(rows, args))
                self.assertEqual(len(list((Path(temp)/'pdf').glob('*.pdf'))), 2)
                self.assertEqual([c['exam_id'] for c in calls], [20002871, 20002872])
                self.assertEqual(plan_downloads(rows, args), [])
            finally:
                browser.close()


if __name__ == '__main__':
    unittest.main()
