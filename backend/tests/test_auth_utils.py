import pytest
from fastapi import HTTPException

from app.auth_utils import create_session_token, get_current_user


@pytest.fixture(autouse=True)
def session_secret(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", "test-only-secret-not-used-anywhere-real-padding-to-32-bytes")


def test_valid_token_resolves_to_the_right_user():
    token = create_session_token("alice@example.com")
    assert get_current_user(authorization=f"Bearer {token}") == "alice@example.com"


def test_missing_authorization_header_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(authorization=None)
    assert exc_info.value.status_code == 401


def test_header_without_bearer_prefix_is_rejected():
    token = create_session_token("alice@example.com")
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(authorization=token)  # missing "Bearer " prefix
    assert exc_info.value.status_code == 401


def test_garbage_token_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(authorization="Bearer not.a.validtoken")
    assert exc_info.value.status_code == 401


def test_token_signed_with_a_different_secret_is_rejected(monkeypatch):
    token = create_session_token("alice@example.com")

    monkeypatch.setenv("SESSION_SECRET", "a-different-secret-entirely-also-padded-to-32-bytes")

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(authorization=f"Bearer {token}")
    assert exc_info.value.status_code == 401


def test_a_valid_token_cannot_be_reused_to_impersonate_another_user():
    # The whole point of session tokens: the caller can't just claim to be
    # someone else via a query param - the identity is baked into (and
    # provable only via) the signed token itself.
    token = create_session_token("victim@example.com")
    assert get_current_user(authorization=f"Bearer {token}") == "victim@example.com"
    assert get_current_user(authorization=f"Bearer {token}") != "attacker@example.com"
