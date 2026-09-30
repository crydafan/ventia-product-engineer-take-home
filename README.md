# VentIA — Conversación a pedido

Abre `guia-del-reto.html` en tu navegador para consultar la guía interactiva y el modo presentación.

## El reto

Ya tienes una bandeja de conversaciones en VentIA. Desde una conversación seleccionada, ayuda al asesor a crear un pedido con IA: muestra una propuesta basada en el catálogo, permite revisarla y corregirla, y crea un pedido que se pueda consultar después de recargar.

Tienes 90 minutos en total, incluyendo la preparación del proyecto y la comprobación del acceso al modelo. El proyecto y las instrucciones se comparten durante la reunión por Google Meet. Puedes y esperamos que uses Codex, Claude Code u otras herramientas de desarrollo asistido. Después tendremos una conversación de 20 minutos sobre lo construido.

## Qué recibes

Una bandeja con búsqueda y tres conversaciones de solo lectura, logo y colores de VentIA, Next.js, FastAPI, PostgreSQL, Docker, login resuelto, catálogo, vista de Pedidos con listado y detalle, y endpoints para crear y consultar pedidos. Puedes modificar el código que necesites.

## Qué construyes

La acción para generar una propuesta con IA desde el chat seleccionado; la revisión y corrección; la creación explícita; y la confirmación con acceso al pedido guardado. La vista Pedidos ya está implementada para consultar lo creado. Tú decides dónde y cómo presentar el flujo. Incluye estados de carga, datos faltantes y errores. No necesitas implementar mensajería ni editar conversaciones.

## Dónde empezar

`web/app/workspace/workspace-client.tsx` monta `InboxClient`. La selección se administra en `web/app/workspace/inbox-client.tsx`: cada conversación tiene `id`, `customer_name` y `text`. `text` conserva la conversación original; `customer_name` sirve para identificar la fila, no reemplaza la interpretación y revisión del pedido. Puedes usar el callback `onConversationChange` y la composición de cabecera, o adaptar los componentes. Los servicios autenticados están en `web/lib/services/orders.ts`. La vista de pedidos está en `/workspace/orders` y cada detalle en `/workspace/orders/{id}`. Después de crear un pedido, puedes enlazar a su detalle o dirigir al usuario a esa ruta. El listado tiene búsqueda y un botón Actualizar.

## Reglas del pedido

Nombre y dirección de entrega no vacíos; al menos un producto existente en el catálogo; cantidades enteras positivas. Cada producto del catálogo es una variante concreta, incluida su talla y color. Si se repite un producto al crear el pedido, el backend suma sus cantidades. Los precios se expresan en céntimos, provienen del catálogo y el backend calcula el total en PEN. El envío es gratuito y el total es la suma de los productos.

El nombre y la dirección se guardan como datos del pedido, sin crear ni asociar un registro de cliente. Los clientes ficticios son referencias opcionales: un nombre coincidente no permite asumir una dirección anterior y no necesitas consultar el historial de compras. La dirección se revisa en la aplicación; no hay mapas ni validación externa. Si la conversación es ambigua o menciona un producto inexistente, permite resolverlo durante la revisión sin inventar identificadores, direcciones ni precios.

No hay descuentos, impuestos adicionales, comprobantes, pagos, stock ni integración con tiendas reales. El pedido se crea con estado `created`; eso no significa que esté pagado, facturado ni despachado. Si se analiza otra conversación, evita mezclar silenciosamente la propuesta anterior con el texto nuevo. Una propuesta incompleta debe seguir siendo editable.

## IA

Tendrás acceso a OpenAI y Gemini. Elige proveedor, modelo y SDK/framework; basta uno y no necesitas un selector de modelos. Explica tu elección. Mantén las credenciales del lado servidor y fuera del repositorio. No necesitas conocer ecommerce ni usar RAG o agentes.

## Evaluación

Criterio de producto 30%; claridad visual y usabilidad 25%; funcionamiento 25%; criterio técnico y uso de asistentes 20%. La bandeja y la vista de Pedidos provistas no suman puntos. No damos puntos adicionales por un proveedor, modelo o framework particular.

## Entrega

Comparte el repositorio con instrucciones para ejecutar tu solución. En una sección «Mis decisiones», indica proveedor/modelo, herramienta de integración, decisiones principales, qué comprobaste, limitaciones y un ejemplo de algo generado por tu asistente que revisaste o corregiste. No necesitas desplegar la aplicación. Detente al terminar los 90 minutos y describe lo pendiente.

## Preparación con Docker

Desde la raíz del proyecto descomprimido:

```bash
cp .env.example .env
docker compose up --build
```

Abre la web en <http://localhost:3100> y la documentación de la API en <http://localhost:8100/docs>. Entra con `candidato@ventia.test` y `VentiaDemo2026!`. El primer arranque crea las tablas y los datos ficticios. Los siguientes arranques conservan los pedidos. La web instala el lockfile congelado al arrancar y usa volúmenes propios para sus módulos; la API monta el código local y usa su entorno de Python dentro del contenedor.

```bash
# Detener conservando datos
docker compose down
# Reiniciar todos los datos de esta copia del ejercicio
docker compose down -v
docker compose up --build
# Python: agregar un SDK/framework dentro del contenedor
docker compose exec api uv add openai
# Frontend: agregar una dependencia dentro del contenedor
docker compose exec web pnpm add zod
```

Los paquetes mostrados son ejemplos: puedes elegir otros. Si agregas dependencias de Python, reconstruye la imagen (`docker compose up --build`) para que su instalación sea reproducible. Guarda los manifests y lockfiles de tu elección. No incluyas `.env` en tu entrega; solo `.env.example` se versiona. Los servicios arrancan sin claves de IA. Solo el chequeo de modelo y la funcionalidad que construyas las necesitan.

