# Run 20261109-131655-feature-extend-arrowhead-size — policy opus55-plus-flash38-agsdk

Status: **accepted**

Written by code from this run's records (manifest.json and the files below); every figure is the manifest's.

## Cost

| | Cost |
|---|---:|
| Dispatched work (the calls the dispatch server made or logged) | $1.6675 |
| Orchestrator overhead (this session's own loop, priced from its transcripts) | $14.6745 |
| In-session work already inside the overhead, counted once | −$0.0684 |
| **True total** | **$16.2736** |

How the overhead was measured: transcript (no receipt; unverified).

### By phase

The calls dispatched (or logged) in each phase. The rest of the orchestrator's own loop is in the overhead above, in no phase.

| Phase | Calls | Models | Cost |
|---|---:|---|---:|
| preflight | 4 | claude-opus-5-5, gemini-3.8-flash | $0.0103 |
| requirements_analysis | 1 | claude-opus-5-5 | $0.0684 |
| plan_task_packets | 1 | claude-opus-5-5 | $0.0000 |
| codegen | 24 | gemini-3.8-flash, claude-opus-5-5 | $1.0575 |
| docs | 2 | gemini-3.8-flash | $0.0532 |
| tests | 4 | gemini-3.8-flash, claude-opus-5-5 | $0.1920 |
| debug | 12 | gemini-3.8-flash, claude-opus-5-5 | $0.2860 |
| architecture_design (measured: the helper's own transcript) | 70 | claude-opus-5-5 | $6.3433 |
| security_review (measured: the helper's own transcript) | 6 | claude-opus-5-5 | $0.3011 |
| senior_code_review (measured: the helper's own transcript) | 12 | claude-opus-5-5 | $0.7613 |

A phase marked measured ran in a helper of this session (the architect or a reviewer): its cost is that helper's transcript priced at the list (part of the overhead above), in place of any estimate the orchestrator logged.

### Dispatched work by model

| Model | Calls | Cost |
|---|---:|---:|
| claude-opus-5-5 | 6 | $1.1175 |
| gemini-3.8-flash | 42 | $0.5500 |

### Orchestrator overhead by model

| Model | Role | Messages | Cost |
|---|---|---:|---:|
| claude-opus-5-5 | session | 38 | $1.6552 |
| claude-opus-5-5 | helper | 196 | $13.0193 |

## Provisional — re-run after closing this session

The collector reads the session's transcripts; run from inside a session that has not ended, it misses the session's own tail. Once the session is closed, run:

```
node "/Users/sriram/Desktop/ai-sdlc-orchestrator-claude-code-harness/plugin/scripts/collect-orchestrator-usage.mjs" "/Users/sriram/bf-agy/EX-FE-09/.sdlc/runs/20261109-131655-feature-extend-arrowhead-size" --project-root "/Users/sriram/bf-agy/EX-FE-09"
```

## Files

- [requirements.md](requirements.md)
- [change_plan.md](change_plan.md)
- [review.json](review.json)
- [security_review.md](security_review.md)
- [manifest.json](manifest.json)
- [provenance.json](provenance.json)
