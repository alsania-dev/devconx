# DevConX Contracts

Smart-contract development for DevConX follows the Alsania protocol. This placeholder documents expectations until on-chain modules are introduced.

## Standards

- Solidity `^0.8.30` targeting Cancun-compatible EVMs.
- Prefer Hardhat with OpenZeppelin libraries and UUPS upgrade patterns.
- Enforce access control, pausability, and full test coverage before deployment.

## Next Steps

When contracts are required:

1. Initialise a Hardhat project within this directory.
2. Add comprehensive unit tests under `contracts/test/` and document deployment flows in `contracts/DEPLOY.md`.
3. Provide gas benchmarks and verification scripts.

All blockchain changes must undergo security review prior to merging.
