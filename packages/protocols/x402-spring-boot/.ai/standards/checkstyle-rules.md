# Checkstyle Rules

These rules are mandatory. Generated code must comply with the repository checkstyle.

## Naming
- Respect Java standard naming conventions for:
    - constants
    - local final variables
    - local variables
    - members
    - methods
    - packages
    - parameters
    - static variables
    - types
- Do not use vague names.
- Avoid name shadowing of fields by parameters or locals.

## Javadoc
- Add Javadoc on:
    - types
    - methods
    - variables
    - packages when relevant
- Javadoc must be valid and clean.

## Imports
- No star imports
- No illegal imports
- No redundant imports
- No unused imports

## Method shape
- Keep methods short enough to satisfy checkstyle
- Keep parameter count under the configured limit
- Prefer extracting small private methods over large methods

## Parameters
- Method parameters must be `final`

## Formatting
- Use spaces correctly around operators and keywords
- No whitespace mistakes around parentheses, casts, dots, unary operators, etc.
- Braces are mandatory
- Curly brace placement must be checkstyle-compliant
- Do not use empty statements
- Do not use unnecessary nested blocks

## Control flow
- Do not use inline conditionals (`?:`)
- Simplify boolean expressions when possible
- Simplify boolean returns when possible
- Every switch should have a default branch

## OO / design
- Respect visibility rules
- Prefer utility classes with hidden constructor
- Respect equals/hashCode contract
- Do not instantiate forbidden types if configured
- Prefer final classes when applicable
- Design for extension intentionally, not accidentally

## Misc
- Avoid magic numbers; extract named constants where appropriate
- Use uppercase `L`, never lowercase `l`
- Respect array type style