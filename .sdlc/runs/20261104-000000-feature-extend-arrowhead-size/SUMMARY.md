# Run 20261104-000000-feature-extend-arrowhead-size — policy opus55-only

Status: **accepted**

Written by code from this run's records (manifest.json and the files below); every figure is the manifest's.

## Cost

| | Cost |
|---|---:|
| Dispatched work (the calls the dispatch server made or logged) | $4.4746 |
| Orchestrator overhead (this session's own loop, priced from its transcripts) | $35.3316 |
| In-session work already inside the overhead, counted once | −$0.1164 |
| **True total** | **$39.6898** |

How the overhead was measured: transcript (no receipt; unverified).

### By phase

The calls dispatched (or logged) in each phase. The rest of the orchestrator's own loop is in the overhead above, in no phase.

| Phase | Calls | Models | Cost |
|---|---:|---|---:|
| preflight | 1 | claude-opus-5-5 | $0.0110 |
| requirements_analysis | 1 | claude-opus-5-5 | $0.1164 |
| plan_task_packets | 1 | claude-opus-5-5 | $0.0000 |
| codegen | 18 | claude-opus-5-5 | $2.3438 |
| docs | 2 | claude-opus-5-5 | $0.3635 |
| tests | 6 | claude-opus-5-5 | $0.5973 |
| debug | 6 | claude-opus-5-5 | $1.0426 |
| senior_code_review (measured: the helper's own transcript) | 10 | claude-opus-5-5 | $0.5756 |
| architecture_design (measured: the helper's own transcript) | 225 | claude-opus-5-5 | $25.6011 |
| security_review (measured: the helper's own transcript) | 5 | claude-opus-5-5 | $0.3181 |

A phase marked measured ran in a helper of this session (the architect or a reviewer): its cost is that helper's transcript priced at the list (part of the overhead above), in place of any estimate the orchestrator logged.

### Dispatched work by model

| Model | Calls | Cost |
|---|---:|---:|
| claude-opus-5-5 | 35 | $4.4746 |

### Orchestrator overhead by model

| Model | Role | Messages | Cost |
|---|---|---:|---:|
| claude-opus-5-5 | session | 61 | $2.9320 |
| claude-opus-5-5 | helper | 381 | $32.3996 |

## Provisional — re-run after closing this session

The collector reads the session's transcripts; run from inside a session that has not ended, it misses the session's own tail. Once the session is closed, run:

```
node "/Users/macbook/.claude/plugins/cache/tilicho-ai-labs/mmo/0.9.3/scripts/collect-orchestrator-usage.mjs" "/Users/macbook/Desktop/Work/AI studies TL/ex-wt/EX-FE-09/.sdlc/runs/20261104-000000-feature-extend-arrowhead-size" --project-root "/Users/macbook/Desktop/Work/AI studies TL/ex-wt/EX-FE-09"
```

## Files

- [requirements.md](requirements.md)
- [change_plan.md](change_plan.md)
- [review.json](review.json)
- [security_review.md](security_review.md)
- [manifest.json](manifest.json)
- [provenance.json](provenance.json)
