import pytest
from fastapi.testclient import TestClient

from infrastructure.services.content_classifier import classify_content
from interfaces.api.artifacts import get_current_user
from main import app


class TestContentClassifierService:
    def test_detects_video_source_from_url(self):
        result = classify_content(
            url="https://www.youtube.com/watch?v=test",
            title="A test video",
            content="video content sample",
            word_count=120,
            dwell_time_ms=20_000,
            scroll_depth=0.3,
            reading_depth=0.5,
            engagement="latent",
        )

        assert result["contentType"] == "video"
        assert result["contentSource"] == "video"
        assert result["engagementLevel"] in {"discovered", "engaged", "saturated"}

    def test_extracts_keywords_and_keeps_reading_depth(self):
        result = classify_content(
            url="https://example.com/blog/intent-classifier",
            title="Intent classifier notes",
            content="classifier intent classifier analysis model classifier intent",
            word_count=80,
            dwell_time_ms=12_000,
            scroll_depth=0.2,
            reading_depth=0.73,
            engagement="discovered",
        )

        assert "classifier" in result["keywords"]
        assert "intent" in result["keywords"]
        assert result["readingDepth"] == pytest.approx(0.73, abs=1e-6)
        assert 0.0 <= result["confidence"] <= 1.0

    def test_normalizes_legacy_engagement_labels(self):
        ambient = classify_content(
            url="https://example.com",
            title="test",
            content="test content",
            word_count=10,
            dwell_time_ms=1000,
            scroll_depth=0.0,
            reading_depth=0.1,
            engagement="ambient",
        )
        committed = classify_content(
            url="https://example.com",
            title="test",
            content="test content",
            word_count=10,
            dwell_time_ms=1000,
            scroll_depth=0.0,
            reading_depth=0.1,
            engagement="committed",
        )

        assert ambient["engagementLevel"] == "latent"
        assert committed["engagementLevel"] == "saturated"


class TestContentClassifierApi:
    @pytest.fixture
    def client(self):
        app.dependency_overrides[get_current_user] = lambda: "test-user-id"
        try:
            yield TestClient(app)
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_classify_endpoint(self, client: TestClient):
        payload = {
            "page": {
                "url": "https://chatgpt.com/c/abc",
                "title": "Chat session",
                "content": "prompt response prompt response",
                "wordCount": 40,
                "domain": "chatgpt.com",
            },
            "metrics": {
                "dwellTimeMs": 9000,
                "scrollDepth": 0.15,
                "readingDepth": 0.4,
                "scrollEvents": 3,
            },
            "engagement": "latent",
        }

        response = client.post("/api/v1/artifacts/classify", json=payload)
        assert response.status_code == 200
        body = response.json()
        assert body["contentType"] == "chat"
        assert body["contentSource"] == "chat"
        assert "engagementLevel" in body
        assert "keywords" in body
        assert "nlpAvailable" in body

    def test_classifier_status_endpoint(self, client: TestClient):
        response = client.get("/api/v1/artifacts/classify/status")
        assert response.status_code == 200
        assert response.json()["available"] is True
