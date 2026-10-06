"""Pure text/intent helpers; no external services are needed to test these."""
import re

def clean_text(text):
    text = text.replace("\ufb01", "fi").replace("\ufb02", "fl").replace("\x00", "")
    text = re.sub(r"(?<=[a-z])-\n(?=[a-z])", "", text)
    text = re.sub(r"[^\S\n]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()

def intent(question):
    q = question.strip().lower().rstrip(".!?")
    if re.search(r"\b(mcqs?|quizzes|quiz|multiple.choice)\b", q):
        return "quiz"
    if re.fullmatch(r"(hi|hello|hey|thanks|thank you|how are you|how are you doing|who are you|what are you|what's up|whats up|morning|good morning|evening|good evening)[ !,.?]*", q):
        return "greeting"
    if re.search(r"(?:extract|list|show|find)\s+(?:the\s+)?(?:important|key)\s+topics", q):
        return "topics"
    if re.fullmatch(r"how (?:do|can) i upload(?: a)?(?: pdf| textbook)?", q):
        return "help"
    return "document"

def chunks(text, tokenizer, size=200, overlap=30):
    # Offset mapping preserves the source text instead of decoding normalized wordpieces.
    encoded = tokenizer(text, add_special_tokens=False, return_offsets_mapping=True, truncation=False)
    offsets = encoded["offset_mapping"]
    # Hard limit: size + generous headroom for special tokens / encoding quirks.
    hard_limit = size + 64
    start = 0
    while start < len(offsets):
        end = min(start + size, len(offsets))
        left, right = offsets[start][0], offsets[end - 1][1]
        piece = text[left:right]
        count = len(tokenizer.encode(piece, add_special_tokens=True))
        if count > hard_limit:
            # Instead of crashing, split the oversized chunk in half and yield both halves.
            mid = start + (end - start) // 2
            if mid > start and mid < end:
                left1, right1 = offsets[start][0], offsets[mid - 1][1]
                piece1 = text[left1:right1]
                count1 = len(tokenizer.encode(piece1, add_special_tokens=True))
                yield {"text": piece1, "start_offset": left1, "end_offset": right1, "token_count": count1}

                left2, right2 = offsets[mid][0], offsets[end - 1][1]
                piece2 = text[left2:right2]
                count2 = len(tokenizer.encode(piece2, add_special_tokens=True))
                yield {"text": piece2, "start_offset": left2, "end_offset": right2, "token_count": count2}
            else:
                # Fallback: force split by characters to prevent massive un-chunkable strings
                chunk_len = 2000
                for i in range(0, len(piece), chunk_len):
                    sub_piece = piece[i:i+chunk_len]
                    sub_count = len(tokenizer.encode(sub_piece, add_special_tokens=True))
                    yield {"text": sub_piece, "start_offset": left + i, "end_offset": left + i + len(sub_piece), "token_count": sub_count}
        else:
            yield {"text": piece, "start_offset": left, "end_offset": right, "token_count": count}
        if end == len(offsets):
            break
        start = end - overlap


def citation_labels(answer):
    labels = set()
    # 1. Matches [S1], [S2]
    for m in re.finditer(r"\[S(\d+)\]", answer, re.IGNORECASE):
        labels.add(f"S{m.group(1)}")
    # 2. Matches [1], [2]
    for m in re.finditer(r"\[(\d+)\]", answer):
        labels.add(f"S{m.group(1)}")
    # 3. Matches **1.**, **2.**, **1**
    for m in re.finditer(r"\*\*(\d+)\.?\*\*", answer):
        labels.add(f"S{m.group(1)}")
    # 4. In Sources: block, match lines starting with numbers e.g. 1. or **1.**
    sources_match = re.search(r"(?:^|\n)Sources:\s*\n(.*?)(?=(?:\n\s*\n|\nFollow-up|\Z))", answer, re.DOTALL | re.IGNORECASE)
    if sources_match:
        for m in re.finditer(r"^\s*(?:\*\*)?(\d+)\.?(?:\*\*)?", sources_match.group(1), re.MULTILINE):
            labels.add(f"S{m.group(1)}")
    return labels

def format_citation_numbers(text: str) -> str:
    if not text:
        return text
    # Replace [S1][S2] with **1.** **2.**
    text = re.sub(r"\[S(\d+)\](?=\[S\d+\])", r"**\1.** ", text, flags=re.IGNORECASE)
    # Replace [S1] with **1.**
    text = re.sub(r"\[S(\d+)\]", r"**\1.**", text, flags=re.IGNORECASE)
    # Under Sources: ensure numbers like "1. " become bold "**1.** "
    def bold_source_numbers(match):
        block = match.group(0)
        return re.sub(r"^(\s*)(\d+)\.\s*(?!\*)", r"\1**\2.** ", block, flags=re.MULTILINE)
    text = re.sub(r"(?:^|\n)Sources:\s*\n.*?(?=(?:\n\s*\n|\nFollow-up|\Z))", bold_source_numbers, text, flags=re.DOTALL | re.IGNORECASE)
    return text

