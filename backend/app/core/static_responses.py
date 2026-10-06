import re
from datetime import datetime
# import pytz

STATIC_RESPONSES = [
    (r"^(good morning|morning)$", "Good morning! Ready to learn something today?"),
    (r"^(good afternoon|afternoon)$", "Good afternoon! How can I help you today?"),
    (r"^(good evening|evening)$", "Good evening! What would you like to work on?"),
    (r"^(good night|night|nighty night)$", "Good night! Rest well and come back whenever you are ready to study."),
    (r"^(bye|goodbye|see ya|cya|bye bye)$", "Bye! Have a great day and happy studying!"),
    (r"^(see you later|see you|catch you later)$", "See you later! I will be here when you need me."),
    (r"^(thank you|thanks|thanks a lot|thank u)$", "You are welcome! Happy to help."),
    (r"^(sorry|my bad|apologies)$", "No worries at all! We can continue whenever you are ready."),
    (r"^(okay|ok|alright|got it)$", "Got it! What would you like to do next?"),
    (r"^(who are you\?*|what are you\?*)$", "I am your AI Study Assistant. I can help you work with your uploaded documents and support your study sessions."),
    (r"^(what is your name\?*|whats your name\?*|your name\?*)$", "You can call me your Study Assistant!"),
    (r"^(what can you do\?*|how can you help\?*|what do you do\?*)$", "I can help with uploaded documents, answer study questions, explain concepts, generate quizzes, and support your learning workflow."),
    (r"^(how can you help me\?*|help me\?*)$", "Upload a document or tell me what you want to study, and I will help you from there."),
    (r"^(are you an ai\?*|are you ai\?*|are you a bot\?*|are you bot\?*)$", "Yes. I am an AI-powered Study Assistant designed to help with learning and document-based questions."),
    (r"^(are you a human\?*|are you human\?*|are you real\?*)$", "No, I am an AI assistant. But I am here to make studying easier and more interactive."),
    (r"^(who made you\?*|who created you\?*|who is your creator\?*)$", "I am part of this Study Assistant application, built to help users learn and work with their study material."),
    (r"^(do you sleep\?*)$", "Nope! I do not sleep, so I am available whenever you want to study."),
    (r"^(do you get tired\?*)$", "I do not get tired, so you can keep asking whenever you need help."),
    (r"^(do you remember me\?*)$", "I can use the conversation context that the app provides to me. What I remember depends on how this Study Assistant stores chat history."),
    (r"^(can we chat\?*|let's chat|lets chat|chat with me)$", "Of course! We can chat, or we can jump straight into studying."),
    (r"^(talk to me)$", "Sure! Tell me what is on your mind, or we can start with a study topic."),
    (r"^(i am bored|i'm bored|bored|this is boring)$", "Let us change that! You could try a quick quiz, learn one new concept, or take a short break."),
    (r"^(tell me a joke|make me laugh|joke)$", "Why did the student bring a ladder to class? Because they wanted to go to the next level!"),
    (r"^(tell me something interesting|interesting fact)$", "Here is a quick fact: taking short breaks during focused study sessions can help you return with better attention."),
    (r"^(motivate me)$", "Start small. Study for just 10 focused minutes. Once you begin, continuing usually feels much easier."),
    (r"^(wish me luck|good luck)$", "Good luck! Stay calm, trust your preparation, and give it your best."),
    (r"^(i am tired|i'm tired|tired)$", "A short break, some water, and a little movement may help. You can continue when you feel refreshed."),
    (r"^(i need a break|break time|let's take a break|can we take a break)$", "That sounds reasonable. Take a short break and come back with a fresh mind."),
    (r"^(i am stressed|i'm stressed|stressed)$", "Try slowing things down and handling one small task at a time. A short break and a clear next step can make things feel more manageable."),
    (r"^(i am happy today|i'm happy|i am happy|happy)$", "That is great to hear! Let us use that energy for something productive or enjoyable."),
    (r"^(i am feeling lazy|i'm lazy|i feel lazy|lazy)$", "Make the first step tiny: open your notes, pick one topic, and study for five minutes. Starting is the hardest part."),
    (r"^(i cannot focus|i can't focus|can't focus|i cant focus)$", "Remove one distraction, choose one small task, and focus on it for 10 to 15 minutes before checking anything else."),
    (r"^(i am hungry|i'm hungry|hungry)$", "Sounds like a snack or meal break might be a good idea. Come back when you are recharged!"),
    (r"^(i am sleepy|i'm sleepy|sleepy)$", "If you are very sleepy, rest may be more useful than forcing a study session. You can continue afterward."),
    (r"^(what should i do today\?*|what to do\?*)$", "Pick your top three priorities, start with the most important one, and keep the first task small enough to begin immediately."),
    (r"^(can you help me study\?*|help me study)$", "Absolutely! Upload your study document or choose a topic, and we can get started."),
    (r"^(let's study|lets study|start studying)$", "Great! Upload a document or tell me the topic you want to work on."),
    (r"^(i do not want to study|i don't want to study|i dont want to study)$", "Start with only five minutes. Pick the easiest task first, and do not worry about finishing everything at once."),
    (r"^(give me a study tip|study tip)$", "Use active recall: close your notes and try to explain the topic from memory, then check what you missed."),
    (r"^(give me a productivity tip|productivity tip)$", "Choose one clear task, remove distractions, and work on it in a focused block before switching tasks."),
    (r"^(should i take a break\?*|do i need a break\?*)$", "If your focus is dropping or you have been studying for a while, a short break can help you reset."),
    (r"^(can i upload a pdf\?*|how to upload pdf\?*)$", "Yes! Upload your PDF or supported study document, then ask questions about its content."),
    (r"^(where do i start\?*|how to start\?*|what now\?*)$", "Start by uploading a study document. After that, ask a question, request a summary, or generate a quiz."),
    (r"^(i do not understand|i don't understand|i dont understand|explain again)$", "No problem. Tell me which part is confusing, and I will explain it in a simpler way."),
    (r"^(can you repeat that\?*|repeat that\?*|say it again)$", "Sure. I can repeat or rephrase my previous answer. Tell me which part you want again."),
    (r"^(say that more simply|make it simpler|explain simpler|simpler)$", "Sure. I will keep the explanation shorter and use simpler words."),
]

def get_static_response(user_message: str) -> str | None:
    # Normalize message: lowercase, trim spaces, remove harmless punctuation
    normalized = user_message.lower().strip()
    normalized = re.sub(r'[^\w\s\?]', '', normalized)
    normalized = re.sub(r'\s+', ' ', normalized).strip()

    for pattern, response in STATIC_RESPONSES:
        if re.match(pattern, normalized):
            return response
            
    # Dynamic utility intents
    if re.match(r"^(what time is it\?*|what is the time\?*|time\?*)$", normalized):
        current_time = datetime.now().strftime("%I:%M %p")
        return f"The current time is {current_time}."
        
    if re.match(r"^(what is today's date\?*|what is the date\?*|todays date\?*|date\?*)$", normalized):
        current_date = datetime.now().strftime("%B %d, %Y")
        return f"Today is {current_date}."
        
    if re.match(r"^(what day is today\?*|what day is it\?*|day today\?*)$", normalized):
        current_day = datetime.now().strftime("%A")
        return f"Today is {current_day}."
        
    return None
