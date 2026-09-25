from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from playwright.sync_api import sync_playwright

BASE = "https://www.tcool.cc"

# fetch is deliberately in the browser's same origin, with its own session.
# Challenge solving and site rate-limit recovery remain manual.
REQUEST = r"""async ({url, body, json, timeout}) => {
  const target = new URL(url, location.origin);
  if (target.origin !== location.origin) throw new Error('下載網址跨網域，請人工確認');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const options = {credentials: 'same-origin', signal: controller.signal};
    if (body !== null) {
      options.method = 'POST';
      options.headers = {'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded'};
      options.body = json ? JSON.stringify(body) : new URLSearchParams(body).toString();
    }
    const response = await fetch(target.href, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}：請在網站確認登入、驗證或用量限制`);
    return await response.text();
  } finally { clearTimeout(timer); }
}"""


@contextmanager
def session(args):
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            str(args.profile.resolve()), headless=args.headless,
            channel="chrome" if args.channel == "chrome" else None,
            accept_downloads=True,
        )
        try:
            page = context.pages[0] if context.pages else context.new_page()
            page.goto(BASE + "/", wait_until="domcontentloaded", timeout=args.timeout * 1000)
            if args.interactive or args.command == "login":
                input("請在瀏覽器確認首頁正常，必要時自行登入／完成驗證，再回此處按 Enter：")
            if urlsplit(page.url).netloc != "www.tcool.cc":
                raise ValueError("瀏覽器未回到 tcool，請先完成登入")
            # Missing form means this may be a challenge page, not a ready session.
            page.locator("#exam-filter-form").wait_for(state="attached", timeout=args.timeout * 1000)
            yield page
        finally:
            context.close()


def request(page, args, url, body=None, json_body=False):
    return page.evaluate(REQUEST, {"url": url, "body": body, "json": json_body,
                                  "timeout": args.timeout * 1000})


def navigate_pdf(page, args, url):
    """Save through the browser, rather than reading PDF viewer HTML."""
    target = urljoin(page.url, url)
    if (urlsplit(target).scheme, urlsplit(target).netloc) != (urlsplit(page.url).scheme, urlsplit(page.url).netloc):
        raise ValueError("下載網址跨網域，請人工確認")
    def save(address):
        with page.expect_download(timeout=args.timeout * 1000) as pending:
            page.evaluate("""url => {
              const a = document.createElement('a');
              a.href = url; a.download = 'exam.pdf';
              document.body.appendChild(a); a.click(); a.remove();
            }""", address)
        item = pending.value
        failure = item.failure()
        if failure:
            raise ValueError(f"瀏覽器下載失敗：{failure}")
        return Path(item.path()).read_bytes()

    try:
        return save(target)
    except Exception:
        if not args.interactive:
            raise
        # A verification page can appear only on /dl.php, even when the home
        # page and API work. Let the person operate that exact page themselves.
        viewer = page.context.new_page()
        try:
            viewer.goto(target, referer=page.url, wait_until="domcontentloaded", timeout=args.timeout * 1000)
            input("下載需人工確認：請在新分頁完成網站要求，直到看見 PDF，再按 Enter 重試保存一次：")
            resolved = viewer.url
            if urlsplit(resolved).netloc != urlsplit(page.url).netloc:
                raise ValueError("下載分頁不在原網站，已停止")
            if not urlsplit(resolved).path.lower().endswith('.pdf'):
                raise ValueError("尚未進入 PDF 分頁，請完成網站驗證後重新執行")
            return save(resolved)
        finally:
            viewer.close()
