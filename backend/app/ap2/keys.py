from __future__ import annotations

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    load_pem_private_key,
    load_pem_public_key,
)
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.config import settings
from app.paths import KEY_DIR



def _path(name: str) -> str:
    import os

    os.makedirs(KEY_DIR, exist_ok=True)
    return f"{KEY_DIR}/{name}.pem"


def load_or_create_key(name: str) -> Ed25519PrivateKey:
    import os

    path = _path(name)
    if os.path.exists(path):
        with open(path, "rb") as fh:
            return load_pem_private_key(fh.read(), password=None)
    key = Ed25519PrivateKey.generate()
    from cryptography.hazmat.primitives.serialization import (
        Encoding,
        PrivateFormat,
        NoEncryption,
    )

    with open(path, "wb") as fh:
        fh.write(
            key.private_bytes(
                encoding=Encoding.PEM,
                format=PrivateFormat.PKCS8,
                encryption_algorithm=NoEncryption(),
            )
        )
    return key


def public_did(key: Ed25519PrivateKey) -> str:
    pub = key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    import base58

    return f"did:ap2:{base58.b58encode(pub).decode()}"


def verify_public_did(pub: bytes) -> str:
    import base58

    return f"did:ap2:{base58.b58encode(pub).decode()}"


# Shared key material across the app (roles: merchant wallet, agent, supplier).
def keys() -> dict[str, Ed25519PrivateKey]:
    return {
        "merchant": load_or_create_key("merchant_wallet"),
        "agent": load_or_create_key("agent"),
        "supplier": load_or_create_key("supplier"),
    }


_keys_cache: dict[str, Ed25519PrivateKey] | None = None


def get_role_key(role: str) -> Ed25519PrivateKey:
    global _keys_cache
    if _keys_cache is None:
        _keys_cache = keys()
    if role not in _keys_cache:
        raise KeyError(f"Unknown role {role!r}. Known roles: {list(_keys_cache)}")
    return _keys_cache[role]


def get_role_did(role: str) -> str:
    return public_did(get_role_key(role))