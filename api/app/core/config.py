from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    auth_issuer: str = "http://localhost:3100"
    auth_audience: str = "ventia-challenge-api"
    auth_jwks_url: str = "http://localhost:3100/api/auth/jwks"
    web_origin: str = "http://localhost:3100"
    seed_email: str = "candidato@ventia.test"
    seed_file: str = "../data/seed.json"
    openai_api_key: str | None = None
    model_name: str = ""


settings = Settings()
