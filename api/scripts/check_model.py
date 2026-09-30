"""Check model metadata access without sending conversation or order data."""

import os
import re
import sys

import httpx

MODEL_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]*\Z")


def main() -> None:
    provider = os.environ.get("MODEL_PROVIDER", "").strip().lower()
    model = os.environ.get("MODEL_NAME", "").strip()
    if not model:
        raise SystemExit("Configura MODEL_NAME con el modelo que vas a utilizar")
    if not MODEL_ID.fullmatch(model):
        raise SystemExit("MODEL_NAME debe ser un ID de modelo, sin rutas ni URL")

    if provider == "openai":
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            raise SystemExit("Falta OPENAI_API_KEY")
        url = f"https://api.openai.com/v1/models/{model}"
        headers = {"Authorization": f"Bearer {key}"}
    elif provider == "gemini":
        key = os.environ.get("GEMINI_API_KEY")
        if not key:
            raise SystemExit("Falta GEMINI_API_KEY")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}"
        headers = {"x-goog-api-key": key}
    else:
        raise SystemExit("MODEL_PROVIDER debe ser openai o gemini")

    try:
        response = httpx.get(url, headers=headers, timeout=20)
    except httpx.HTTPError:
        raise SystemExit("No se pudo conectar con el proveedor") from None
    if not response.is_success:
        raise SystemExit(f"No se pudo consultar el modelo: HTTP {response.status_code}")
    print("Modelo accesible. Verifica también una generación breve como parte de los 90 minutos.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Consulta cancelada", file=sys.stderr)
        sys.exit(130)
