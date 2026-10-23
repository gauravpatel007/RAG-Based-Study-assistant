"""Concept Map generation logic."""
import json

def prepare_concept_edges_batch(topics, context_tokens):
    """
    topics: List of Topic objects
    """
    topic_list = "\n".join(f"[{i}] {t.title}: {t.description}" for i, t in enumerate(topics))
    
    system = (
        "You are an expert knowledge architect building a strict hierarchical Mind Map from a text. "
        "Analyze the provided list of extracted concepts/topics. "
        "Your task is to organize them into a STRICT, SINGLE-ROOTED TREE structure.\n\n"
        "1. Identify the single most overarching/central topic from the list to be the ROOT.\n"
        "2. Connect all other topics back to this root, either directly (Level 1 branches) or indirectly (sub-branches).\n"
        "3. Every topic (except the root) MUST have EXACTLY ONE parent topic.\n"
        "4. The tree should be balanced where possible (e.g., 4-10 main branches, each with subtopics).\n"
        "Do not invent relationships, but arrange them logically based on their descriptions.\n\n"
        "Return a JSON object exactly matching this schema:\n"
        '{"edges": [{"source": parent_index, "target": child_index, "relationship": "hierarchy", "evidence": "Why this is a subtopic"}]}\n'
        "source (parent) and target (child) MUST be the integer indices of the concepts from the list. "
        "The output MUST represent a valid tree with NO CYCLES and exactly ONE ROOT. "
        "Output ONLY valid JSON."
    )
    
    prompt = [
        {"role": "system", "content": system},
        {"role": "user", "content": topic_list}
    ]
    
    schema = {
        "type": "object", 
        "additionalProperties": False,
        "required": ["edges"],
        "properties": {
            "edges": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["source", "target", "relationship", "evidence"],
                    "properties": {
                        "source": {"type": "integer", "minimum": 0, "maximum": len(topics) - 1},
                        "target": {"type": "integer", "minimum": 0, "maximum": len(topics) - 1},
                        "relationship": {
                            "type": "string", 
                            "enum": ["hierarchy", "parent", "subtopic"]
                        },
                        "evidence": {"type": "string", "maxLength": 500}
                    }
                }
            }
        }
    }
    
    limit = len(topics) * 2  # up to 2 edges per topic on average
    max_tokens = 50 + limit * 60
    return prompt, schema, max_tokens

def parse_concept_edges(content, num_topics):
    try:
        values = json.loads(content).get("edges", [])
        if not isinstance(values, list):
            raise ValueError()
        
        result = []
        for value in values:
            if not isinstance(value, dict):
                continue
            
            source = value.get("source")
            target = value.get("target")
            rel = value.get("relationship")
            evidence = value.get("evidence", "")
            
            if (isinstance(source, int) and 0 <= source < num_topics and
                isinstance(target, int) and 0 <= target < num_topics and
                isinstance(rel, str) and isinstance(evidence, str) and source != target):
                
                result.append({
                    "source": source,
                    "target": target,
                    "relationship": rel,
                    "evidence": evidence
                })
        return result
    except (json.JSONDecodeError, ValueError, TypeError):
        raise RuntimeError("INVALID_OUTPUT: The model failed to follow the JSON schema.")
