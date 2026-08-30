from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # AP2-inspired mandate bounds
    ap2_mandate_limit_inr: float = 10_000.0
    ap2_mandate_sku: str = "SKU-404"
    ap2_mandate_max_qty: int = 100
    ap2_mandate_max_unit_price: float = 100.0
    ap2_mandate_ttl_minutes: int = 1_440
    ap2_intent_expiry_hours: int = 24

    # Live Ops — portfolio-level daily autonomous spend ceiling, enforced by the
    # gate as a boundary check across ALL SKUs (on top of each per-SKU intent).
    ap2_daily_ceiling_inr: float = 100_000.0
    # Staged latency per agent node in live mode (~6 nodes ≈ 35s cycle) so the
    # race between the predictive trigger and the restock is visible on stage.
    live_node_delay_s: float = 6.0

    # Agent / LLM
    agent_llm_provider: str = "gemini"  # openai | anthropic | gemini | mock
    agent_llm_model: str = "gemini/gemini-3.5-flash-lite"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""

    # Razorpay MCP
    razorpay_mode: str = "remote"  # remote | mock  (legacy; see razorpay_execution_mode)
    # simulation | remote_test — the single source of truth for financial execution.
    # simulation: every financial leg is a deterministic local simulator.
    # remote_test: real Razorpay test-mode objects are created (orders, links) and a
    #   capture leg is attempted only against a genuine authorized payment.
    # Default remote_test = "attempt live test mode now"; without credentials the MCP
    # client transparently falls back to the simulator (and every leg says so).
    razorpay_execution_mode: str = "remote_test"
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_mcp_token: str = ""
    razorpay_mcp_url: str = "https://mcp.razorpay.com/mcp"
    razorpay_authorized_payment_id: str = ""
    razorpay_demo_link_base: str = "https://rzp.io/l"
    # Webhook signature secret (X-Razorpay-Signature = HMAC-SHA256(secret, raw body)).
    razorpay_webhook_secret: str = ""

    # Environment / security
    # development | demo | production
    app_env: str = "development"
    # Bearer token required on financially-consequential write endpoints. When unset
    # in development, a well-known dev token is accepted so the local demo works.
    warden_api_token: str = ""

    # Demo staging — theatrical node delays off unless explicitly enabled in demos.
    demo_staged: bool = False

    # Notifications
    notify_channel: str = "console"  # console | webhook
    notify_webhook_url: str = ""
    merchant_phone: str = "+917436083790"
    supplier_name: str = "Acme B2B Supplies"
    merchant_name: str = "Acme D2C Store"

    @property
    def execution_mode(self) -> str:
        """financial execution mode: simulation | remote_test."""
        m = (self.razorpay_execution_mode or "").strip().lower()
        if m:
            return "remote_test" if m == "remote_test" else "simulation"
        # legacy mapping
        return "remote_test" if self.razorpay_mode == "remote" else "simulation"

    @property
    def webhook_secret(self) -> str:
        """HMAC secret used to verify Razorpay webhooks.

        If none is configured the demo uses a stable simulation-only secret so the
        synthesized events exercise exactly the same verification path as real ones.
        Any event verified with this fallback is flagged `simulated` downstream.
        """
        if self.razorpay_webhook_secret:
            return self.razorpay_webhook_secret
        return "warden-sim-only-secret"

    @property
    def api_token(self) -> str:
        if self.warden_api_token:
            return self.warden_api_token
        if self.app_env == "development":
            return "warden-dev-token"
        return ""

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