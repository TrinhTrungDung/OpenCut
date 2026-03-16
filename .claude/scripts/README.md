# Claude Code Scripts

Centralized utility scripts for Claude Code skills.

## Installation

```bash
pip install -r requirements.txt
```

## Scripts

- `resolve_env.py` - Centralized environment variable resolver
- `scan_commands.py` - Scan and extract command metadata
- `scan_skills.py` - Scan and extract skill metadata
- `generate_catalogs.py` - Generate YAML catalogs from data files

## Usage

```bash
# Generate skills catalog
python .claude/scripts/generate_catalogs.py --skills

# Generate commands catalog
python .claude/scripts/generate_catalogs.py --commands

# Resolve environment variable
python .claude/scripts/resolve_env.py GEMINI_API_KEY --skill ai-multimodal --verbose
```
