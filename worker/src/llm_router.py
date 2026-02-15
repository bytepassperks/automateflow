import os
import logging
import httpx

logger = logging.getLogger(__name__)


def create_llm():
    cerebras_key = os.getenv("CEREBRAS_API_KEY", "")
    if cerebras_key:
        from browser_use import ChatOpenAI
        logger.info("Using Cerebras (llama-3.3-70b) as primary LLM")
        return ChatOpenAI(
            model="llama-3.3-70b",
            api_key=cerebras_key,
            base_url="https://api.cerebras.ai/v1",
            frequency_penalty=None,
            add_schema_to_system_prompt=True,
            dont_force_structured_output=True,
        )

    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    if openrouter_key:
        from browser_use import ChatOpenAI
        logger.info("Using OpenRouter (google/gemini-2.0-flash-001) as primary LLM")
        return ChatOpenAI(
            model="google/gemini-2.0-flash-001",
            api_key=openrouter_key,
            base_url="https://openrouter.ai/api/v1",
        )

    google_key = os.getenv("GOOGLE_AI_STUDIO_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
    if google_key:
        from browser_use import ChatGoogle
        os.environ["GOOGLE_API_KEY"] = google_key
        logger.info("Using Google Gemini (gemini-2.0-flash) as primary LLM")
        return ChatGoogle(model="gemini-2.0-flash")

    raise ValueError("No LLM API key configured. Set CEREBRAS_API_KEY, OPENROUTER_API_KEY, or GOOGLE_AI_STUDIO_KEY.")


def create_fallback_llm():
    hf_key = os.getenv("HUGGINGFACE_API_KEY", "") or os.getenv("HF_TOKEN", "")
    if hf_key:
        from browser_use import ChatOpenAI
        logger.info("Using HuggingFace (Qwen/Qwen2.5-72B-Instruct) as fallback LLM")
        return ChatOpenAI(
            model="Qwen/Qwen2.5-72B-Instruct",
            api_key=hf_key,
            base_url="https://router.huggingface.co/novita/v3/openai",
            frequency_penalty=None,
            add_schema_to_system_prompt=True,
            dont_force_structured_output=True,
        )

    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    if openrouter_key:
        from browser_use import ChatOpenAI
        logger.info("Using OpenRouter (google/gemini-2.0-flash-001) as fallback LLM")
        return ChatOpenAI(
            model="google/gemini-2.0-flash-001",
            api_key=openrouter_key,
            base_url="https://openrouter.ai/api/v1",
        )

    logger.warning("No fallback LLM configured")
    return None


class _ShimLLMRouter:
    async def generate(self, prompt: str, image_base64: str | None = None, require_vision: bool = False) -> str:
        # Prefer Google for vision
        google_key = os.getenv("GOOGLE_AI_STUDIO_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
        if require_vision and google_key:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={google_key}"
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
                r = await client.post(url, json=payload)
                r.raise_for_status()
                data = r.json()
                cands = data.get("candidates", [])
                if cands:
                    content = cands[0].get("content", {})
                    parts = content.get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
                return ""

        # Try OpenRouter generic
        or_key = os.getenv("OPENROUTER_API_KEY", "")
        if or_key:
            headers = {"Authorization": f"Bearer {or_key}", "Content-Type": "application/json"}
            content = [{"type": "text", "text": prompt}]
            model = "qwen/qwen2.5-vl-7b-instruct" if (require_vision or image_base64) else "qwen/qwen2.5-72b-instruct"
            if image_base64:
                content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}})
            payload = {"model": model, "messages": [{"role": "user", "content": content}], "max_tokens": 1024}
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers)
                r.raise_for_status()
                data = r.json()
                return data["choices"][0]["message"]["content"]

        # Fallback: Cerebras text
        cerebras_key = os.getenv("CEREBRAS_API_KEY", "")
        if cerebras_key:
            headers = {"Authorization": f"Bearer {cerebras_key}", "Content-Type": "application/json"}
            payload = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": prompt}], "max_tokens": 1024}
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post("https://api.cerebras.ai/v1/chat/completions", json=payload, headers=headers)
                r.raise_for_status()
                data = r.json()
                return data["choices"][0]["message"]["content"]

        raise RuntimeError("No LLM provider available for llm_router shim")


llm_router = _ShimLLMRouter()
