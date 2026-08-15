# EduPulse Load Test Scripts
# Using k6 (https://k6.io/)

## Setup

```bash
# Install k6
# Windows: choco install k6
# Mac: brew install k6
# Linux: snap install k6
```

## Run Scenario A (Direct — no gateway)

```bash
k6 run scenarios/scenario-a-direct.js
```

## Run Scenario B (Through Gateway)

```bash
k6 run scenarios/scenario-b-gateway.js
```

## Compare Results

After running both scenarios, compare the output metrics to demonstrate EduPulse's effectiveness.
