import asyncio
import logging
import re
from typing import Dict, Any

from ..browser_manager import browser_manager
from ..utils.anti_detection import apply_stealth
from ..llm_router import llm_router

logger = logging.getLogger(__name__)


async def run(parameters: Dict[str, Any], job_id: str, callback_fn) -> Dict[str, Any]:
    product_url = parameters.get("productUrl")
    target_price = parameters.get("targetPrice")

    if not product_url:
        raise ValueError("productUrl is required")
    if target_price is None:
        raise ValueError("targetPrice is required")

    target_price = float(target_price)
    context = await browser_manager.create_context(job_id)
    page = await context.new_page()
    await apply_stealth(page)

    screenshot_task = await browser_manager.run_with_screenshots(
        page, job_id, callback_fn, interval=3.0
    )

    try:
        await callback_fn(logs=["Navigating to product page..."])
        await page.goto(product_url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        await callback_fn(logs=["Extracting price information..."])

        page_content = await page.content()
        screenshot_b64 = await browser_manager.take_screenshot_base64(page)

        prompt = f"""Look at this product page and extract the current price.
Return ONLY a JSON object with these fields:
- productName: string (the product name)
- currentPrice: number (the current price as a number, no currency symbol)
- currency: string (e.g. "USD", "EUR")
- originalPrice: number or null (if there's a strikethrough/original price)
- inStock: boolean

Only return the JSON, no other text.

HTML content (first 5000 chars):
{page_content[:5000]}"""

        result_text = await llm_router.generate(prompt, image_base64=screenshot_b64, require_vision=True)

        import json
        try:
            start = result_text.find("{")
            end = result_text.rfind("}") + 1
            if start >= 0 and end > start:
                price_data = json.loads(result_text[start:end])
            else:
                price_data = {"currentPrice": None, "productName": "Unknown"}
        except json.JSONDecodeError:
            price_data = {"currentPrice": None, "productName": "Unknown"}

        current_price = price_data.get("currentPrice")
        is_below = False
        if current_price is not None:
            is_below = float(current_price) <= target_price

        result = {
            **price_data,
            "targetPrice": target_price,
            "isBelowTarget": is_below,
            "url": product_url,
        }

        status_msg = f"Current price: {current_price} (target: {target_price}) - {'BELOW' if is_below else 'ABOVE'} target"
        await callback_fn(logs=[status_msg])

        return result

    finally:
        screenshot_task.cancel()
        try:
            await screenshot_task
        except asyncio.CancelledError:
            pass
        await context.close()
