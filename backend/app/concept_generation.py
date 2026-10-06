"""Concept Map generation logic."""
import json

def prepare_concept_edges_batch(topics, context_tokens):
    """
    topics: List of Topic objects
    """
    topic_list = "\n".join(f"[{i}] {t.title}: {t.description}" for i, t in enumerate(topics))
    
    system = (
        "You are an expert knowledge extractor building an ontology from a text. "
        "Analyze the provided list of extracted concepts/topics. "
        "Determine meaningful, direct semantic relationships between them based solely on their provided descriptions "
        "and logical structures. Do not invent relationships or use external knowledge.\n\n"
        "Valid relationship types: PART_OF, HAS_COMPONENT, PREREQUISITE_OF, RELATED_TO, USED_BY, DEPENDS_ON.\n\n"
        "Return a JSON object exactly matching this schema:\n"
        '{"edges": [{"source": index, "target": index, "relationship": "TYPE", "evidence": "Brief 1-sentence quote or reason"}]}\n'
        "source and target MUST be the integer indices of the concepts from the list. "
        "Output ONLY valid JSON. No markdown formatting or extra text."
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
                            "enum": ["PART_OF", "HAS_COMPONENT", "PREREQUISITE_OF", "RELATED_TO", "USED_BY", "DEPENDS_ON"]
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
