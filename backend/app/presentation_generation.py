import json
from pydantic import BaseModel, Field

class PresentationSlideSchema(BaseModel):
    title: str = Field(description="Title of the slide")
    bullet_points: list[str] = Field(description="List of bullet points. Dynamically choose between 3 large, detailed points up to 7 shorter points to perfectly fill the slide without overflowing or leaving empty space.")
    source_indices: list[int] = Field(description="Indices of the source texts used for this slide (0-based)")

class PresentationSchema(BaseModel):
    slides: list[PresentationSlideSchema]

def prepare_presentation_batch(rows, slide_count, topic_focus, source_mix, context_tokens):
    llm_pct = 50
    if source_mix == "100_pdf": llm_pct = 0
    elif source_mix == "100_llm": llm_pct = 100
    elif source_mix == "50_50": llm_pct = 50
    else:
        try: llm_pct = int(source_mix)
        except: pass

    batch = []
    text_content = ""
    token_sum = 0
    # Include context chunks if mix requires PDF
    if llm_pct < 100 and rows:
        for i, chunk in enumerate(rows):
            new_text = f"--- Source [{i}] ---\n{chunk.text}\n\n"
            token_est = len(new_text) // 4
            if token_sum + token_est > context_tokens:
                break
            text_content += new_text
            token_sum += token_est
            batch.append(chunk)

    if llm_pct == 0:
        instruction = (
            f"You are a strict presentation generator. Create exactly {slide_count} slides about '{topic_focus}'. "
            "You MUST ONLY use information from the provided source texts. Do not add outside information."
        )
    elif llm_pct == 100:
        instruction = (
            f"You are a knowledgeable presentation generator. Create exactly {slide_count} slides about '{topic_focus}'. "
            "Use your internal general knowledge to make the presentation informative and engaging."
        )
    else:
        instruction = (
            f"You are a knowledgeable presentation generator. Create exactly {slide_count} slides about '{topic_focus}'. "
            f"Draw approximately {100 - llm_pct}% of the content from the provided source texts and {llm_pct}% from your general knowledge to create a comprehensive presentation."
        )

    prompt = (
        f"{instruction}\n\n"
        "CRITICAL REQUIREMENTS FOR ADAPTIVE, DYNAMIC SLIDE CONTENT:\n"
        "1. Dynamic Content Distribution: Do not force a fixed number of bullet points. Vary the number of points based on the complexity of the topic (e.g., 3-4 large detailed points, or 5-7 shorter points) so that the slide is visually balanced and perfectly filled.\n"
        "2. Avoid Empty Slides & Overflows: Ensure the slide has enough meaningful content to avoid leaving large empty gaps (do not leave 60% empty space), but do not overcrowd it. If a concept is huge, split it across multiple slides.\n"
        "3. Quality & Depth: Prioritize meaningful explanations, important concepts, and examples. Never add fluff just to fill space.\n"
        "4. DO NOT generate any speaker notes. Omit them entirely to focus all detail on the slide content.\n"
        "5. Return ONLY valid JSON matching the schema.\n"
    )
    if text_content:
        prompt += f"Here are the source texts:\n{text_content}"
        
    messages = [{"role": "user", "content": prompt}]
    schema = PresentationSchema.model_json_schema()
    max_tokens = 8192 # Increased for dense slides
    return batch, messages, schema, max_tokens

def parse_presentation(content):
    try:
        data = json.loads(content)
        slides = data.get("slides", [])
        return slides
    except json.JSONDecodeError:
        # Simple extraction if bounded by JSON markup
        try:
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(content[start:end])
                return data.get("slides", [])
        except Exception:
            pass
    return []
