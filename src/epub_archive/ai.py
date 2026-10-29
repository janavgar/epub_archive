from __future__ import annotations

from dataclasses import asdict, dataclass
import json
import logging
import math
import os
from pathlib import Path
import re
import time
from typing import Any
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

PROVIDER_PRESETS: dict[str, dict[str, Any]] = {
    "lm_studio": {
        "id": "lm_studio",
        "name": "LM Studio",
        "default_base_url": "http://localhost:1234/v1",
        "requires_api_key": False,
        "local": True,
        "description": "Servidor local LM Studio (puerto 1234)",
    },
    "ollama": {
        "id": "ollama",
        "name": "Ollama",
        "default_base_url": "http://localhost:11434/v1",
        "requires_api_key": False,
        "local": True,
        "description": "Servidor local Ollama (puerto 11434)",
    },
    "llamacpp": {
        "id": "llamacpp",
        "name": "llama.cpp",
        "default_base_url": "http://localhost:8080/v1",
        "requires_api_key": False,
        "local": True,
        "description": "Servidor local llama-server / llama.cpp (puerto 8080)",
    },
    "vllm": {
        "id": "vllm",
        "name": "vLLM / LocalAI",
        "default_base_url": "http://localhost:8000/v1",
        "requires_api_key": False,
        "local": True,
        "description": "Servidor local vLLM o LocalAI (puerto 8000)",
    },
    "openai": {
        "id": "openai",
        "name": "OpenAI",
        "default_base_url": "https://api.openai.com/v1",
        "requires_api_key": True,
        "local": False,
        "description": "API oficial de OpenAI (GPT-4o, text-embedding-3)",
    },
    "gemini": {
        "id": "gemini",
        "name": "Google Gemini",
        "default_base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "requires_api_key": True,
        "local": False,
        "description": "API de Google Gemini compatible con OpenAI",
    },
    "openrouter": {
        "id": "openrouter",
        "name": "OpenRouter",
        "default_base_url": "https://openrouter.ai/api/v1",
        "requires_api_key": True,
        "local": False,
        "description": "Pasarela multi-modelo OpenRouter",
    },
    "custom": {
        "id": "custom",
        "name": "Personalizado (OpenAI Compatible)",
        "default_base_url": "http://localhost:1234/v1",
        "requires_api_key": False,
        "local": False,
        "description": "Cualquier endpoint compatible con el estándar OpenAI /v1",
    },
}

EMBED_KEYWORDS = ("embed", "embedding", "nomic", "bge", "minilm", "e5", "mxbai", "arctic-embed", "jina-embeddings")


def normalize_base_url(base_url: str, provider: str = "lm_studio") -> str:
    """Normalizes a base URL, adding /v1 when a bare host:port is provided for standard local servers."""
    cleaned = (base_url or "").strip().rstrip("/")
    if not cleaned:
        preset = PROVIDER_PRESETS.get(provider, PROVIDER_PRESETS["lm_studio"])
        cleaned = preset["default_base_url"].rstrip("/")

    try:
        parsed = urlparse(cleaned)
        if parsed.scheme in ("http", "https") and parsed.netloc and parsed.path in ("", "/"):
            if provider in ("lm_studio", "ollama", "llamacpp", "vllm", "openai"):
                cleaned = f"{cleaned}/v1"
    except Exception:
        pass

    return cleaned


def infer_provider_from_url(base_url: str) -> str:
    lower = (base_url or "").lower()
    if ":1234" in lower:
        return "lm_studio"
    if ":11434" in lower or "ollama" in lower:
        return "ollama"
    if ":8080" in lower:
        return "llamacpp"
    if ":8000" in lower:
        return "vllm"
    if "api.openai.com" in lower:
        return "openai"
    if "generativelanguage.googleapis.com" in lower:
        return "gemini"
    if "openrouter.ai" in lower:
        return "openrouter"
    return "custom"


