import re
import string

def remove_emojis(text: str) -> str:
    """Strips emojis and non-printable symbols while preserving alphanumeric characters."""
    if not text:
        return ""
    # Strip emojis using proper 32-bit unicode range escapes
    return re.sub(r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F700-\U0001F77F\U0001F780-\U0001F7FF\U0001F800-\U0001F8FF\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF\u2600-\u26FF\u2700-\u27BF]', '', text)

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
