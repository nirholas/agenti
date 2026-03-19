# Contributing to OpenClaw x402

Thank you for your interest in contributing to OpenClaw x402! This document provides guidelines for contributing to this x402 payment middleware project.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/Scottcjn/openclaw-x402.git
cd openclaw-x402

# Create a virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest
```

## Making Changes

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feat/my-change`
3. **Make your changes** to the Python code
4. **Test your changes** with `pytest`
5. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `chore:`
6. **Push** to your fork and open a **Pull Request**

## Code Style

- Python 3.9+
- Type hints on all public functions
- Docstrings for modules, classes, and public methods
- Follow PEP 8 style guidelines
- Run `black` and `flake8` before submitting

## x402 Integration

This project integrates x402 payment protocol with Flask APIs. When contributing:

- Ensure payment middleware doesn't break existing Flask routes
- Test with both successful and failed payment scenarios
- Document any new configuration options
- Keep Base chain integration up to date

## What to Work On

- Check [open issues](https://github.com/Scottcjn/openclaw-x402/issues) for tasks
- Browse [rustchain-bounties](https://github.com/Scottcjn/rustchain-bounties/issues) for RTC-paid bounties
- Payment flow improvements, error handling, and documentation are high-value areas

## Pull Request Process

1. Ensure your PR description clearly describes the changes
2. Reference any related issues
3. Include test coverage for new functionality
4. Update documentation if needed

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=openclaw_x402

# Run specific test file
pytest tests/test_payment.py
```

## Security

If you find a security vulnerability, **do not open a public issue**. Use GitHub's private vulnerability reporting or contact the maintainer directly.

## Questions?

Feel free to [open an issue](https://github.com/Scottcjn/openclaw-x402/issues/new) with any questions!

---

Thank you for contributing! 🎉
