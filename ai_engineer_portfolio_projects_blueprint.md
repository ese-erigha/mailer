# Production-Grade Portfolio Projects Blueprint
### Target Roles: AI Engineer & Forward Deployed Engineer (FDE)

This document outlines four production-grade projects designed to demonstrate end-to-end engineering rigor, system reliability, evaluation harnesses, and enterprise data integration.

---

## Project 1: Enterprise Financial PDF & Document Processing Engine (EdgarExtract)

### Executive Overview
An automated document processing engine built to ingest messy, multi-page financial SEC filings (10-K/10-Q) and unstructured enterprise PDFs. It parses complex multi-page tables, enforces strict schema validation using Pydantic with model retry loops, and syncs clean, structured JSON downstream.

### Key Functionality & Architecture
* **Ingestion Pipeline:** Uses layout-aware parsers (`Docling`, `LlamaParse`, or hybrid OCR/Vision LLMs) to retain multi-page context and reconstruct split balance sheet tables.
* **Schema Enforcer & Self-Correction:** Enforces strict Pydantic JSON schemas. If a output fails type validation or line-item sum reconciliation, an automated retry loop feeds the error back to the model for inline self-correction.
* **Interactive UI:** Provides a web interface showing raw document source on the left and schema-validated JSON with confidence scores on the right.

### Targeted Engineering Values & FDE Capabilities
* **Enterprise Integration:** Handling dirty, unstructured data feeds and transforming them into deterministic API payloads.
* **Robustness & Self-Healing:** Resiliency against JSON formatting errors, schema drift, and vision/OCR hallucinations.

### Evaluation Metrics & Benchmarks
* **Field Extraction Precision:** Exact-match rates on numerical financial figures and dates.
* **Schema Adherence Rate:** Percentage of extractions passing Pydantic validation on the first attempt vs. after retry loops.
* **Processing Latency & Cost per Page:** $p_{95}$ latency tracking and token expense per page.

---

## Project 2: Interactive Codebase Q&A & Search Engine (GitAssist.ai)

### Executive Overview
An advanced Retrieval-Augmented Generation (RAG) system operating over public GitHub repositories. Developers can input any public repo link and ask complex architectural or technical questions, receiving answers backed by exact code citations with line numbers and file paths.

### Key Functionality & Architecture
* **AST Chunking:** Uses Tree-sitter / Abstract Syntax Tree (AST) parsing to chunk code along logical boundaries (functions, classes, modules) rather than naive character counts.
* **Hybrid Search Engine:** Combines sparse keyword search (**BM25**) for exact function/variable identifiers with dense vector embeddings (**text-embedding-3-small** or **voyage-code-2**) using **Reciprocal Rank Fusion (RRF)**.
* **Cross-Encoder Reranking:** Passes top-50 hybrid search results through a cross-encoder reranker (e.g., Cohere Rerank v3 or BGE-Reranker) to optimize context windows.
* **Metadata Scoping:** Indexes chunks with rich metadata (`file_path`, `language`, `commit_sha`) for scoped filtering prior to vector similarity calculation.

### Targeted Engineering Values & FDE Capabilities
* **Search & Retrieval Fundamentals:** Mastery over dense/sparse search, chunking strategies, vector databases, and reranking pipelines.
* **Noise Reduction:** Maximize signal-to-noise ratio within finite LLM context windows to eliminate hallucinations in technical codebases.

### Evaluation Metrics & Benchmarks (The RAG Triad)
* **Context Recall & Precision:** Ratio of retrieved relevant code chunks vs. ground-truth reference snippets.
* **Groundedness / Faithfulness:** LLM-as-a-judge score evaluating whether generated answers are strictly derived from retrieved context.
* **Answer Relevance:** Extent to which the system directly resolves the developer's query without unnecessary fluff.

---

## Project 3: DevOps & Pull Request Operations Agent (DevOps-PR-Agent)

### Executive Overview
An operational agent built around the **Model Context Protocol (MCP)** that integrates with GitHub repositories and CI/CD pipelines. It inspects PR code diffs, queries external linting and dependency tools via MCP, leaves inline reviews, and executes state-changing actions safely.

### Key Functionality & Architecture
* **MCP Infrastructure:** Uses a Model Context Protocol server exposing standard developer tools (Log Inspector, Git Client, Issue Creator, Test Runner).
* **Human-in-the-Loop (HITL) Safety Gate:** Read-only operations execute autonomously. Any state-changing or high-risk action (e.g., merging a PR, triggering a deployment, executing SQL) requires explicit human review and approval via an admin interface.
* **Guardrails Layer:** Implements input and prompt injection filtering to prevent unauthorized system tool calls.

### Targeted Engineering Values & FDE Capabilities
* **Agentic Tool Use:** Designing robust state machines, tool selection frameworks, and memory management.
* **Enterprise Security Boundaries:** Operating safely within zero-trust environments with audit logging and human-in-the-loop oversight.

### Evaluation Metrics & Benchmarks
* **Tool-Selection Accuracy:** Precision rate in picking the appropriate tool for a given task prompt.
* **Guardrail Deflection Rate:** Success rate in catching and blocking prompt-injection attempts.
* **State Recovery Correctness:** Agent's ability to gracefully handle tool timeouts or API failure codes without falling into infinite execution loops.

---

## Project 4: AI Email & Communications Workflow Assistant (Mailer)

### Executive Overview
An enterprise communications agent that integrates with email workflows (e.g., IMAP/Gmail API). It categorizes inbound messages, extracts action items and structured payload parameters, drafts context-aware replies, and manages workflow triage.

### Key Functionality & Architecture
* **Structured Payload Extraction:** Parses multi-thread conversation histories, isolating sender intent, priority levels, action items, and scheduled dates.
* **Policy Grounding & Tool Execution:** Uses RAG over enterprise internal policies (e.g., refund rules, SLA guidelines) to ground draft responses.
* **Async Event Handling:** Operates as a background queue service processing inbound email webhooks with rate-limiting and token caching strategies.

### Targeted Engineering Values & FDE Capabilities
* **Asynchronous System Design:** Handling real-time streaming, event queues, and background task processing.
* **Context Management:** Summarizing long, multi-turn conversation threads while retaining key state variables.

### Evaluation Metrics & Benchmarks
* **Categorization Precision:** Multiclass classification accuracy against ground-truth intent labels.
* **Policy Compliance Score:** Score checking if generated draft emails strictly follow company rules.
* **Processing Throughput:** p99 response generation time and token cost per email thread handled.

---

## Centralized Evaluation & CI/CD Regression Harness

Every project in this portfolio connects to a unified evaluation framework (e.g., custom harness, Phoenix, or DeepEval) featuring:

1. **Golden Datasets:** Version-controlled test suites for each project (PDFs, Repo queries, PR diffs, Email threads).
2. **CI/CD Deployment Gates:** Automated GitHub Actions running evals on every PR to prevent accuracy or latency regressions.
3. **Public Performance Dashboard:** A real-time public dashboard displaying **Accuracy vs. Latency ($p_{95}$) vs. Token Cost ($)** across commits.