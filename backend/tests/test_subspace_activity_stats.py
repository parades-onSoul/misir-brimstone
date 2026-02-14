from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from result import Ok
from starlette.requests import Request

from infrastructure.repositories.subspace_repo import SubspaceRepository
from infrastructure.repositories.artifact_repo import CaptureResult
from infrastructure.services.margin_service import MarginResult
from interfaces.api.capture import CaptureRequest, capture_artifact


def _make_repo_client():
    client = Mock()
    client.schema.return_value = client
    client.from_.return_value = client
    client.select.return_value = client
    client.eq.return_value = client
    client.order.return_value = client
    client.not_ = Mock()
    client.not_.is_ = Mock(return_value=client)
    client.is_ = Mock(return_value=client)
    return client


@pytest.mark.asyncio
async def test_get_by_space_uses_live_artifact_stats_for_count_and_last_active():
    client = _make_repo_client()
    repo = SubspaceRepository(client)

    artifact_rows = [
        {
            "subspace_id": 1,
            "captured_at": "2026-02-11T16:10:00+00:00",
            "updated_at": "2026-02-11T16:10:00+00:00",
            "created_at": "2026-02-11T16:10:00+00:00",
        },
        {
            "subspace_id": 1,
            "captured_at": "2026-02-11T16:15:00+00:00",
            "updated_at": "2026-02-11T16:15:00+00:00",
            "created_at": "2026-02-11T16:15:00+00:00",
        },
    ]
    subspace_rows = [
        {
            "id": 1,
            "space_id": 41,
            "name": "Particle Interactions",
            "description": None,
            "user_id": "user-1",
            "artifact_count": 0,
            "confidence": 0.2,
            "learning_rate": 0.1,
            "centroid_embedding": None,
            "centroid_updated_at": "2026-02-10T00:00:00+00:00",
            "created_at": "2026-02-10T00:00:00+00:00",
            "updated_at": "2026-02-10T00:00:00+00:00",
            "subspace_marker": [],
        }
    ]
    client.execute.side_effect = [
        SimpleNamespace(data=artifact_rows),
        SimpleNamespace(data=[]),
        SimpleNamespace(data=subspace_rows),
    ]

    result = await repo.get_by_space(space_id=41, user_id="user-1")

    assert result.is_ok()
    rows = result.unwrap()
    assert len(rows) == 1
    assert rows[0].artifact_count == 2
    assert rows[0].updated_at == "2026-02-11T16:15:00+00:00"


@pytest.mark.asyncio
async def test_get_by_space_falls_back_to_signal_stats_when_artifact_assignment_is_stale():
    client = _make_repo_client()
    repo = SubspaceRepository(client)

    artifact_rows = []
    signal_rows = [
        {
            "subspace_id": 2,
            "artifact_id": 88,
            "created_at": "2026-02-11T17:00:00+00:00",
        }
    ]
    subspace_rows = [
        {
            "id": 2,
            "space_id": 41,
            "name": "Field Theory",
            "description": None,
            "user_id": "user-1",
            "artifact_count": 0,
            "confidence": 0.3,
            "learning_rate": 0.1,
            "centroid_embedding": None,
            "centroid_updated_at": "2026-02-10T00:00:00+00:00",
            "created_at": "2026-02-10T00:00:00+00:00",
            "updated_at": "2026-02-10T00:00:00+00:00",
            "subspace_marker": [],
        }
    ]
    client.execute.side_effect = [
        SimpleNamespace(data=artifact_rows),
        SimpleNamespace(data=signal_rows),
        SimpleNamespace(data=subspace_rows),
    ]

    result = await repo.get_by_space(space_id=41, user_id="user-1")

    assert result.is_ok()
    rows = result.unwrap()
    assert len(rows) == 1
    assert rows[0].artifact_count == 1
    assert rows[0].updated_at == "2026-02-11T17:00:00+00:00"


@pytest.mark.asyncio
async def test_capture_auto_assigns_subspace_when_missing(monkeypatch):
    # Margin service should assign nearest subspace + margin metadata
    async def _fake_margin(*_args, **_kwargs):
        return MarginResult(
            nearest_subspace_id=7,
            nearest_distance=0.2,
            second_distance=0.5,
            margin=0.3,
            updates_centroid=True,
        )

    monkeypatch.setattr(
        "interfaces.api.capture.AssignmentMarginService.calculate_margin",
        _fake_margin,
    )

    handler = SimpleNamespace()
    handler.handle = AsyncMock(
        return_value=Ok(
            CaptureResult(
                artifact_id=101,
                signal_id=202,
                is_new=True,
                message="ok",
            )
        )
    )

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/artifacts/capture",
            "headers": [],
            "query_string": b"",
            "scheme": "http",
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 12345),
            "root_path": "",
            "http_version": "1.1",
        }
    )
    body = CaptureRequest(
        space_id=41,
        url="https://example.com/article",
        embedding=[0.001] * 768,
        reading_depth=0.7,
        scroll_depth=0.8,
        dwell_time_ms=42000,
        word_count=1200,
        engagement_level="engaged",
        content_source="web",
        title="Example",
        content="example content",
    )

    # Supabase client mock only needs to satisfy AssignmentMarginService init chain.
    client = Mock()
    client.schema.return_value = client
    client.rpc.return_value = client
    client.execute.return_value = SimpleNamespace(data=[])

    response = await capture_artifact(
        request=request,
        body=body,
        current_user_id="user-1",
        handler=handler,
        client=client,
    )

    assert response.artifact_id == 101
    assert handler.handle.await_count == 1
    cmd = handler.handle.await_args.args[0]
    assert cmd.subspace_id == 7
    assert cmd.margin == pytest.approx(0.3)
    assert cmd.updates_centroid is True


@pytest.mark.asyncio
async def test_capture_uses_marker_fallback_when_margin_assignment_is_ambiguous(monkeypatch):
    async def _fake_margin(*_args, **_kwargs):
        return MarginResult(
            nearest_subspace_id=None,
            nearest_distance=0.2,
            second_distance=0.25,
            margin=0.05,
            updates_centroid=False,
        )

    monkeypatch.setattr(
        "interfaces.api.capture.AssignmentMarginService.calculate_margin",
        _fake_margin,
    )
    monkeypatch.setattr(
        "interfaces.api.capture._derive_marker_hints",
        lambda *_args, **_kwargs: ([10, 11], 9),
    )

    handler = SimpleNamespace()
    handler.handle = AsyncMock(
        return_value=Ok(
            CaptureResult(
                artifact_id=102,
                signal_id=203,
                is_new=True,
                message="ok",
            )
        )
    )

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/artifacts/capture",
            "headers": [],
            "query_string": b"",
            "scheme": "http",
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 12345),
            "root_path": "",
            "http_version": "1.1",
        }
    )
    body = CaptureRequest(
        space_id=41,
        url="https://example.com/article-2",
        embedding=[0.001] * 768,
        reading_depth=0.6,
        scroll_depth=0.7,
        dwell_time_ms=32000,
        word_count=900,
        engagement_level="engaged",
        content_source="web",
        title="Example 2",
        content="example content 2",
        matched_marker_ids=[7],
    )

    client = Mock()
    client.schema.return_value = client
    client.rpc.return_value = client
    client.execute.return_value = SimpleNamespace(data=[])

    response = await capture_artifact(
        request=request,
        body=body,
        current_user_id="user-1",
        handler=handler,
        client=client,
    )

    assert response.artifact_id == 102
    cmd = handler.handle.await_args.args[0]
    assert cmd.subspace_id == 9
    assert cmd.updates_centroid is False
    assert cmd.matched_marker_ids == (7, 10, 11)
