import math
from unittest.mock import Mock

import pytest


class _RpcCall:
    def __init__(self, fn):
        self._fn = fn

    def execute(self):
        return self._fn()


def test_truncate_and_normalize_produces_unit_vector():
    from infrastructure.services.margin_service import AssignmentMarginService

    vec = [1.0] * 768
    out = AssignmentMarginService._truncate_and_normalize(vec, 384)

    assert len(out) == 384
    norm = math.sqrt(sum(v * v for v in out))
    assert abs(norm - 1.0) < 1e-6


@pytest.mark.asyncio
async def test_margin_service_prefers_matryoshka_rpc():
    from infrastructure.services.margin_service import AssignmentMarginService

    mock_client = Mock()
    mock_client.schema.return_value = mock_client

    calls = []

    def rpc(name, params):
        calls.append((name, params))
        return _RpcCall(
            lambda: Mock(
                data=[
                    {
                        "nearest_subspace_id": 5,
                        "nearest_distance": 0.2,
                        "second_distance": 0.35,
                        "margin": 0.15,
                        "updates_centroid": True,
                    }
                ]
            )
        )

    mock_client.rpc.side_effect = rpc

    svc = AssignmentMarginService(mock_client)
    result = await svc.calculate_margin([0.1] * 768, "user-1", 12)

    assert result.nearest_subspace_id == 5
    assert result.updates_centroid is True
    assert calls[0][0] == "calculate_assignment_margin_matryoshka"
    assert len(calls[0][1]["p_signal_vector_384"]) == 384
    assert len(calls[0][1]["p_signal_vector_768"]) == 768
