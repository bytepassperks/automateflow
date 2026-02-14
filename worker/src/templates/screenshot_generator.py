import asyncio
import logging
from typing import Dict, Any

from ..browser_manager import browser_manager
from ..utils.anti_detection import apply_stealth
from ..utils.storage import upload_screenshot

logger = logging.getLogger(__name__)


async def run(parameters: Dict[str, Any], job_id: str, callback_fn) -> Dict[str, Any]:
    url = parameters.get("url")
    if not url:
        raise ValueError("url is required")

    viewport = parameters.get("viewport", {"width": 1920, "height": 1080})
    full_page = parameters.get("fullPage", False)

    width = viewport.get("width", 1920) if isinstance(viewport, dict) else 1920
    height = viewport.get("height", 1080) if isinstance(viewport, dict) else 1080

    context = await browser_manager.browser.new_context(
        viewport={"width": width, "height": height},
        locale="en-US",
    )
    page = await context.new_page()
    await apply_stealth(page)

    try:
        await callback_fn(logs=[f"Navigating to {url}..."])
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)

        await callback_fn(logs=["Taking screenshot..."])
        screenshot_bytes = await page.screenshot(full_page=full_page)

        screenshot_url = upload_screenshot(screenshot_bytes, job_id)
        await callback_fn(
            logs=["Screenshot captured successfully"],
            screenshots=[screenshot_url],
        )

        return {
            "screenshotUrl": screenshot_url,
            "url": url,
            "viewport": {"width": width, "height": height},
            "fullPage": full_page,
        }

    finally:
        await context.close()
