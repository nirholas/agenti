# Contributing to Lyra Intel

Thank you for your interest in contributing to Lyra Intel! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/lyra-intel.git
cd lyra-intel
```

### 2. Set Up Development Environment

```bash
# Install in development mode
pip install -e .

# Install development dependencies
pip install pytest pytest-asyncio black flake8 mypy

# Run tests to verify setup
pytest tests/
```

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

## Development Workflow

### Making Changes

1. **Write Tests First** (TDD recommended)
   ```bash
   # Create test file
   touch tests/test_your_feature.py
   
   # Write failing tests
   pytest tests/test_your_feature.py
   
   # Implement feature until tests pass
   ```

2. **Follow Code Style**
   ```bash
   # Format code
   black src/ tests/
   
   # Check linting
   flake8 src/ tests/
   
   # Type checking
   mypy src/
   ```

3. **Run All Tests**
   ```bash
   pytest tests/ -v
   ```

### Commit Guidelines

Write clear, descriptive commit messages:

```bash
# Good commits
git commit -m "Add dependency cycle detection to mapper"
git commit -m "Fix security scanner false positives for env vars"
git commit -m "Improve AST parser performance for large files"

# Less helpful commits (avoid)
git commit -m "fix bug"
git commit -m "update code"
git commit -m "wip"
```

Format:
```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no logic change)
- `refactor`: Code restructuring (no behavior change)
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `chore`: Maintenance tasks

### Pull Request Process

1. **Update Documentation**
   - Update README.md if adding features
   - Add docstrings to new functions/classes
   - Update CHANGELOG.md

2. **Ensure Tests Pass**
   ```bash
   pytest tests/ --cov=src --cov-report=term-missing
   ```

3. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   
   Then create a Pull Request on GitHub with:
   - Clear title describing the change
   - Description of what changed and why
   - Reference any related issues (#123)
   - Screenshots for UI changes

4. **Code Review**
   - Address reviewer feedback
   - Keep discussion focused and respectful
   - Update PR as needed

## Project Structure

```
src/
├── core/           # Core engine and orchestration
├── collectors/     # Data collection modules
├── analyzers/      # Code analysis engines
├── storage/        # Database and persistence
├── agents/         # Multi-agent system
├── api/            # REST API
├── auth/           # Authentication
├── ai/             # AI integrations
├── security/       # Security scanning
├── visualizers/    # Graph and report generation
└── ...             # Other modules
```

## Adding New Features

### New Analyzer

1. Create analyzer module:
   ```python
   # src/analyzers/my_analyzer.py
   from typing import Dict, Any
   
   class MyAnalyzer:
       """Analyzes X to detect Y."""
       
       async def analyze(self, code: str) -> Dict[str, Any]:
           """Run analysis on code.
           
           Args:
               code: Source code to analyze
               
           Returns:
               Analysis results with findings
           """
           # Implementation here
           pass
   ```

2. Add tests:
   ```python
   # tests/test_my_analyzer.py
   import pytest
   from src.analyzers.my_analyzer import MyAnalyzer
   
   @pytest.mark.asyncio
   async def test_analyzer_basic():
       analyzer = MyAnalyzer()
       result = await analyzer.analyze("def foo(): pass")
       assert result is not None
   ```

3. Register in engine:
   ```python
   # src/core/engine.py
   from src.analyzers.my_analyzer import MyAnalyzer
   
   # Add to available analyzers
   ```

### New API Endpoint

1. Add route:
   ```python
   # src/api/routes.py
   @app.route('/api/v1/my-endpoint', methods=['POST'])
   async def my_endpoint():
       """Endpoint description."""
       data = await request.get_json()
       # Handle request
       return jsonify(result)
   ```

2. Document endpoint:
   ```python
   """
   POST /api/v1/my-endpoint
   
   Description of what it does.
   
   Request:
       {
           "param": "value"
       }
       
   Response:
       {
           "result": "data"
       }
   """
   ```

## Testing

### Running Tests

```bash
# All tests
pytest tests/

# Specific test file
pytest tests/test_ast_analyzer.py

# With coverage
pytest tests/ --cov=src --cov-report=html

# Verbose output
pytest tests/ -v -s
```

### Writing Tests

```python
import pytest
from src.module import YourClass

@pytest.fixture
def sample_data():
    """Provide test data."""
    return {"key": "value"}

def test_basic_functionality(sample_data):
    """Test basic use case."""
    obj = YourClass()
    result = obj.method(sample_data)
    assert result == expected

@pytest.mark.asyncio
async def test_async_function():
    """Test async functionality."""
    result = await async_function()
    assert result is not None
```

## Documentation

### Code Documentation

Use Google-style docstrings:

```python
def analyze_code(source: str, language: str = "python") -> Dict[str, Any]:
    """Analyze source code and return metrics.
    
    Args:
        source: Source code to analyze
        language: Programming language (default: python)
        
    Returns:
        Dictionary containing:
            - complexity: Complexity score
            - issues: List of detected issues
            - metrics: Code metrics
            
    Raises:
        ValueError: If language not supported
        
    Example:
        >>> result = analyze_code("def foo(): pass")
        >>> print(result['complexity'])
        1.0
    """
    pass
```

### README Updates

When adding features, update README.md:
- Add to feature list
- Update examples if needed
- Add to roadmap if partial implementation

## Performance Guidelines

- Use async/await for I/O operations
- Implement caching where appropriate
- Profile before optimizing (use profiler module)
- Consider memory usage for large codebases

## Security Guidelines

- Never commit secrets or credentials
- Validate all user input
- Use parameterized queries for SQL
- Sanitize file paths
- Follow OWASP best practices

## Release Process

1. Update version in `pyproject.toml`
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.2.3`
4. Push tag: `git push origin v1.2.3`
5. GitHub Actions will create release

## Getting Help

- Check existing issues on GitHub
- Read documentation in `/docs`
- Ask questions in discussions
- Review existing code for patterns

## Recognition

Contributors will be:
- Listed in README.md
- Credited in release notes
- Acknowledged in documentation

Thank you for contributing to Lyra Intel! 
- contact [nich on Github](github.com/nirholas) | [nich on X](x.com/nichxbt)
