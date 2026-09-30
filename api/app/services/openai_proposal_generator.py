from openai import OpenAI

from app.core.config import settings
from app.schemas.conversation_draft import ProposalOutput


class ProposalGenerationError(RuntimeError):
    pass


class OpenAIProposalGenerator:
    def generate(self, conversation: dict, products: list) -> ProposalOutput:
        if not settings.openai_api_key or not settings.model_name.strip():
            raise ProposalGenerationError("OPENAI_API_KEY y MODEL_NAME son necesarios")
        catalog = [{"product_id": p.id, "name": p.name} for p in products]
        try:
            response = OpenAI(api_key=settings.openai_api_key).chat.completions.parse(
                model=settings.model_name,
                messages=[
                    {"role": "system", "content": (
                        "Interpreta el pedido. Por cada producto pedido, devuelve su descripción, "
                        "product_id del catálogo si puedes asociarlo exactamente o null si no, y "
                        "quantity o null si falta. No inventes datos ni incluyas precios. Registra "
                        "datos faltantes y pedidos sin equivalencia en los campos correspondientes."
                    )},
                    {"role": "user", "content": (
                        f"Conversación: {conversation['text']}\nCatálogo: {catalog}"
                    )},
                ],
                response_format=ProposalOutput,
            )
            parsed = response.choices[0].message.parsed
            if parsed is None:
                raise ProposalGenerationError("Respuesta estructurada vacía")
            return parsed
        except ProposalGenerationError:
            raise
        except Exception as exc:
            raise ProposalGenerationError("OpenAI proposal generation failed") from exc


openai_proposal_generator = OpenAIProposalGenerator()
