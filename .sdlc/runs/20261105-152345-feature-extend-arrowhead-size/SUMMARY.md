# Run 20261105-152345-feature-extend-arrowhead-size — policy argon4-agsdk-only

Status: **accepted**

Written by code from this run's records (manifest.json and the files below); every figure is the manifest's.

## Cost

| | Cost |
|---|---:|
| Dispatched work (the calls the dispatch server made or logged) | $10.5566 |
| Orchestrator overhead (this session's own loop, priced from its transcripts) | $16.8774 |
| **True total** | **$27.4341** |

How the overhead was measured: transcript (no receipt; unverified).

### By phase

The calls dispatched (or logged) in each phase. The rest of the orchestrator's own loop is in the overhead above, in no phase.

| Phase | Calls | Models | Cost |
|---|---:|---|---:|
| preflight | 3 | gemini-4-argon | $0.0031 |
| requirements_analysis | 1 | gemini-4-argon | $0.1300 |
| architecture_design | 3 | gemini-4-argon | $8.0580 |
| plan_task_packets | 1 | none | $0.0000 |
| codegen | 24 | gemini-4-argon | $0.9949 |
| docs | 1 | gemini-4-argon | $0.1193 |
| tests | 7 | gemini-4-argon | $0.3734 |
| debug | 9 | gemini-4-argon | $0.5612 |
| senior_code_review | 1 | gemini-4-argon | $0.1933 |
| security_review | 1 | gemini-4-argon | $0.1234 |

### Dispatched work by model

| Model | Calls | Cost |
|---|---:|---:|
| gemini-4-argon | 50 | $10.5566 |
| none | 1 | $0.0000 |

### Orchestrator overhead by model

| Model | Role | Messages | Cost |
|---|---|---:|---:|
| claude-opus-5-5 | session | 111 | $8.9313 |
| claude-opus-5-5 | helper | 155 | $7.9462 |

## Provisional — re-run after closing this session

The collector reads the session's transcripts; run from inside a session that has not ended, it misses the session's own tail. Once the session is closed, run:

```
node "/Users/macbook/.claude/plugins/cache/tilicho-ai-labs/mmo/0.10.1/scripts/collect-orchestrator-usage.mjs" "/Users/macbook/Documents/GitHub/Google-Projects/excalidraw-2/.sdlc/runs/20261105-152345-feature-extend-arrowhead-size" --project-root "/Users/macbook/Documents/GitHub/Google-Projects/excalidraw-2"
```

## Files

- [requirements.md](requirements.md)
- [change_plan.md](change_plan.md)
- [review.json](review.json)
- [security_review.md](security_review.md)
- [manifest.json](manifest.json)
- [provenance.json](provenance.json)
