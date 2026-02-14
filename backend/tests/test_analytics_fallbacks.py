from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from result import Ok
from starlette.requests import Request

from interfaces.api.analytics import get_space_confidence, get_space_velocity


def _make_request(path: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": path,
            "headers": [],
            "query_string": b"",
            "scheme": "http",
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 12345),
            "root_path": "",
            "http_version": "1.1",
        }
    )


def _make_client() -> Mock:
    client = Mock()
    client.schema.return_value = client
    client.from_.return_value = client
    client.select.return_value = client
    client.eq.return_value = client
    client.in_.return_value = client
    client.order.return_value = client
    client.limit.return_value = client
    client.is_.return_value = client
    return client


@pytest.mark.asyncio
async def test_velocity_endpoint_falls_back_to_signal_counts(monkeypatch):
    subspaces = [
        SimpleNamespace(
            id=5,
            name="QFT",
            confidence=0.4,
            centroid_updated_at=None,
            updated_at="2026-02-11T00:00:00+00:00",
            created_at="2026-02-10T00:00:00+00:00",
        )
    ]

    async def _fake_get_by_space(self, space_id, user_id):
        return Ok(subspaces)

    monkeypatch.setattr(
        "interfaces.api.analytics.SubspaceRepository.get_by_space",
        _fake_get_by_space,
    )

    client = _make_client()
    client.execute.side_effect = [
        SimpleNamespace(data=[]),  # subspace_velocity query (empty)
        SimpleNamespace(
            data=[
                {"subspace_id": 5, "created_at": "2026-02-11T12:00:00+00:00"},
                {"subspace_id": 5, "created_at": "2026-02-11T13:00:00+00:00"},
            ]
        ),  # signal fallback
    ]

    result = await get_space_velocity(
        request=_make_request("/spaces/41/analytics/velocity"),
        space_id=41,
        current_user_id="user-1",
        client=client,
    )

    assert len(result) == 1
    assert result[0].subspace_id == 5
    assert result[0].velocity == 2.0


@pytest.mark.asyncio
async def test_confidence_endpoint_falls_back_to_current_subspace_confidence(monkeypatch):
    subspaces = [
        SimpleNamespace(
            id=8,
            name="Collider Physics",
            confidence=0.62,
            centroid_updated_at="2026-02-11T10:00:00+00:00",
            updated_at="2026-02-11T10:00:00+00:00",
            created_at="2026-02-10T00:00:00+00:00",
        )
    ]

    async def _fake_get_by_space(self, space_id, user_id):
        return Ok(subspaces)

    monkeypatch.setattr(
        "interfaces.api.analytics.SubspaceRepository.get_by_space",
        _fake_get_by_space,
    )

    client = _make_client()
    client.execute.side_effect = [
        SimpleNamespace(data=[]),  # subspace_centroid_history query (empty)
    ]

    result = await get_space_confidence(
        request=_make_request("/spaces/41/analytics/confidence"),
        space_id=41,
        current_user_id="user-1",
        client=client,
    )

    assert len(result) == 1
    assert result[0].subspace_id == 8
    assert result[0].confidence == pytest.approx(0.62)

