from types import SimpleNamespace

from pipeline.connectors.base import AuthAPIError, FatalAPIError, TransientAPIError
from pipeline.connectors.google_ads.client import classify_google_error
from pipeline.connectors.meta.client import classify_meta_error


def _google_exc(**error_code_fields):
    code = SimpleNamespace(
        authentication_error=0,
        authorization_error=0,
        access_token_error=0,
        internal_error=0,
        quota_error=0,
    )
    for k, v in error_code_fields.items():
        setattr(code, k, v)
    exc = Exception("google ads failure")
    exc.failure = SimpleNamespace(errors=[SimpleNamespace(error_code=code)])
    return exc


def test_google_auth_error_classified():
    assert isinstance(
        classify_google_error(_google_exc(authentication_error=2)), AuthAPIError
    )


def test_google_quota_error_is_transient():
    assert isinstance(
        classify_google_error(_google_exc(quota_error=1)), TransientAPIError
    )


def test_google_unknown_failure_is_fatal():
    assert isinstance(classify_google_error(_google_exc()), FatalAPIError)


class _FakeMetaError(Exception):
    def __init__(self, code, http=400):
        super().__init__(f"meta error {code}")
        self._code, self._http = code, http

    def api_error_code(self):
        return self._code

    def http_status(self):
        return self._http


def test_meta_expired_token_is_auth_error():
    assert isinstance(classify_meta_error(_FakeMetaError(190)), AuthAPIError)


def test_meta_throttle_is_transient():
    assert isinstance(classify_meta_error(_FakeMetaError(17)), TransientAPIError)


def test_meta_5xx_is_transient():
    assert isinstance(classify_meta_error(_FakeMetaError(999, http=500)), TransientAPIError)


def test_meta_permission_error_is_auth():
    assert isinstance(classify_meta_error(_FakeMetaError(200)), AuthAPIError)


def test_meta_unknown_is_fatal():
    assert isinstance(classify_meta_error(_FakeMetaError(100)), FatalAPIError)
