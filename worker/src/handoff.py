import asyncio
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

CAPTCHA_SELECTORS = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="challenges.cloudflare"]',
    'iframe[src*="captcha"]',
    '[class*="captcha"]',
    '[id*="captcha"]',
    '[class*="recaptcha"]',
    '[id*="recaptcha"]',
    '[class*="hcaptcha"]',
    '[class*="cf-turnstile"]',
    '[data-sitekey]',
    '.g-recaptcha',
    '#captcha',
]

OTP_PATTERNS = [
    r'input[type="tel"]',
    r'input[autocomplete="one-time-code"]',
    r'input[name*="otp"]',
    r'input[name*="verification"]',
    r'input[name*="code"]',
    r'input[placeholder*="code"]',
    r'input[placeholder*="OTP"]',
    r'input[placeholder*="verification"]',
]

OTP_TEXT_PATTERNS = [
    r"enter.*(?:code|otp|verification)",
    r"(?:code|otp).*sent",
    r"two.?factor",
    r"2fa",
    r"verify.*(?:phone|email|identity)",
    r"one.?time.?password",
]


async def detect_captcha(page) -> Optional[str]:
    for selector in CAPTCHA_SELECTORS:
        try:
            element = await page.query_selector(selector)
            if element:
                is_visible = await element.is_visible()
                if is_visible:
                    logger.info(f"CAPTCHA detected via selector: {selector}")
                    return f"CAPTCHA detected: {selector}"
        except Exception:
            continue
    return None


async def detect_otp(page) -> Optional[str]:
    for pattern in OTP_PATTERNS:
        try:
            element = await page.query_selector(pattern)
            if element:
                is_visible = await element.is_visible()
                if is_visible:
                    logger.info(f"OTP input detected via: {pattern}")
                    return f"OTP input detected: {pattern}"
        except Exception:
            continue

    try:
        body_text = await page.inner_text("body")
        body_lower = body_text.lower()
        for pattern in OTP_TEXT_PATTERNS:
            if re.search(pattern, body_lower):
                logger.info(f"OTP text pattern detected: {pattern}")
                return f"OTP page detected: {pattern}"
    except Exception:
        pass

    return None


async def check_for_handoff(page) -> Optional[str]:
    captcha_reason = await detect_captcha(page)
    if captcha_reason:
        return captcha_reason

    otp_reason = await detect_otp(page)
    if otp_reason:
        return otp_reason

    return None


async def wait_for_handoff_resolution(callback_fn, job_id: str, timeout: int = 300):
    logger.info(f"Waiting for handoff resolution for job {job_id} (timeout: {timeout}s)")

    resolved = asyncio.Event()

    async def on_resolve():
        resolved.set()

    try:
        await asyncio.wait_for(resolved.wait(), timeout=timeout)
        logger.info(f"Handoff resolved for job {job_id}")
        return True
    except asyncio.TimeoutError:
        logger.warning(f"Handoff timeout for job {job_id}")
        return False
