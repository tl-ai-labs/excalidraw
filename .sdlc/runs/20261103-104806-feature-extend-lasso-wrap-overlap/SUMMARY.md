# Run 20261103-104806-feature-extend-lasso-wrap-overlap — policy opus55-only

Status: **accepted**

Written by code from this run's records (manifest.json and the files below); every figure is the manifest's.

## Cost

| | Cost |
|---|---:|
| Dispatched work (the calls the dispatch server made or logged) | $1.6548 |
| Orchestrator overhead (this session's own loop, priced from its transcripts) | $14.4172 |
| In-session work already inside the overhead, counted once | −$0.0480 |
| **True total** | **$16.0240** |

How the overhead was measured: transcript (no receipt; unverified).

### By phase

The calls dispatched (or logged) in each phase. The rest of the orchestrator's own loop is in the overhead above, in no phase.

| Phase | Calls | Models | Cost |
|---|---:|---|---:|
| preflight | 1 | claude-opus-5-5 | $0.0110 |
| requirements_analysis | 1 | claude-opus-5-5 | $0.0480 |
| plan_task_packets | 1 | claude-opus-5-5 | $0.0000 |
| codegen | 3 | claude-opus-5-5 | $0.1388 |
| docs | 1 | claude-opus-5-5 | $0.3410 |
| tests | 4 | claude-opus-5-5 | $0.7444 |
| debug | 2 | claude-opus-5-5 | $0.3716 |
| architecture_design (measured: the helper's own transcript) | 41 | claude-opus-5-5 | $6.0590 |
| security_review (measured: the helper's own transcript) | 3 | claude-opus-5-5 | $0.1659 |
| senior_code_review (measured: the helper's own transcript) | 9 | claude-opus-5-5 | $0.5360 |

A phase marked measured ran in a helper of this session (the architect or a reviewer): its cost is that helper's transcript priced at the list (part of the overhead above), in place of any estimate the orchestrator logged.

### Dispatched work by model

| Model | Calls | Cost |
|---|---:|---:|
| claude-opus-5-5 | 13 | $1.6548 |

### Orchestrator overhead by model

| Model | Role | Messages | Cost |
|---|---|---:|---:|
| claude-opus-5-5 | session | 55 | $3.2376 |
| claude-opus-5-5 | helper | 131 | $11.1796 |

## Provisional — re-run after closing this session

The collector reads the session's transcripts; run from inside a session that has not ended, it misses the session's own tail. Once the session is closed, run:

```
node "/Users/macbook/.claude/plugins/cache/tilicho-ai-labs/mmo/0.9.3/scripts/collect-orchestrator-usage.mjs" "/Users/macbook/Desktop/Work/AI studies TL/ex-wt/EX-FE-04/.sdlc/runs/20261103-104806-feature-extend-lasso-wrap-overlap" --project-root "/Users/macbook/Desktop/Work/AI studies TL/ex-wt/EX-FE-04"
```

## Files

- [requirements.md](requirements.md)
- [change_plan.md](change_plan.md)
- [review.json](review.json)
- [security_review.md](security_review.md)
- [manifest.json](manifest.json)
- [provenance.json](provenance.json)

## Checks set aside

A check that already failed before the run changed a file could not judge the change, so it was set aside for that file (the latest batch receipt of each packet):

- `packages/excalidraw/tests/selection.test.tsx`: `vitest-file` (`node_modules/.bin/vitest run '{path}'`)
