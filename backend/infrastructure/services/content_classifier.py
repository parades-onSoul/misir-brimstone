"""
Backend content classifier used by extension and API.

This mirrors the extension-side heuristics so classification can run server-side
without bundling heavy NLP models in the extension worker.
"""
from __future__ import annotations

from collections import Counter
from typing import Literal, TypedDict
import re
from urllib.parse import urlparse


EngagementLevel = Literal["latent", "discovered", "engaged", "saturated"]
ContentType = Literal[
    "article",
    "video",
    "chat",
    "code",
    "social",
    "documentation",
    "forum",
    "unknown",
]
ContentSource = Literal["web", "pdf", "video", "chat", "note", "other"]


class ClassificationResult(TypedDict):
    engagementLevel: EngagementLevel
    contentSource: ContentSource
    contentType: ContentType
    readingDepth: float
    confidence: float
    keywords: list[str]
    nlpAvailable: bool


class DetectionResult(TypedDict):
    contentType: ContentType
    contentSource: ContentSource
    confidence: float


TYPE_MULTIPLIERS: dict[ContentType, float] = {
    "article": 1.0,
    "documentation": 1.2,
    "code": 1.3,
    "video": 0.8,
    "chat": 0.6,
    "forum": 0.9,
    "social": 0.4,
    "unknown": 0.7,
}

ENGAGEMENT_ORDER: list[EngagementLevel] = ["latent", "discovered", "engaged", "saturated"]

STOP_WORDS = {
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "shall",
    "can",
    "need",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "and",
    "but",
    "or",
    "nor",
    "not",
    "so",
    "yet",
    "that",
    "this",
    "these",
    "those",
    "it",
    "its",
    "i",
    "me",
    "my",
    "we",
    "our",
    "you",
    "your",
    "he",
    "him",
    "his",
    "she",
    "her",
    "they",
    "them",
    "their",
    "what",
    "which",
    "who",
    "when",
    "where",
    "why",
    "how",
    "also",
    "like",
    "get",
    "make",
    "go",
    "know",
    "take",
    "see",
    "come",
    "think",
    "look",
    "want",
    "give",
    "use",
    "find",
    "tell",
    "ask",
    "work",
    "seem",
    "feel",
    "try",
    "leave",
    "call",
}


def _normalize_engagement(level: str) -> EngagementLevel:
    value = (level or "").strip().lower()
    if value in {"latent", "discovered", "engaged", "saturated"}:
        return value  # type: ignore[return-value]
    if value == "ambient":
        return "latent"
    if value == "committed":
        return "saturated"
    if value == "active":
        return "engaged"
    return "latent"


def _higher_engagement(a: EngagementLevel, b: EngagementLevel) -> EngagementLevel:
    return a if ENGAGEMENT_ORDER.index(a) >= ENGAGEMENT_ORDER.index(b) else b


def _domain(url: str) -> str:
    try:
        return urlparse(url).hostname or ""
    except Exception:
        return ""


def _detect_content(url: str, title: str) -> DetectionResult:
    d = _domain(url)
    lower_url = url.lower()
    lower_title = title.lower()

    patterns: list[tuple[ContentType, ContentSource, list[str], list[str], list[str]]] = [
        (
            "video",
            "video",
            [r"youtube\.com", r"youtu\.be", r"vimeo\.com", r"twitch\.tv", r"dailymotion\.com"],
            [r"/watch\?", r"/video/", r"/embed/"],
            [],
        ),
        (
            "chat",
            "chat",
            [r"chat\.openai\.com", r"chatgpt\.com", r"claude\.ai", r"bard\.google\.com", r"perplexity\.ai", r"poe\.com"],
            [],
            [],
        ),
        (
            "code",
            "web",
            [r"github\.com", r"gitlab\.com", r"bitbucket\.org", r"codepen\.io", r"replit\.com", r"stackblitz\.com"],
            [r"/blob/", r"/tree/", r"/pull/", r"/issues/"],
            [],
        ),
        (
            "documentation",
            "pdf",
            [r"docs\.", r"readthedocs\.io", r"gitbook\.io", r"notion\.so", r"confluence\."],
            [r"/docs/", r"/documentation/", r"/api/", r"/reference/"],
            [r"documentation", r"api reference", r"user guide"],
        ),
        (
            "forum",
            "web",
            [r"stackoverflow\.com", r"stackexchange\.com", r"discourse\.", r"reddit\.com/r/.+/comments"],
            [r"/questions/", r"/answer/"],
            [],
        ),
        (
            "social",
            "web",
            [r"twitter\.com", r"x\.com", r"linkedin\.com", r"facebook\.com", r"mastodon\."],
            [],
            [],
        ),
    ]

    for content_type, source, domains, url_patterns, title_patterns in patterns:
        domain_match = any(re.search(p, d) for p in domains)
        url_match = any(re.search(p, lower_url) for p in url_patterns)
        title_match = any(re.search(p, lower_title) for p in title_patterns)
        if domain_match or url_match or title_match:
            confidence = 0.9 if domain_match else 0.7 if url_match else 0.5
            return {
                "contentType": content_type,
                "contentSource": source,
                "confidence": confidence,
            }

    if re.search(r"/(blog|post|article|news|story)/", lower_url):
        return {"contentType": "article", "contentSource": "web", "confidence": 0.5}

    return {"contentType": "article", "contentSource": "web", "confidence": 0.3}


