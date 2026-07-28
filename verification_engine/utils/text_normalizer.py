import re
import string

# Regex to detect and strip all unicode emoji characters
EMOJI_PATTERN = re.compile(
    r"[\U00010000-\U0010ffff\u2600-\u26FF\u2700-\u27BF\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u1F700-\u1F77F\u1F780-\u1F7FF\u1F800-\u1F8FF\u1F900-\u1F9FF\u1FA00-\u1FA6F\u1FA70-\u1FAFF]",
    flags=re.UNICODE
)

def remove_emojis(text: str) -> str:
    """Strips emojis from text."""
    if not text:
        return ""
    return EMOJI_PATTERN.sub("", text)

def remove_punctuation(text: str) -> str:
    """Removes all punctuation and quotes."""
    if not text:
        return ""
    punct = string.punctuation + "“”‘’`•★☆—–…"
    return text.translate(str.maketrans("", "", punct))

def normalize_for_matching(text: str, preserve_emojis: bool = False) -> str:
    """
    Applies production normalization rules:
    - Lowercase
    - Remove emojis (only for matching unless preserve_emojis=True)
    - Remove punctuation
    - Remove line breaks & duplicate spaces
    - Trim whitespace
    """
    if not text:
        return ""
    
    cleaned = str(text).lower()
    
    if not preserve_emojis:
        cleaned = remove_emojis(cleaned)
        
    cleaned = remove_punctuation(cleaned)
    cleaned = cleaned.replace("\r", " ").replace("\n", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    
    return cleaned

def clean_reviewer_name(name: str) -> str:
    """Normalizes reviewer name ignoring case and extra spaces."""
    if not name:
        return ""
    name_clean = remove_emojis(name).lower()
    name_clean = remove_punctuation(name_clean)
    return re.sub(r"\s+", " ", name_clean).strip()
