# ag402 Gateway Management

## Gateway Commands

### Start Gateway

```bash
gateway start [--port 4020] [--host 0.0.0.0]
```

### Stop Gateway

```bash
gateway stop
```

### Gateway Status

```bash
gateway status
```

## Doctor Commands

### Health Check

```bash
doctor
```

### Full Diagnostics

```bash
doctor --full
```

## Diagnostic Checks

| Check | Description |
|-------|-------------|
| Python Environment | Version, pip |
| ag402 Dependencies | Installed packages |
| Wallet Status | Balance, encryption |
| Gateway Port | Available port |
| Network | RPC connectivity |
| Database | Write permissions |