def _keyword_and_density(content: str, max_keywords: int = 15) -> tuple[list[str], float]:
    sample = (content or "")[:10000].lower()
    words = [w for w in re.split(r"[^a-z0-9]+", sample) if len(w) > 2 and w not in STOP_WORDS]
    if not words:
        return [], 0.0
    freq = Counter(words)
    keywords = [w for w, _count in freq.most_common(max_keywords)]
    unique_ratio = len(set(words)) / max(len(words), 1)
    density = unique_ratio * 0.6 + min(1.0, len(words) / 200.0) * 0.4
    return keywords, round(density, 2)


def _calculate_interaction_score(
    dwell_time_ms: int,
    scroll_depth: float,
    word_count: int,
    content_type: ContentType,
) -> float:
    """
    Calculates the Normalized Interaction Score (0.0 - 1.5).
    
    Profiles:
    A. Text (Article, PDF, Doc): Time + Scroll
    B. Short (Chat, Social): Time vs 15s Baseline
    C. Media (Video): Time vs 60s Baseline
    D. App (Tool, Unknown): Time vs 30s Baseline
    """
    dwell_sec = dwell_time_ms / 1000.0
    
    # Profile A: Text Content
    if content_type in ("article", "documentation", "blog", "news"):
        # Expected reading time (200 wpm)
        # Cap expected time at 1s to avoid div/0
        expected_sec = (max(word_count, 1) / 200.0) * 60.0
        
        # Time Ratio (capped at 1.5x speed/depth)
        time_ratio = min(1.5, dwell_sec / max(expected_sec, 1.0))
        
        # Formula: 60% Time + 40% Scroll
        score = (0.6 * time_ratio) + (0.4 * scroll_depth)
        return min(1.5, score)

    # Profile B: Short / Ephemeral
    elif content_type in ("chat", "social", "forum", "note"):
        # Baseline: 15 seconds
        return min(1.5, dwell_sec / 15.0)

    # Profile C: Media
    elif content_type in ("video", "audio"):
        # Baseline: 60 seconds
        return min(1.5, dwell_sec / 60.0)

    # Profile D: Interactive / Tool / Default
    else: # code, unknown, tools
        # Baseline: 30 seconds
        return min(1.5, dwell_sec / 30.0)


def _assess_state_from_score(score: float) -> tuple[EngagementLevel, float]:
    """
    Maps Interaction Score to Engagement State.
    Returns (State, Confidence).
    """
    # Confidence is roughly the score itself, capped at 1.0
    confidence = min(1.0, score)
    
    if score >= 0.75:
        return "saturated", confidence
    if score >= 0.50:
        return "engaged", confidence
    if score >= 0.25:
        return "discovered", confidence
    
    return "latent", confidence


def classify_content(
    *,
    url: str,
    title: str,
    content: str,
    word_count: int,
    dwell_time_ms: int,
    scroll_depth: float,
    reading_depth: float,
    engagement: str,
) -> ClassificationResult:
    detection = _detect_content(url, title)
    keywords, density = _keyword_and_density(content)
    
    # 1. Calculate Interaction Score ("Hero Metric")
    interaction_score = _calculate_interaction_score(
        dwell_time_ms=dwell_time_ms,
        scroll_depth=scroll_depth,
        word_count=word_count,
        content_type=detection["contentType"],
    )
    
    # 2. Determine State from Score
    heuristic_level, heuristic_confidence = _assess_state_from_score(interaction_score)

    # 3. Respect Client signal if higher (e.g. manual override or better client-side heuristics)
    base_level = _normalize_engagement(engagement)
    final_level = _higher_engagement(base_level, heuristic_level)

    # 4. Final Confidence Calculation
    # Adjusted to allow high-quality content to be captured as 'latent' (instant push)
    # even with low engagement.
    confidence = (
        detection["confidence"] * 0.3
        + density * 0.4
        + heuristic_confidence * 0.3
    )

    return {
        "engagementLevel": final_level,
        "contentSource": detection["contentSource"],
        "contentType": detection["contentType"],
        "readingDepth": round(interaction_score, 3), # Store the Score in readingDepth
        "confidence": round(confidence, 2),
        "keywords": keywords,
        "nlpAvailable": True,
    }
