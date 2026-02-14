import pytest
from unittest.mock import Mock, patch


class _RpcCall:
    def __init__(self, fn):
        self._fn = fn

    def execute(self):
        return self._fn()


class _EmbedResult:
    def __init__(self, vector, dimension):
        self.vector = vector
        self.dimension = dimension
        self.model = "nomic-ai/nomic-embed-text-v1.5"
        self.text_hash = "hash"


@pytest.mark.asyncio
async def test_search_prefers_matryoshka_rpc():
    from application.handlers.search_handler import SearchHandler, SearchCommand

    mock_client = Mock()
    mock_client.schema.return_value = mock_client

    captured = {"name": None, "params": None}

    def rpc(name, params):
        captured["name"] = name
        captured["params"] = params
        return _RpcCall(
            lambda: Mock(
                data=[
                    {
                        "artifact_id": 10,
                        "signal_id": 20,
                        "distance": 0.2,
                        "title": "Particle Notes",
                        "url": "https://example.com/p",
                        "content_preview": "preview",
                        "space_id": 3,
                        "subspace_id": 8,
                        "engagement_level": "engaged",
                        "dwell_time_ms": 42000,
                    }
                ]
            )
        )

    mock_client.rpc.side_effect = rpc

    mock_embed = Mock()
    mock_embed.embed_query.side_effect = [
        _EmbedResult([0.1] * 384, 384),
        _EmbedResult([0.2] * 768, 768),
    ]

    with patch("application.handlers.search_handler.get_embedding_service", return_value=mock_embed):
        handler = SearchHandler(mock_client)
        result = await handler.search(
            SearchCommand(user_id="u-1", query="particle physics", limit=15, threshold=0.6)
        )

    assert result.is_ok()
    payload = result.unwrap()
    assert payload.count == 1
    assert payload.dimension_used == 768
    assert captured["name"] == "search_signals_by_vector_matryoshka"
    assert captured["params"]["p_limit"] == 15
    assert captured["params"]["p_prefilter_limit"] == 150
    assert len(captured["params"]["p_query_vector_384"]) == 384
    assert len(captured["params"]["p_query_vector_768"]) == 768


@pytest.mark.asyncio
async def test_search_falls_back_to_legacy_rpc_when_matryoshka_unavailable():
    from application.handlers.search_handler import SearchHandler, SearchCommand

    mock_client = Mock()
    mock_client.schema.return_value = mock_client

    calls = []

    def rpc(name, _params):
        calls.append(name)
        if name == "search_signals_by_vector_matryoshka":
            return _RpcCall(lambda: (_ for _ in ()).throw(Exception("function does not exist")))
        return _RpcCall(
            lambda: Mock(
                data=[
                    {
                        "artifact_id": 99,
                        "signal_id": 77,
                        "distance": 0.1,
                        "title": "Fallback",
                        "url": "https://example.com/fallback",
                        "content_preview": "fallback preview",
                        "space_id": 1,
                        "subspace_id": None,
                        "engagement_level": "discovered",
                        "dwell_time_ms": 1000,
                    }
                ]
            )
        )

    mock_client.rpc.side_effect = rpc

    mock_embed = Mock()
    mock_embed.embed_query.side_effect = [
        _EmbedResult([0.3] * 384, 384),
        _EmbedResult([0.4] * 768, 768),
    ]

    with patch("application.handlers.search_handler.get_embedding_service", return_value=mock_embed):
        handler = SearchHandler(mock_client)
        result = await handler.search(SearchCommand(user_id="u-1", query="fallback test"))

    assert result.is_ok()
    assert calls == [
        "search_signals_by_vector_matryoshka",
        "search_signals_by_vector",
    ]
