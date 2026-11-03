variable "namespace" {
  description = "Namespace to deploy into"
  type        = string
}

variable "labels" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = {}
}

variable "image" {
  description = "smart-novel-llm-gateway image, e.g. 9109679196/smart-novel-llm-gateway:1.0.1"
  type        = string
}

variable "llm_hf_model" {
  description = "GGUF model llama.cpp downloads on first start, as <Hugging Face repo>:<quant>"
  type        = string
}

variable "context_length" {
  description = "Context length in tokens the LLM serves each request with; Fithara drafts with the whole license in the prompt and in the answer, so it needs tens of thousands of tokens"
  type        = number
  default     = 32768
}
