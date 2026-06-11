name: Feature Request
description: Suggest an idea or enhancement for the analyzer
title: "[Feature]: "
labels: ["enhancement"]
body:
  - type: markdown
    attributes:
      value: "Thank you for submitting a feature request! Please note that we are currently in Public Beta and prioritizing stability and deterministic outputs over broad feature expansion."
  - type: textarea
    id: description
    attributes:
      label: Description
      description: Describe the feature you would like to see.
    validations:
      required: true
  - type: textarea
    id: usecase
    attributes:
      label: Use Case
      description: Why do you need this feature? What problem does it solve?
    validations:
      required: true
