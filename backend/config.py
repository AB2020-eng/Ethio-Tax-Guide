from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    telebirr_app_id: str = Field("", env="TELEBIRR_APP_ID")
    telebirr_short_code: str = Field("", env="TELEBIRR_SHORT_CODE")
    telebirr_public_key: str = Field("", env="TELEBIRR_PUBLIC_KEY")
    telebirr_notify_url: str = Field("", env="TELEBIRR_NOTIFY_URL")
    telebirr_return_url: str = Field("", env="TELEBIRR_RETURN_URL")

    class Config:
        env_file = ".env"

settings = Settings()
