import os
import time
import json
import logging
import base64
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class LLMProvider:
    def __init__(self, name, api_key_env, rate_limit_per_min, supports_vision=False):
        self.name = name
        self.api_key = os.getenv(api_key_env, "")
        self.rate_limit = rate_limit_per_min
        self.supports_vision = supports_vision
        self.request_timestamps = []
        self.is_available = bool(self.api_key)

    def can_make_request(self):
        if not self.is_available:
            return False
        now = time.time()
        self.request_timestamps = [t for t in self.request_timestamps if now - t < 60]
        return len(self.request_timestamps) < self.rate_limit

    def record_request(self):
        self.request_timestamps.append(time.time())


class GoogleAIProvider(LLMProvider):
    def __init__(self):
        super().__init__("google_ai_studio", "GOOGLE_AI_STUDIO_KEY", 15, supports_vision=True)
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def generate(self, prompt: str, image_base64: Optional[str] = None) -> str:
        model = "models/gemini-2.0-flash"
        url = f"{self.base_url}/{model}:generateContent?key={self.api_key}"

        parts = [{"text": prompt}]
        if image_base64:
            parts.append({
                "inline_data": {
                    "mime_type": "image/png",
                    "data": image_base64,
                }
            })

        payload = {"contents": [{"parts": parts}]}

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                content = candidates[0].get("content", {})
                parts = content.get("parts", [])
                if parts:
                    return parts[0].get("text", "")
        return ""


class GroqProvider(LLMProvider):
    def __init__(self):
        super().__init__("groq", "GROQ_API_KEY", 30, supports_vision=False)
        self.base_url = "https://api.groq.com/openai/v1"

    async def generate(self, prompt: str, image_base64: Optional[str] = None) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 4096,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


class CerebrasProvider(LLMProvider):
    def __init__(self):
        super().__init__("cerebras", "CEREBRAS_API_KEY", 30, supports_vision=False)
        self.base_url = "https://api.cerebras.ai/v1"

    async def generate(self, prompt: str, image_base64: Optional[str] = None) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "llama-3.3-70b",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 4096,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


class OpenRouterProvider(LLMProvider):
    def __init__(self):
        super().__init__("openrouter", "OPENROUTER_API_KEY", 20, supports_vision=True)
        self.base_url = "https://openrouter.ai/api/v1"

    async def generate(self, prompt: str, image_base64: Optional[str] = None) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        content = []
        content.append({"type": "text", "text": prompt})
        if image_base64:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{image_base64}"},
            })

        model = "qwen/qwen2.5-vl-7b-instruct" if image_base64 else "qwen/qwen2.5-72b-instruct"
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "max_tokens": 4096,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


class HuggingFaceProvider(LLMProvider):
    def __init__(self):
        super().__init__("huggingface", "HF_API_TOKEN", 60, supports_vision=True)
        self.base_url = "https://api-inference.huggingface.co/models"

    async def generate(self, prompt: str, image_base64: Optional[str] = None) -> str:
        model = "Qwen/Qwen2.5-VL-7B-Instruct"
        url = f"{self.base_url}/{model}"
        headers = {"Authorization": f"Bearer {self.api_key}"}

        payload = {"inputs": prompt, "parameters": {"max_new_tokens": 4096}}

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                return data[0].get("generated_text", "")
            return str(data)


class LLMRouter:
    def __init__(self):
        self.providers = [
            GoogleAIProvider(),
            GroqProvider(),
            CerebrasProvider(),
            OpenRouterProvider(),
            HuggingFaceProvider(),
        ]
        self._retry_after = 0

    async def generate(self, prompt: str, image_base64: Optional[str] = None, require_vision: bool = False) -> str:
        if time.time() < self._retry_after:
            wait_time = self._retry_after - time.time()
            logger.info(f"All providers rate-limited, waiting {wait_time:.0f}s")
            await self._async_sleep(wait_time)

        for provider in self.providers:
            if require_vision and not provider.supports_vision:
                continue
            if not provider.can_make_request():
                continue

            try:
                logger.info(f"Using LLM provider: {provider.name}")
                provider.record_request()
                result = await provider.generate(prompt, image_base64)
                if result:
                    return result
            except Exception as e:
                logger.warning(f"Provider {provider.name} failed: {e}")
                continue

        logger.warning("All providers exhausted, queuing retry in 60s")
        self._retry_after = time.time() + 60
        raise Exception("All LLM providers are rate-limited or unavailable")

    async def _async_sleep(self, seconds):
        import asyncio
        await asyncio.sleep(seconds)


llm_router = LLMRouter()
