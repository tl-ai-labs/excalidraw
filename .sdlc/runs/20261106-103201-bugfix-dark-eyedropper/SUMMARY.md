# Run 20261106-103201-bugfix-dark-eyedropper — policy argon4-agsdk-only

Status: **accepted**

Written by code from this run's records (manifest.json and the files below); every figure is the manifest's.

## Cost

| | Cost |
|---|---:|
| Dispatched work (the calls the dispatch server made or logged) | $5.3216 |
| Orchestrator overhead (this session's own loop, priced from its transcripts) | $14.6229 |
| **True total** | **$19.9445** |

How the overhead was measured: transcript (no receipt; unverified).

### By phase

The calls dispatched (or logged) in each phase. The rest of the orchestrator's own loop is in the overhead above, in no phase.

| Phase | Calls | Models | Cost |
|---|---:|---|---:|
| preflight | 3 | gemini-4-argon | $0.0031 |
| requirements_analysis | 3 | gemini-4-argon | $0.3355 |
| architecture_design | 4 | gemini-4-argon | $4.4264 |
| plan_task_packets | 1 | none | $0.0000 |
| tests | 4 | gemini-4-argon | $0.1125 |
| codegen | 6 | gemini-4-argon | $0.3139 |
| senior_code_review | 1 | gemini-4-argon | $0.0690 |
| security_review | 1 | gemini-4-argon | $0.0612 |

### Dispatched work by model

| Model | Calls | Cost |
|---|---:|---:|
| gemini-4-argon | 22 | $5.3216 |
| none | 1 | $0.0000 |

### Orchestrator overhead by model

| Model | Role | Messages | Cost |
|---|---|---:|---:|
| claude-opus-5-5 | session | 112 | $7.9267 |
| claude-opus-5-5 | helper | 109 | $6.6962 |

## Provisional — re-run after closing this session

The collector reads the session's transcripts; run from inside a session that has not ended, it misses the session's own tail. Once the session is closed, run:

```
node "/Users/macbook/.claude/plugins/cache/tilicho-ai-labs/mmo/0.10.1/scripts/collect-orchestrator-usage.mjs" "/Users/macbook/Documents/GitHub/Google-Projects/excalidraw-3/.sdlc/runs/20261106-103201-bugfix-dark-eyedropper" --project-root "/Users/macbook/Documents/GitHub/Google-Projects/excalidraw-3"
```

## Files

- [requirements.md](requirements.md)
- [change_plan.md](change_plan.md)
- [review.json](review.json)
- [security_review.md](security_review.md)
- [manifest.json](manifest.json)
- [provenance.json](provenance.json)