@dataclass
class AIConfig:
    provider: str = "lm_studio"
    base_url: str = "http://localhost:1234/v1"
    api_key: str = ""
    chat_model: str = ""
    embedding_model: str = ""
    separate_embedding: bool = False
    embedding_provider: str = "lm_studio"
    embedding_base_url: str = ""
    embedding_api_key: str = ""
    timeout: int = 120

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AIConfig:
        provider = str(data.get("provider") or "lm_studio").strip()
        if provider not in PROVIDER_PRESETS:
            provider = "custom"
        preset = PROVIDER_PRESETS[provider]
        raw_base_url = str(data.get("base_url") or preset["default_base_url"]).strip()
        base_url = normalize_base_url(raw_base_url, provider)

        separate_embedding = bool(data.get("separate_embedding", False))
        emb_provider = str(data.get("embedding_provider") or provider).strip()
        if emb_provider not in PROVIDER_PRESETS:
            emb_provider = "custom"
        emb_preset = PROVIDER_PRESETS[emb_provider]
        raw_emb_url = str(data.get("embedding_base_url") or "").strip()
        if separate_embedding and not raw_emb_url:
            raw_emb_url = emb_preset["default_base_url"]
        emb_base_url = normalize_base_url(raw_emb_url, emb_provider) if raw_emb_url else ""

        return cls(
            provider=provider,
            base_url=base_url,
            api_key=str(data.get("api_key") or "").strip(),
            chat_model=str(data.get("chat_model") or "").strip(),
            embedding_model=str(data.get("embedding_model") or "").strip(),
            separate_embedding=separate_embedding,
            embedding_provider=emb_provider,
            embedding_base_url=emb_base_url,
            embedding_api_key=str(data.get("embedding_api_key") or "").strip(),
            timeout=int(data.get("timeout") or 120),
        )


def get_config_path(data_dir: Path | None = None) -> Path:
    resolved_dir = data_dir or Path(os.getenv("EPUB_ARCHIVE_DATA_DIR", ".epub_archive"))
    return resolved_dir / "ai_config.json"


