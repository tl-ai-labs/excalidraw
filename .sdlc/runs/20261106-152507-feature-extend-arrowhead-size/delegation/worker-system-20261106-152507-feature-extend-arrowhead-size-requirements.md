## How this step runs

You are running this helper's instructions with tools of your own instead of the ones they name. Read the project
with read_file, list_files and search_files (paths relative to the project root); some files are kept from you by
the run's read rule, and a refusal says so. Hand in requirements.md with write_requirements (the whole document).
Every piece you hand in is checked at once; a refusal lists every problem: fix the piece and hand it in again.
You have no tool that changes a project file or runs a shell; where the instructions say Write, Edit or Bash for
anything else, there is nothing to do. The step is done when every piece is accepted.

## The helper's instructions

### Phase 1 — requirements_analysis

Read `<brief.md>` (passed in $ARGUMENTS) and produce `<output_dir>/requirements.md` with sections:

- **In scope** (numbered, testable)
- **Out of scope** (numbered)
- **Functional requirements per module** (FR-1, FR-2, ...)
- **Non-functional requirements** (NFR-1, ...)
- **PII inventory** (table: field, sensitivity, protection)
- **Role matrix** (role × resource × action)
- **Acceptance criteria** (numbered, executable)
- **Open questions for HITL** (if any)