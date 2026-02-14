import asyncio
import base64
import logging
import time
from typing import Optional

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from .utils.anti_detection import get_random_user_agent, get_random_viewport, apply_stealth
from .session_manager import save_session, load_session
from .handoff import check_for_handoff
from .utils.storage import upload_screenshot

logger = logging.getLogger(__name__)


class BrowserManager:
    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None

    async def start(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--window-size=1920,1080",
            ],
        )
        logger.info("Browser started")

    async def stop(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        logger.info("Browser stopped")

    async def create_context(self, job_id: str) -> BrowserContext:
        user_agent = get_random_user_agent()
        viewport = get_random_viewport()

        context = await self.browser.new_context(
            user_agent=user_agent,
            viewport=viewport,
            locale="en-US",
            timezone_id="America/New_York",
            ignore_https_errors=True,
        )

        await load_session(context, job_id)
        return context

    async def take_screenshot(self, page: Page, job_id: str) -> Optional[str]:
        try:
            screenshot_bytes = await page.screenshot(full_page=False)
            url = upload_screenshot(screenshot_bytes, job_id)
            return url
        except Exception as e:
            logger.warning(f"Failed to take screenshot: {e}")
            return None

    async def take_screenshot_base64(self, page: Page) -> Optional[str]:
        try:
            screenshot_bytes = await page.screenshot(full_page=False)
            return base64.b64encode(screenshot_bytes).decode("utf-8")
        except Exception as e:
            logger.warning(f"Failed to take screenshot: {e}")
            return None

    async def run_with_screenshots(self, page: Page, job_id: str, callback_fn, interval: float = 3.0):
        screenshot_task = asyncio.create_task(
            self._screenshot_loop(page, job_id, callback_fn, interval)
        )
        return screenshot_task

    async def _screenshot_loop(self, page: Page, job_id: str, callback_fn, interval: float):
        while True:
            try:
                url = await self.take_screenshot(page, job_id)
                if url and callback_fn:
                    await callback_fn(screenshots=[url])
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Screenshot loop error: {e}")
            await asyncio.sleep(interval)


browser_manager = BrowserManager()
