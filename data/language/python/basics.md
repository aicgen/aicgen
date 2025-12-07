# Python Fundamentals

## PEP 8 Style Guide

```python
# Naming conventions
variable_name = "snake_case"          # Variables and functions
CONSTANT_VALUE = 42                   # Constants
ClassName = "PascalCase"              # Classes
_private_var = "internal"             # Private by convention

# Imports - group and order
import os                             # 1. Standard library
import sys

import requests                       # 2. Third-party
from flask import Flask

from myapp.models import User         # 3. Local application
from myapp.utils import helper
```

## String Formatting

```python
# ✅ Use f-strings (Python 3.6+)
name = "Alice"
age = 30
message = f"Hello, {name}! You are {age} years old."

# ✅ Multi-line f-strings
query = f"""
    SELECT *
    FROM users
    WHERE name = '{name}'
    AND age > {age - 5}
"""

# ❌ Avoid old-style formatting
message = "Hello, %s!" % name           # Old style
message = "Hello, {}!".format(name)     # Verbose
```

## List Comprehensions

```python
# ✅ Simple and readable
squares = [x ** 2 for x in range(10)]
even_squares = [x ** 2 for x in range(10) if x % 2 == 0]

# ❌ Too complex - use regular loop instead
result = [
    transform(item)
    for sublist in nested_list
    for item in sublist
    if condition(item) and another_condition(item)
]

# ✅ Break into steps when complex
filtered_items = [item for sublist in nested_list for item in sublist]
filtered_items = [item for item in filtered_items if condition(item)]
result = [transform(item) for item in filtered_items]
```

## Context Managers

```python
# ✅ Always use context managers for resources
with open('file.txt', 'r') as f:
    content = f.read()
# File automatically closed

# ✅ Database connections
with db.connection() as conn:
    cursor = conn.execute(query)

# ✅ Multiple resources
with open('input.txt') as infile, open('output.txt', 'w') as outfile:
    outfile.write(infile.read())
```

## Pythonic Patterns

```python
# ✅ EAFP (Easier to Ask Forgiveness than Permission)
try:
    value = my_dict[key]
except KeyError:
    value = default

# Or simply:
value = my_dict.get(key, default)

# ✅ Truthiness
if my_list:          # Instead of: if len(my_list) > 0
    process(my_list)

if name:             # Instead of: if name != ""
    greet(name)
```
