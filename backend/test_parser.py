def test_parser(chunks):
    buffer = ""
    in_think = False
    output = []
    
    for chunk in chunks:
        if not chunk: continue
        buffer += chunk
        while buffer:
            if not in_think:
                start_idx = buffer.find("<think>")
                if start_idx != -1:
                    if start_idx > 0:
                        output.append(buffer[:start_idx])
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
                            output.append(buffer[:partial_idx])
                        buffer = buffer[partial_idx:]
                        break
                    else:
                        output.append(buffer)
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
        output.append(buffer)
    return "".join(output)

print("Test 1:", test_parser(["<think>\nreasoning\n</think>\nanswer"]))
print("Test 2:", test_parser(["<thi", "nk>\nhidd", "en\n</th", "ink>\nFinal answer"]))
print("Test 3:", test_parser(["answer <t", "hink> hid"]))
print("Test 4:", test_parser(["No think here"]))
print("Test 5:", test_parser(["<think>unclosed"]))
print("Test 6:", test_parser(["<thinking>"]))
print("Test 7:", test_parser(["<thi", "s is cool"]))
