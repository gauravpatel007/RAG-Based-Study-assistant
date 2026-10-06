from datetime import datetime, timedelta, timezone

def calculate_sm2(rating: str, repetitions: int, previous_interval: int, ease_factor: float) -> dict:
    """
    Implements a modified SM-2 spaced repetition algorithm.
    
    rating: "again", "hard", "good", "easy"
    repetitions: current number of consecutive successful repetitions
    previous_interval: the previous review interval in days
    ease_factor: current easiness factor of the flashcard
    """
    quality_map = {"again": 0, "hard": 2, "good": 4, "easy": 5}
    q = quality_map.get(rating, 0)
    
    if q < 3:
        # Failed recall (Again / Hard)
        repetitions = 0
        interval = 1 # Reset to 1 day
    else:
        # Successful recall
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = round(previous_interval * ease_factor)
        repetitions += 1
        
    # Update ease factor
    ease_factor = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    if ease_factor < 1.3:
        ease_factor = 1.3
        
    # Easy bonus
    if rating == "easy":
        interval = round(interval * 1.3)
        
    next_review_at = datetime.now(timezone.utc) + timedelta(days=interval)
    
    # Also determine a difficulty string for UI based on ease factor
    if ease_factor < 1.7:
        difficulty_str = "hard"
    elif ease_factor > 2.6:
        difficulty_str = "easy"
    else:
        difficulty_str = "learning"
        
    return {
        "repetitions": repetitions,
        "interval": interval,
        "ease_factor": ease_factor,
        "next_review_at": next_review_at,
        "difficulty": difficulty_str
    }
