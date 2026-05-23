import re


MARKDOWN_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("heading", re.compile(r"^\s{0,3}#{1,6}\s+\S+", re.MULTILINE)),
    ("unordered_list", re.compile(r"^\s*[-*+]\s+\S+", re.MULTILINE)),
    ("ordered_list", re.compile(r"^\s*\d+\.\s+\S+", re.MULTILINE)),
    ("blockquote", re.compile(r"^\s{0,3}>\s+\S+", re.MULTILINE)),
    ("fenced_code", re.compile(r"```[\s\S]*?```")),
    ("inline_code", re.compile(r"`[^`\n]+`")),
    ("bold", re.compile(r"(\*\*|__)[^\n]+?\1")),
    ("italic", re.compile(r"(?<!\*)\*[^*\n]+\*(?!\*)|_[^_\n]+_")),
    ("link", re.compile(r"\[[^\]]+\]\([^)]+\)")),
    ("image", re.compile(r"!\[[^\]]*\]\([^)]+\)")),
    ("table", re.compile(r"^\s*\|.+\|\s*$", re.MULTILINE)),
    ("horizontal_rule", re.compile(r"^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$", re.MULTILINE)),
]


def detect_markdown(content: str) -> tuple[bool, list[str], int]:
    features = [name for name, pattern in MARKDOWN_PATTERNS if pattern.search(content)]
    score = len(features)
    return score > 0, features, score