def load_ai_config(data_dir: Path | None = None) -> AIConfig:
    """Loads persisted AI configuration from ai_config.json or falls back to environment variables."""
    config_path = get_config_path(data_dir)
    file_data: dict[str, Any] = {}
    if config_path.is_file():
        try:
            file_data = json.loads(config_path.read_text(encoding="utf-8"))
            if not isinstance(file_data, dict):
                file_data = {}
        except Exception as exc:
            logger.warning("No se pudo leer %s: %s", config_path, exc)

    # Environment variable overrides (AI_* takes highest priority over file, legacy LM_STUDIO_* used as fallback)
    env_provider = os.getenv("AI_PROVIDER", "").strip()
    env_base_url = os.getenv("AI_BASE_URL", "").strip()
    env_api_key = (
        os.getenv("AI_API_KEY", "").strip()
        or os.getenv("OPENAI_API_KEY", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip()
    )
    env_chat_model = os.getenv("AI_CHAT_MODEL", "").strip()
    env_emb_model = os.getenv("AI_EMBEDDING_MODEL", "").strip()
    env_emb_provider = os.getenv("AI_EMBEDDING_PROVIDER", "").strip()
    env_emb_base_url = os.getenv("AI_EMBEDDING_BASE_URL", "").strip()
    env_emb_api_key = os.getenv("AI_EMBEDDING_API_KEY", "").strip()

    legacy_base_url = os.getenv("LM_STUDIO_BASE_URL", "").strip() or os.getenv("OLLAMA_BASE_URL", "").strip()
    legacy_chat_model = os.getenv("LM_STUDIO_CHAT_MODEL", "").strip()
    legacy_emb_model = os.getenv("LM_STUDIO_EMBEDDING_MODEL", "").strip()

    provider = env_provider or file_data.get("provider") or ""
    base_url = env_base_url or file_data.get("base_url") or legacy_base_url or ""

    if not provider:
        provider = infer_provider_from_url(base_url) if base_url else "lm_studio"

    if not base_url:
        preset = PROVIDER_PRESETS.get(provider, PROVIDER_PRESETS["lm_studio"])
        base_url = preset["default_base_url"]

    separate_embedding = bool(
        file_data.get("separate_embedding", False)
        or env_emb_provider
        or env_emb_base_url
    )

    merged = {
        "provider": provider,
        "base_url": base_url,
        "api_key": env_api_key or file_data.get("api_key") or "",
        "chat_model": env_chat_model or file_data.get("chat_model") or legacy_chat_model or "",
        "embedding_model": env_emb_model or file_data.get("embedding_model") or legacy_emb_model or "",
        "separate_embedding": separate_embedding,
        "embedding_provider": env_emb_provider or file_data.get("embedding_provider") or provider,
        "embedding_base_url": env_emb_base_url or file_data.get("embedding_base_url") or "",
        "embedding_api_key": env_emb_api_key or file_data.get("embedding_api_key") or "",
        "timeout": file_data.get("timeout", 120),
    }
    return AIConfig.from_dict(merged)


def save_ai_config(config: AIConfig, data_dir: Path | None = None) -> Path:
    """Persists AI configuration to <data_dir>/ai_config.json."""
    config_path = get_config_path(data_dir)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(
        json.dumps(config.to_dict(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return config_path


class LocalAIClient:
    """Client for local and cloud OpenAI-compatible AI backends (LM Studio, Ollama, llama.cpp, vLLM, OpenAI, Gemini)."""

    def __init__(
        self,
        base_url: str | None = None,
        chat_model: str | None = None,
        embedding_model: str | None = None,
        timeout: int = 120,
        *,
        provider: str | None = None,
        api_key: str | None = None,
        separate_embedding: bool | None = None,
        embedding_provider: str | None = None,
        embedding_base_url: str | None = None,
        embedding_api_key: str | None = None,
        config: AIConfig | None = None,
        data_dir: Path | None = None,
    ) -> None:
        base_cfg = config or load_ai_config(data_dir)

        if provider:
            self.provider = provider if provider in PROVIDER_PRESETS else "custom"
            # If provider was explicitly overridden and base_url was not, use provider's default URL
            if not base_url and self.provider != base_cfg.provider:
                base_url = PROVIDER_PRESETS[self.provider]["default_base_url"]
        elif base_url:
            self.provider = infer_provider_from_url(base_url)
        else:
            self.provider = base_cfg.provider

        raw_url = base_url or base_cfg.base_url or os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
        self.base_url = normalize_base_url(raw_url, self.provider)
        self.api_key = api_key if api_key is not None else base_cfg.api_key

        self.chat_model = (
            chat_model
            if chat_model is not None and chat_model != ""
            else (base_cfg.chat_model or os.getenv("LM_STUDIO_CHAT_MODEL") or None)
        )
        self.embedding_model = (
            embedding_model
            if embedding_model is not None and embedding_model != ""
            else (base_cfg.embedding_model or os.getenv("LM_STUDIO_EMBEDDING_MODEL") or None)
        )

        # Configure separate embedding backend if enabled or explicitly passed
        has_separate_emb = (
            separate_embedding
            if separate_embedding is not None
            else (bool(embedding_provider or embedding_base_url) or base_cfg.separate_embedding)
        )
        self.separate_embedding = has_separate_emb

        if has_separate_emb:
            self.embedding_provider = (
                embedding_provider
                or base_cfg.embedding_provider
                or self.provider
            )
            if self.embedding_provider not in PROVIDER_PRESETS:
                self.embedding_provider = "custom"

            raw_emb_url = (
                embedding_base_url
                or (
                    PROVIDER_PRESETS[self.embedding_provider]["default_base_url"]
                    if embedding_provider and embedding_provider != base_cfg.embedding_provider
                    else base_cfg.embedding_base_url
                )
                or PROVIDER_PRESETS[self.embedding_provider]["default_base_url"]
            )
            self.embedding_base_url = normalize_base_url(raw_emb_url, self.embedding_provider)
            self.embedding_api_key = (
                embedding_api_key
                if embedding_api_key is not None
                else (base_cfg.embedding_api_key or self.api_key)
            )
        else:
            self.embedding_provider = self.provider
            self.embedding_base_url = self.base_url
            self.embedding_api_key = self.api_key

        self.timeout = timeout or base_cfg.timeout
        self.session = requests.Session()
        self._discovered_chat_model: str | None = None
        self._discovered_embedding_model: str | None = None

    def _headers(self, api_key: str | None = None) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        key = api_key if api_key is not None else self.api_key
        if key:
            headers["Authorization"] = f"Bearer {key}"
        return headers

    def _resolve_docker_fallback_url(self, url: str) -> str | None:
        """If running inside a Docker container and localhost fails, offers host.docker.internal fallback."""
        if not Path("/.dockerenv").exists():
            return None
        if "localhost" in url:
            return url.replace("localhost", "host.docker.internal")
        if "127.0.0.1" in url:
            return url.replace("127.0.0.1", "host.docker.internal")
        return None

    def _fetch_models_from_endpoint(
        self,
        target_base_url: str,
        target_api_key: str = "",
        target_provider: str = "lm_studio",
    ) -> list[str]:
        headers = self._headers(target_api_key)
        urls_to_try = [target_base_url]
        docker_alt = self._resolve_docker_fallback_url(target_base_url)
        if docker_alt and docker_alt not in urls_to_try:
            urls_to_try.append(docker_alt)

        last_exc: Exception | None = None
        for candidate_base in urls_to_try:
            try:
                response = self.session.get(
                    f"{candidate_base}/models",
                    headers=headers,
                    timeout=min(self.timeout, 15),
                )
                if response.status_code == 404 and (target_provider == "ollama" or ":11434" in candidate_base):
                    # Try Ollama native /api/tags endpoint
                    root_url = re.sub(r"/v1$", "", candidate_base)
                    tags_resp = self.session.get(
                        f"{root_url}/api/tags",
                        headers=headers,
                        timeout=min(self.timeout, 15),
                    )
                    tags_resp.raise_for_status()
                    tags_data = tags_resp.json()
                    models_list = tags_data.get("models", []) if isinstance(tags_data, dict) else []
                    return [
                        m.get("name") or m.get("model")
                        for m in models_list
                        if isinstance(m, dict) and (m.get("name") or m.get("model"))
                    ]

                response.raise_for_status()
                payload = response.json()
                if isinstance(payload, dict):
                    models_data = payload.get("data", payload.get("models", []))
                    if isinstance(models_data, list):
                        extracted = [
                            (m.get("id") or m.get("name") or m.get("model"))
                            for m in models_data
                            if isinstance(m, dict) and (m.get("id") or m.get("name") or m.get("model"))
                        ]
                        return [str(item) for item in extracted if item]
                return []
            except Exception as exc:
                last_exc = exc

        provider_label = PROVIDER_PRESETS.get(target_provider, {}).get("name", target_provider)
        raise RuntimeError(
            f"No se pudieron consultar los modelos de {provider_label} en {target_base_url}/models: {last_exc}"
        ) from last_exc

    def _fetch_available_models(self) -> list[str]:
        return self._fetch_models_from_endpoint(self.base_url, self.api_key, self.provider)

    def _fetch_available_embedding_models(self) -> list[str]:
        return self._fetch_models_from_endpoint(
            self.embedding_base_url, self.embedding_api_key, self.embedding_provider
        )

    def get_chat_model(self) -> str:
        if self.chat_model:
            return self.chat_model
        if self._discovered_chat_model:
            return self._discovered_chat_model

        models = self._fetch_available_models()
        if not models:
            provider_label = PROVIDER_PRESETS.get(self.provider, {}).get("name", self.provider)
            raise RuntimeError(f"No hay modelos disponibles en el servidor de IA ({provider_label}: {self.base_url}).")

        # Filter out obvious embedding models
        chat_candidates = [
            m for m in models if not any(k in m.lower() for k in EMBED_KEYWORDS)
        ]
        self._discovered_chat_model = chat_candidates[0] if chat_candidates else models[0]
        logger.info("Modelo de chat seleccionado automáticamente (%s): %s", self.provider, self._discovered_chat_model)
        return self._discovered_chat_model

    def get_embedding_model(self) -> str:
        if self.embedding_model:
            return self.embedding_model
        if self._discovered_embedding_model:
            return self._discovered_embedding_model

        models = self._fetch_available_embedding_models()
        if not models:
            provider_label = PROVIDER_PRESETS.get(self.embedding_provider, {}).get("name", self.embedding_provider)
            raise RuntimeError(
                f"No hay modelos disponibles en el servidor de embeddings ({provider_label}: {self.embedding_base_url})."
            )

        # Prioritize models with embed / embedding / nomic / bge / e5 / mxbai
        embed_candidates = [
            m for m in models if any(k in m.lower() for k in EMBED_KEYWORDS)
        ]
        if embed_candidates:
            self._discovered_embedding_model = embed_candidates[0]
        else:
            # Fall back to last model if no specific embedding model is tagged
            self._discovered_embedding_model = models[-1]

        logger.info(
            "Modelo de embeddings seleccionado automáticamente (%s): %s",
            self.embedding_provider,
            self._discovered_embedding_model,
        )
        return self._discovered_embedding_model

    def _post_with_retry(
        self,
        url: str,
        payload: dict[str, Any],
        max_retries: int = 3,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        headers = self._headers(api_key)
        last_exc: Exception | None = None

        urls_to_try = [url]
        docker_alt = self._resolve_docker_fallback_url(url)
        if docker_alt and docker_alt not in urls_to_try:
            urls_to_try.append(docker_alt)

        for attempt in range(1, max_retries + 1):
            for target_url in urls_to_try:
                try:
                    response = self.session.post(
                        target_url,
                        json=payload,
                        headers=headers,
                        timeout=self.timeout,
                    )
                    if response.status_code in (400, 401, 403, 404):
                        raise RuntimeError(
                            f"HTTP {response.status_code} en {target_url}: {response.text[:300]}"
                        )
                    response.raise_for_status()
                    return response.json()
                except Exception as exc:
                    last_exc = exc
            if attempt < max_retries:
                wait_time = 1.5 * attempt
                logger.warning(
                    "Error en petición a %s (intento %d/%d): %s. Reintentando en %.1fs...",
                    url,
                    attempt,
                    max_retries,
                    last_exc,
                    wait_time,
                )
                time.sleep(wait_time)
            else:
                break
        raise RuntimeError(f"Falló la petición a {url} tras {max_retries} intentos: {last_exc}") from last_exc

    def classify(
        self,
        title: str,
        author: str,
        sample: str,
        candidate_categories: list[str] | None = None,
        year: str = "",
    ) -> dict[str, Any]:
        """Classifies an EPUB using zero-shot LLM analysis, validating metadata and extracting summary."""
        model = self.get_chat_model()

        category_instruction = (
            f"Selecciona de 1 a 3 categorías estrictamente de esta lista: {json.dumps(candidate_categories, ensure_ascii=False)}. Si ninguna encaja exactamente, asigna la más afín."
            if candidate_categories
            else "Asigna entre 1 y 4 categorías temáticas concisas (ej: Novela histórica, Ensayo filosófico, Divulgación científica)."
        )

        year_info = f", año registrado={year!r}" if year else ""
        prompt = (
            "Eres un bibliotecario y documentalista experto. Tu tarea es analizar los metadatos y la muestra del libro para validarlos y clasificar la obra.\n\n"
            f"Metadatos del archivo EPUB: título={title!r}, autor={author!r}{year_info}.\n\n"
            f"Muestra de contenido (índice, inicio y cierre del libro):\n{sample}\n\n"
            "Instrucciones:\n"
            "1. Validación de Metadata: Comprueba si el título o autor del archivo tienen erratas, están invertidos o no coinciden con la portada o el inicio. En caso afirmativo, corrígelos. Si son correctos, mantén los originales.\n"
            f"2. Categorización: {category_instruction}\n"
            "3. Resumen: Escribe una sinopsis precisa de 2 o 3 oraciones en el idioma del libro.\n"
            "4. Palabras clave: Hasta 8 términos o conceptos clave.\n\n"
            "RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO. No agregues preámbulos, explicaciones ni bloques de pensamiento. "
            "Estructura exacta requerida:\n"
            "{\n"
            '  "title": "título validado",\n'
            '  "author": "autor validado",\n'
            '  "categories": ["cat1", "cat2"],\n'
            '  "summary": "resumen...",\n'
            '  "keywords": ["tag1", "tag2"]\n'
            "}"
        )

        payload = {
            "model": model,
            "temperature": 0.1,
            "messages": [
                {
                    "role": "system",
                    "content": "Eres un clasificador bibliográfico de alta precisión. Responde siempre y exclusivamente en JSON válido.",
                },
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 1500,
        }

        data_response = self._post_with_retry(
            f"{self.base_url}/chat/completions",
            payload,
            api_key=self.api_key,
        )
        message = data_response.get("choices", [{}])[0].get("message", {})
        raw_content = message.get("content") or ""

        # If content is empty (e.g. reasoning model wrote only into reasoning_content), check reasoning
        if not raw_content.strip() and message.get("reasoning_content"):
            raw_content = message["reasoning_content"]

        parsed = self._extract_json(raw_content)

        final_title = _string(parsed.get("title"), title)
        final_author = _string(parsed.get("author"), author)

        categories = _string_list(parsed.get("categories"), 5)
        if not categories:
            categories = ["General"]

        keywords = _string_list(parsed.get("keywords"), 8)
        summary = _string(parsed.get("summary"), "")

        return {
            "title": final_title,
            "author": final_author,
            "original_title": title,
            "original_author": author,
            "title_corrected": (final_title.casefold() != title.casefold()),
            "author_corrected": (final_author.casefold() != author.casefold()),
            "categories": categories,
            "summary": summary,
            "keywords": keywords,
        }

    def _extract_json(self, text: str) -> dict[str, Any]:
        """Extracts JSON safely from LLM output, handling markdown fences and surrounding commentary."""
        clean = text.strip()
        # Remove think blocks if present
        clean = re.sub(r"<think>.*?</think>", "", clean, flags=re.DOTALL).strip()
        # Remove markdown code fences
        clean = re.sub(r"^```(?:json)?\s*", "", clean)
        clean = re.sub(r"\s*```$", "", clean)

        # Locate outermost braces
        start = clean.find("{")
        end = clean.rfind("}")
        if start != -1 and end != -1 and end > start:
            clean = clean[start : end + 1]

        try:
            parsed = json.loads(clean)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            # Fallback regex extraction for critical keys
            title_m = re.search(r'"title"\s*:\s*"([^"]+)"', text)
            author_m = re.search(r'"author"\s*:\s*"([^"]+)"', text)
            summary_m = re.search(r'"summary"\s*:\s*"([^"]+)"', text)
            cats_m = re.findall(r'"categories"\s*:\s*\[(.*?)\]', text, re.DOTALL)
            categories = []
            if cats_m:
                categories = re.findall(r'"([^"]+)"', cats_m[0])
            keys_m = re.findall(r'"keywords"\s*:\s*\[(.*?)\]', text, re.DOTALL)
            keywords = []
            if keys_m:
                keywords = re.findall(r'"([^"]+)"', keys_m[0])

            if title_m or summary_m or categories:
                return {
                    "title": title_m.group(1) if title_m else "",
                    "author": author_m.group(1) if author_m else "",
                    "summary": summary_m.group(1) if summary_m else "",
                    "categories": categories,
                    "keywords": keywords,
                }
            raise RuntimeError(f"No se pudo decodificar JSON válido de la respuesta de IA: {text[:200]}")

        raise RuntimeError("La respuesta de IA no contiene un objeto JSON válido.")

    def embed(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """Generates embedding vectors for a list of text strings in batches."""
        if not texts:
            return []

        model = self.get_embedding_model()
        embeddings: list[list[float]] = []

        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            payload = {"model": model, "input": batch}
            data_response = self._post_with_retry(
                f"{self.embedding_base_url}/embeddings",
                payload,
                api_key=self.embedding_api_key,
            )

            data = data_response.get("data", [])
            if not isinstance(data, list) or len(data) != len(batch):
                raise RuntimeError(
                    f"El endpoint de embeddings devolvió {len(data)} vectores para un lote de {len(batch)} textos."
                )

            try:
                data.sort(key=lambda item: item["index"])
                vectors = [item["embedding"] for item in data]
                if any(
                    not isinstance(v, list)
                    or not v
                    or any(not isinstance(val, (int, float)) or not math.isfinite(val) for val in v)
                    for v in vectors
                ):
                    raise ValueError("Vector vacío o con valores no finitos.")
            except (KeyError, TypeError, ValueError) as exc:
                raise RuntimeError(f"El endpoint devolvió embeddings inválidos: {exc}") from exc

            embeddings.extend(vectors)

        dimensions = {len(v) for v in embeddings}
        if len(dimensions) > 1:
            raise RuntimeError(f"Vectores con dimensiones heterogéneas devueltos: {dimensions}")

        return embeddings


AIClient = LocalAIClient


def _string(value: Any, default: str) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else default


def _string_list(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()][:limit]
