from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "ExaPlan - Examination Invigilation & Seating Arrangement System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "exaplan_super_secret_jwt_key_change_in_production_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Database: Exclusively PostgreSQL via DATABASE_URL from .env
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/exaplan"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
