"""IdentityRegistry — binds a claimed issuer DID to the public key that must have
signed. Signature verification must never re-derive the signer's own key and trust
it; it must prove the mandate's `issuer` is actually the DID of the verifying key.

Role DIDs are derived deterministically from a persistent Ed25519 key whose public
key bytes encode the DID (`did:ap2:<base58(pubkey)>`).
"""
from __future__ import annotations

import base58
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.ap2.keys import get_role_key, keys, public_did


class IdentityError(ValueError):
    pass


def did_for_role(role: str) -> str:
    return public_did(get_role_key(role))


def _pub_bytes(role_key_name: str) -> bytes:
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    return keys()[role_key_name].public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)


def role_for_did(did: str) -> str | None:
    """Reverse lookup: which registered role owns this DID? None if unknown."""
    for role, key in keys().items():
        if public_did(key) == did:
            return role
    return None


class IdentityRegistry:
    """Maps role DIDs to verifying keys and verifies issuer↔key binding."""

    def __init__(self) -> None:
        self._by_did: dict[str, Ed25519PrivateKey] = {}
        for role, key in keys().items():
            self._by_did[public_did(key)] = key

    def known_did(self, did: str) -> bool:
        return did in self._by_did

    def supplier_dids(self) -> list[str]:
        from app.services.suppliers import SUPPLIER_KEYS

        out = []
        for name in SUPPLIER_KEYS.values():
            try:
                out.append(public_did(keys()[name]))
            except KeyError:
                continue
        return out

    def merchant_did(self) -> str:
        return did_for_role("merchant")

    def agent_did(self) -> str:
        return did_for_role("agent")

    def verifying_key_for(self, did: str) -> Ed25519PrivateKey | None:
        """Return the key whose public half equals the claimed DID (binding check)."""
        key = self._by_did.get(did)
        if key is not None:
            return key
        return None

    def verify_signature(self, did: str, signature_b58: str, message: bytes) -> bool:
        """Constant-purpose signature verification against the key bound to `did`.

        Returns False (never raises) if the DID is unknown — an attacker cannot
        claim an issuer that has no registered key.
        """
        from cryptography.exceptions import InvalidSignature

        key = self.verifying_key_for(did)
        if key is None:
            return False
        try:
            sig = base58.b58decode(signature_b58)
            key.public_key().verify(sig, message)
            return True
        except (InvalidSignature, ValueError, TypeError):
            return False


_registry: IdentityRegistry | None = None


def get_registry() -> IdentityRegistry:
    global _registry
    if _registry is None:
        _registry = IdentityRegistry()
    return _registry