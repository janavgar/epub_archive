from __future__ import annotations

import json
import logging
import math
import os
import re
import time
from typing import Any

import requests

logger = logging.getLogger(__name__)


class LocalAIClient:
    def __init__(
        self,
        base_url: str | None = None,
        chat_model: str | None = None,
        embedding_model: str | None = None,
        timeout: int = 120,
    ) -> None:
        self.base_url = (
            base_url or os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
        ).rstrip("/")
        self.chat_model = chat_model or os.getenv("LM_STUDIO_CHAT_MODEL")
        self.embedding_model = embedding_model or os.getenv(
            "LM_STUDIO_EMBEDDING_MODEL"
        )
        self.timeout = timeout
        self.session = requests.Session()
        self._discovered_chat_model: str | None = None
        self._discovered_embedding_model: str | None = None

    def _fetch_available_models(self) -> list[str]:
        try:
            response = self.session.get(f"{self.base_url}/models", timeout=self.timeout)
            response.raise_for_status()
            payload = response.json()
            models_data = payload.get("data", []) if isinstance(payload, dict) else []
            return [m["id"] for m in models_data if isinstance(m, dict) and m.get("id")]
        except Exception as exc:
            raise RuntimeError(
                f"No se pudieron consultar los modelos en {self.base_url}/models: {exc}"
            ) from exc

    def get_chat_model(self) -> str:
        if self.chat_model:
            return self.chat_model
        if self._discovered_chat_model:
            return self._discovered_chat_model

        models = self._fetch_available_models()
        if not models:
            raise RuntimeError("No hay modelos disponibles en el servidor local.")

        # Filter out obvious embedding models
        chat_candidates = [
            m for m in models if "embed" not in m.lower() and "nomic" not in m.lower()
        ]
        self._discovered_chat_model = chat_candidates[0] if chat_candidates else models[0]
        logger.info("Modelo de chat seleccionado automáticamente: %s", self._discovered_chat_model)
        return self._discovered_chat_model

    def get_embedding_model(self) -> str:
        if self.embedding_model:
            return self.embedding_model
        if self._discovered_embedding_model:
            return self._discovered_embedding_model

        models = self._fetch_available_models()
        if not models:
            raise RuntimeError("No hay modelos disponibles en el servidor local.")

        # Prioritize models with embed / embedding / nomic / bge / e5
        embed_keywords = ("embed", "embedding", "nomic", "bge", "minilm", "e5")
        embed_candidates = [
            m for m in models if any(k in m.lower() for k in embed_keywords)
        ]
        if embed_candidates:
            self._discovered_embedding_model = embed_candidates[0]
        else:
            # Fall back to first model if no specific embedding model is tagged
            self._discovered_embedding_model = models[-1]

        logger.info("Modelo de embeddings seleccionado automáticamente: %s", self._discovered_embedding_model)
        return self._discovered_embedding_model

    def _post_with_retry(self, url: str, payload: dict[str, Any], max_retries: int = 3) -> dict[str, Any]:
        last_exc: Exception | None = None
        for attempt in range(1, max_retries + 1):
            try:
                response = self.session.post(url, json=payload, timeout=self.timeout)
                if response.status_code == 400:
                    # Provide exact detail for bad requests
                    raise RuntimeError(f"HTTP 400 Bad Request en {url}: {response.text}")
                response.raise_for_status()
                return response.json()
            except Exception as exc:
                last_exc = exc
                if attempt < max_retries:
                    wait_time = 1.5 * attempt
                    logger.warning(
                        "Error en petición a %s (intento %d/%d): %s. Reintentando en %.1fs...",
                        url, attempt, max_retries, exc, wait_time
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

        data_response = self._post_with_retry(f"{self.base_url}/chat/completions", payload)
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
            data_response = self._post_with_retry(f"{self.base_url}/embeddings", payload)

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


def _string(value: Any, default: str) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else default


def _string_list(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()][:limit]

