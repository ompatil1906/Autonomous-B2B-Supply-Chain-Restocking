from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # AP2 mandate bounds
    ap2_mandate_limit_inr: float = 10_000.0
    ap2_mandate_sku: str = "SKU-404"
    ap2_mandate_max_qty: int = 100
    ap2_mandate_max_unit_price: float = 100.0
    ap2_mandate_ttl_minutes: int = 1_440
    ap2_intent_expiry_hours: int = 24

    # Agent / LLM
    agent_llm_provider: str = "gemini"  # openai | anthropic | gemini | mock
    agent_llm_model: str = "gemini/gemini-3.5-flash-lite"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""

    # Razorpay MCP
    razorpay_mode: str = "remote"  # remote | mock
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_mcp_token: str = ""
    razorpay_mcp_url: str = "https://mcp.razorpay.com/mcp"
    razorpay_authorized_payment_id: str = ""
    razorpay_demo_link_base: str = "https://rzp.io/l"

    # Notifications
    notify_channel: str = "console"  # console | webhook
    notify_webhook_url: str = ""
    merchant_phone: str = "+917436083790"
    supplier_name: str = "Acme B2B Supplies"
    merchant_name: str = "Acme D2C Store"

    @property
    def razorpay_mcp_auth_token(self) -> str:
        if self.razorpay_mcp_token:
            return self.razorpay_mcp_token
        if self.razorpay_key_id and self.razorpay_key_secret:
            import base64

            return base64.b64encode(
                f"{self.razorpay_key_id}:{self.razorpay_key_secret}".encode()
            ).decode()
        return ""

    @property
    def llm_available(self) -> bool:
        if self.agent_llm_provider == "openai":
            return bool(self.openai_api_key)
        if self.agent_llm_provider == "anthropic":
            return bool(self.anthropic_api_key)
        if self.agent_llm_provider == "gemini":
            return bool(self.gemini_api_key)
        return False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()