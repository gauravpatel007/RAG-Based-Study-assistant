import json
import asyncio

async def test_parser():
    # Mock response
    class MockResponse:
        async def aiter_lines(self):
            chunks = [
                '{"message": {"content": "Hello! "}}',
                '{"message": {"content": "<thi"}}',
                '{"message": {"content": "nk>\\nHmm, the user wants me to explain...\\n</t"}}',
                '{"message": {"content": "hink>\\nFinal answer!"}}'
            ]
            for c in chunks:
                yield c
                await asyncio.sleep(0.01)

    response = MockResponse()
    buffer = ""
    in_think = False
    
    output = ""

    async for line in response.aiter_lines():
        if line:
            event = json.loads(line)
            chunk = event.get("message", {}).get("content", "")
            if not chunk:
                continue
            buffer += chunk
            while buffer:
                if not in_think:
                    start_idx = buffer.find("<think>")
                    if start_idx != -1:
                        if start_idx > 0:
                            output += buffer[:start_idx]
                        buffer = buffer[start_idx + len("<think>"):]
                        in_think = True
                    else:
                        partial_idx = -1
                        for i in range(len(buffer)):
                            if buffer[i] == "<" and "<think>".startswith(buffer[i:]):
                                partial_idx = i
                                break
                        if partial_idx != -1:
                            if partial_idx > 0:
                                output += buffer[:partial_idx]
                            buffer = buffer[partial_idx:]
                            break
                        else:
                            output += buffer
                            buffer = ""
                            break
                else:
                    end_idx = buffer.find("</think>")
                    if end_idx != -1:
                        buffer = buffer[end_idx + len("</think>"):]
                        in_think = False
                    else:
                        partial_idx = -1
                        for i in range(len(buffer)):
                            if buffer[i] == "<" and "</think>".startswith(buffer[i:]):
                                partial_idx = i
                                break
                        if partial_idx != -1:
                            buffer = buffer[partial_idx:]
                            break
                        else:
                            buffer = ""
                            break
    
    if buffer and not in_think:
        output += buffer

    print(f"OUTPUT: {repr(output)}")

asyncio.run(test_parser())