## Alternativa local

Necesitas Node.js 22, pnpm 9, Python 3.12 y `uv`. Desde la raíz del proyecto, primero inicia PostgreSQL:

```bash
docker compose up -d db
pnpm install --frozen-lockfile
set -a
. ./.env
set +a
export AUTH_DATABASE_URL="postgresql://challenge:challenge-local-only@localhost:55432/challenge"
export DATABASE_URL="postgresql+psycopg://challenge:challenge-local-only@localhost:55432/challenge"
export AUTH_ISSUER="$BETTER_AUTH_URL"
export AUTH_AUDIENCE=ventia-challenge-api
export AUTH_JWKS_URL="$BETTER_AUTH_URL/api/auth/jwks"
export WEB_ORIGIN="$BETTER_AUTH_URL"
pnpm --filter web init:auth
```

Antes de esto, crea `.env` desde `.env.example` si aún no lo hiciste. Al cargarlo desde shell, entrecomilla cualquier valor nuevo que contenga espacios o caracteres especiales. En una terminal con ese entorno, desde la carpeta `api`:

```bash
uv sync --frozen
uv run alembic upgrade head
uv run python -m scripts.seed
uv run uvicorn app.main:app --reload --port 8100
```

En otra terminal con el mismo entorno, desde la raíz del proyecto:

```bash
pnpm --filter web dev --port 3100
```

En una copia limpia, genera `web/next-env.d.ts` antes del typecheck con `pnpm --filter web exec next typegen`.

## Comprobar el acceso a IA

El evaluador proporcionará las credenciales. Pon solo las del proveedor elegido en tu `.env` local y define `MODEL_PROVIDER=openai` o `MODEL_PROVIDER=gemini`, junto con `MODEL_NAME` como ID simple del modelo. Desde la raíz del proyecto:

```bash
docker compose up -d
docker compose exec api uv run python -m scripts.check_model
```

El chequeo consulta los metadatos del modelo: comprueba su visibilidad, pero no prueba generación ni cuota disponible. Ejecuta también una generación trivial con el SDK que elijas. La preparación y estas comprobaciones forman parte de los 90 minutos. Si encuentras un problema de acceso, comunícalo al evaluador. No pegues claves en el código, los logs ni la entrega.

## Contrato de la API

La web obtiene un JWT de la sesión iniciada. Los endpoints de negocio requieren `Authorization: Bearer <token>`. Los listados devuelven arreglos JSON; la API responde con nombres `snake_case`.

| Método y ruta | Resultado |
| --- | --- |
| `GET /health` | Estado público de la API. |
| `GET /products` | Catálogo: `id`, `name`, `price_cents`, `currency`. |
| `GET /customers` | Clientes ficticios: `id`, `name`. |
| `GET /sample-conversations` | Tres conversaciones de solo lectura: `id`, `title`, `customer_name`, `text`. |
| `POST /orders` | Crea un pedido (`201`). |
| `GET /orders` | Lista pedidos del usuario. |
| `GET /orders/{order_id}` | Consulta un pedido propio; `404` si no existe. |

Ejemplo de un elemento de `GET /sample-conversations`:

```json
{
  "id": "missing",
  "title": "Información incompleta",
  "customer_name": "Andrea Pérez",
  "text": "Cliente: Soy Andrea Pérez. Quiero un polo negro.\nCliente: Envíalo a la dirección de la vez pasada.\nVentas: El envío es gratuito."
}
```

El campo `text` conserva la conversación original completa.

Ejemplo de cuerpo para `POST /orders`:

```json
{
  "customer_name": "Lucía Ramos",
  "delivery_address": "Av. Los Olivos 123, departamento 402, Lima",
  "items": [{"product_id": "polo-negro-m", "quantity": 2}]
}
```

El servidor toma precios del catálogo y devuelve `id`, `number`, `created_at`, `status`, `currency`, `customer_name`, `delivery_address`, `items` y `total_cents`. Cada línea contiene `product_id`, `quantity`, `name`, `unit_price_cents` y `line_total_cents`. Los importes están en céntimos de PEN: `8000` equivale a S/80. Una entrada inválida recibe `422`; un producto ajeno al catálogo devuelve `detail` con `field`, `product_id` y `message`. La falta de autenticación devuelve `401`. No reintentes automáticamente `POST /orders`, porque podría crear otro pedido.

## Mis decisiones

- **Proveedor e integración:** OpenAI mediante el SDK de Python en FastAPI. El identificador del modelo se configura con `MODEL_NAME`; `OPENAI_API_KEY` permanece en el servidor.
- **Borradores:** PostgreSQL, un borrador por usuario y conversación. Las propuestas y ediciones se guardan sin crear un pedido; el backend calcula los precios del pedido desde el catálogo.
- **Control y recuperación:** regenerar requiere confirmación; las ediciones se guardan con debounce; crear el pedido es una acción explícita y el backend guarda el pedido y elimina el borrador en una transacción. Un borrador de una conversación cuyo texto cambió requiere reconocer el aviso antes de crear el pedido.
- **Verificaciones de esta sesión:** no se ejecutaron pruebas, lint, typecheck, build, migraciones, recorrido en navegador ni generación real con OpenAI. Las credenciales y el modelo disponible deben comprobarse en el entorno de ejecución.
- **Limitaciones:** el resultado del modelo no se verificó con una clave real y el identificador concreto queda en `MODEL_NAME`.
- **Ejemplo revisado:** pendiente de una generación real. Para verificarlo, usa la conversación de Diego y confirma que la propuesta conserve la corrección final: un polo negro y uno blanco, ambos talla M.
