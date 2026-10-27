import re
import json

# Comprehensive vocabulary of Romanized Hindi / Hinglish stopwords & common keywords
HINGLISH_VOCABULARY = {
    # Pronouns & determiners
    "main", "mai", "mera", "meri", "mere", "mujhe", "mujhko",
    "hum", "humara", "humari", "humare", "humein",
    "tu", "tera", "teri", "tere", "tujhe", "tujhko",
    "tum", "tumhara", "tumhari", "tumhare", "tumhein",
    "aap", "aapka", "aapki", "aapke", "aapko",
    "yeh", "ye", "iska", "iski", "iske", "isse", "isko",
    "woh", "wo", "uska", "uski", "uske", "usse", "usko",
    "unka", "unki", "unke", "unhe", "unse", "inko", "inka",
    "sab", "sabka", "sabko", "koi", "kisi", "kuch", "apna", "apni", "apne",
    
    # Interrogatives
    "kya", "kyun", "kyu", "kaise", "kaisa", "kaisi", "kaise",
    "kahan", "kidhar", "kab", "kitna", "kitni", "kitne", "kaun",
    
    # Connectors & Prepositions
    "aur", "tatha", "ya", "lekin", "magar", "parantu", "par", "pe",
    "se", "ko", "ka", "ki", "ke", "mein", "me", "saath", "liye",
    "bhi", "hi", "toh", "to", "kyunki", "isliye", "jab", "tab",
    
    # Common verbs & auxiliaries
    "hai", "hain", "ho", "hoon", "hun", "tha", "thi", "the", "thay",
    "raha", "rahi", "rahe", "hoga", "hogi", "hoge", "honge",
    "karo", "karna", "karte", "karti", "karta", "kiya", "kiye", "karein", "karunga", "karenge",
    "jao", "jana", "jate", "jati", "jata", "gaya", "gayi", "gaye", "jaunga", "jaenge",
    "aao", "aana", "aate", "aati", "aata", "aaya", "aayi", "aaye", "aaunga", "aaenge",
    "batao", "batana", "bolo", "bolna", "suno", "sunna", "dekho", "dekhna",
    "chahiye", "chahta", "chahti", "chahte", "sakta", "sakti", "sakte", "paunga",
    "hota", "hoti", "hote", "banna", "bana", "banaye", "dena", "diya", "de",
    "lena", "liya", "le", "rakhna", "rakha",
    
    # Time, place, modifiers
    "aaj", "kal", "parso", "subah", "shaam", "raat", "dopahar",
    "yahan", "wahan", "paas", "door", "upar", "neeche", "aage", "peeche",
    "bahut", "bohot", "thoda", "thodi", "zyada", "jyada", "kam",
    "achha", "achhi", "achhe", "bura", "buri", "bure", "theek", "sahi", "galat",
    "nahi", "nahin", "na", "haan", "zaroor", "shayad", "jaldi", "dheere"
}

DEVANAGARI_REGEX = re.compile(r'[\u0900-\u097F]')

def analyze_multilingual_text(text: str) -> dict:
    """
    Analyzes text to detect multilingual code-switching (e.g. Hindi, Hinglish, English).
    Returns detailed metrics including language classification, script analysis,
    Hindi vs English percentages, and code-switching points.
    """
    if not text or not text.strip():
        return {
            "label": "Unknown",
            "primary": "en",
            "is_code_switched": False,
            "hindi_pct": 0.0,
            "english_pct": 0.0,
            "switch_count": 0,
            "script": "Latin",
            "token_count": 0
        }

    raw_tokens = re.findall(r"[\w']+|[^\w\s]", text, re.UNICODE)
    words = [t for t in raw_tokens if re.match(r"^\w+$", t, re.UNICODE)]
    
    if not words:
        return {
            "label": "Unknown",
            "primary": "en",
            "is_code_switched": False,
            "hindi_pct": 0.0,
            "english_pct": 0.0,
            "switch_count": 0,
            "script": "Latin",
            "token_count": 0
        }

    hindi_count = 0
    english_count = 0
    has_devanagari = False
    
    classified_tokens = []
    
    for word in words:
        lower = word.lower()
        if DEVANAGARI_REGEX.search(word):
            has_devanagari = True
            hindi_count += 1
            classified_tokens.append({"word": word, "lang": "hi", "type": "devanagari"})
        elif lower in HINGLISH_VOCABULARY:
            hindi_count += 1
            classified_tokens.append({"word": word, "lang": "hi", "type": "hinglish"})
        else:
            english_count += 1
            classified_tokens.append({"word": word, "lang": "en", "type": "english"})

    total = len(words)
    hindi_pct = round((hindi_count / total) * 100, 1)
    english_pct = round((english_count / total) * 100, 1)

    # Detect code-switch points (where word N is Lang A and word N+1 is Lang B)
    switch_count = 0
    for i in range(len(classified_tokens) - 1):
        if classified_tokens[i]["lang"] != classified_tokens[i + 1]["lang"]:
            switch_count += 1

    # Determine label
    if has_devanagari and english_count > 0:
        label = "Bilingual (Hindi + English)"
        primary = "hi-en"
        is_code_switched = True
    elif hindi_pct >= 20.0 and english_pct >= 20.0:
        label = "Hinglish (Code-Switching)"
        primary = "hi-en"
        is_code_switched = True
    elif hindi_pct >= 60.0 or has_devanagari:
        label = "Hindi (हिंदी / Hinglish)"
        primary = "hi"
        is_code_switched = switch_count > 1
    elif english_pct >= 85.0:
        label = "English"
        primary = "en"
        is_code_switched = False
    else:
        label = "Multilingual (Mixed)"
        primary = "mixed"
        is_code_switched = True

    return {
        "label": label,
        "primary": primary,
        "is_code_switched": is_code_switched,
        "hindi_pct": hindi_pct,
        "english_pct": english_pct,
        "switch_count": switch_count,
        "script": "Devanagari + Latin" if has_devanagari else "Latin",
        "token_count": total,
        "classified_tokens": classified_tokens[:50] # sample
    }
