from pydantic import BaseModel, Field
from typing import Optional

class ModelItem(BaseModel):
    name: str
    size_bytes: int
    parameter_size: Optional[str] = None
    family: Optional[str] = None
    modified_at: str

class AdminModelConfigResponse(BaseModel):
    active_model: str
    ollama_online: bool
    ollama_url: str
    ollama_version: Optional[str] = None
    available_models: list[ModelItem] = []
    # Hyperparameters
    retrieval_top_k: int
    retrieval_max_distance: float
    chunk_size: int
    chunk_overlap: int
    context_tokens: int
    max_output_tokens: int
    temperature: float

class AdminModelConfigUpdate(BaseModel):
    active_model: Optional[str] = None
    retrieval_top_k: Optional[int] = Field(None, ge=1, le=50)
    retrieval_max_distance: Optional[float] = Field(None, ge=0.1, le=2.0)
    chunk_size: Optional[int] = Field(None, ge=64, le=1024)
    chunk_overlap: Optional[int] = Field(None, ge=0, le=256)
    context_tokens: Optional[int] = Field(None, ge=1024, le=65536)
    max_output_tokens: Optional[int] = Field(None, ge=256, le=8192)
    temperature: Optional[float] = Field(None, ge=0.0, le=1.5)

class ModelBenchmarkRequest(BaseModel):
    prompt: Optional[str] = "Explain the difference between supervised and unsupervised learning in two sentences."
    temperature: Optional[float] = None

class ModelBenchmarkResponse(BaseModel):
    model: str
    prompt: str
    output: str
    time_to_first_token_ms: float
    total_time_ms: float
    tokens_generated: int
    tokens_per_second: float

class ModelPullRequest(BaseModel):
    name: str
