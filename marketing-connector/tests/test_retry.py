import pytest

from pipeline.connectors.base import (
    AuthAPIError,
    FatalAPIError,
    TransientAPIError,
    call_with_retry,
)


def test_retries_transient_then_succeeds():
    calls = {"n": 0}
    sleeps = []

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise TransientAPIError("throttled")
        return "ok"

    assert call_with_retry(flaky, sleep=sleeps.append) == "ok"
    assert calls["n"] == 3
    assert len(sleeps) == 2
    assert sleeps[1] > sleeps[0]  # exponential backoff


def test_transient_exhausts_after_max_attempts():
    calls = {"n": 0}

    def always_fails():
        calls["n"] += 1
        raise TransientAPIError("still down")

    with pytest.raises(TransientAPIError):
        call_with_retry(always_fails, max_attempts=4, sleep=lambda _: None)
    assert calls["n"] == 4


def test_auth_error_is_not_retried():
    calls = {"n": 0}

    def bad_token():
        calls["n"] += 1
        raise AuthAPIError("token expired")

    with pytest.raises(AuthAPIError):
        call_with_retry(bad_token, sleep=lambda _: None)
    assert calls["n"] == 1


def test_fatal_error_is_not_retried():
    calls = {"n": 0}

    def bad_request():
        calls["n"] += 1
        raise FatalAPIError("unknown field")

    with pytest.raises(FatalAPIError):
        call_with_retry(bad_request, sleep=lambda _: None)
    assert calls["n"] == 1
