name: Bug Report
description: Report a bug or issue with the analyzer
title: "[Bug]: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: "Thank you for reporting a bug! **Please do not include any secrets, API keys, or private database credentials.**"
  - type: textarea
    id: reproduction
    attributes:
      label: Reproduction Steps
      description: How can we reproduce this? Include the `pnpm demo:golden-path` command output or similar if relevant.
      placeholder: |
        1. Run `pnpm test tests/demo/golden-path-demo.spec.ts`
        2. Set AI_PROVIDER=...
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What did you expect to happen?
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happened?
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Logs
      description: Provide relevant logs or output.
  - type: textarea
    id: environment
    attributes:
      label: Environment
      description: OS, Node version, Docker version, etc.
    validations:
      required: true
