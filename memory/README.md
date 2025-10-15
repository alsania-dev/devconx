# DevConX Memory Protocols

This directory documents memory-handling conventions for Alsania-aligned agents integrating with DevConX.

- **No implicit persistence.** Agents must request persistence explicitly and record metadata (namespace, blake3 hash, expiry) before writing to storage.
- **Snapshots first.** Before mutating long-lived memory, capture a snapshot artefact for auditability.
- **Chaos testing.** When introducing new memory schemas, include chaos-mode replay logs to detect drift.

Store memory schema definitions, mock transcripts, and conformance tests here. Production memory artefacts should live outside the repository per Alsania security policy.
