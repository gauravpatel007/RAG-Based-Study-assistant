# Quality Evaluation Benchmark

This document outlines the evaluation strategy for the local RAG QA system.

## 30-Question Rubric
The benchmark dataset consists of 30 fixture questions that test the following attributes:
1. **Direct Fact Retrieval (10 qs)**: Exact matches for textbook terms.
2. **Paraphrased Questions (5 qs)**: Same meaning, different vocabulary.
3. **Multi-page Evidence (5 qs)**: Information spanning multiple adjacent chunks/pages.
4. **Follow-ups (5 qs)**: Questions relying on conversation history (e.g. "Can you explain that last point in simpler terms?").
5. **Unanswerable Questions (5 qs)**: Testing if the model gracefully abstains rather than hallucinates.

## Passing Criteria
- **Isolation Checks**: 100% deterministic success (no cross-chat leaks).
- **Retrieval Hit Rate**: > 90% (Expected pages must be in the top-k chunks returned by Chroma).
- **Citation Accuracy**: > 90% of model citations map accurately to the retrieved text.
- **Abstention Rate**: > 90% successful abstention on unanswerable/out-of-scope queries.

*(Dataset questions and PDF fixtures should be loaded into `tests/e2e/fixtures` prior to running evaluation).*
