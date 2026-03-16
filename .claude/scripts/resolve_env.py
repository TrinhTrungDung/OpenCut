#!/usr/bin/env python3
"""
Centralized environment variable resolver for Claude Code skills.

Resolves environment variables following the Claude Code hierarchy:
1. process.env                    - Runtime environment (HIGHEST)
2. .claude/skills/<skill>/.env    - Project skill-specific
3. .claude/skills/.env            - Project shared
4. .claude/.env                   - Project global
5. ~/.claude/skills/<skill>/.env  - User skill-specific
6. ~/.claude/skills/.env          - User shared
7. ~/.claude/.env                 - User global (LOWEST)

Usage:
    from resolve_env import resolve_env

    api_key = resolve_env('GEMINI_API_KEY', skill='ai-multimodal')
    api_key = resolve_env('GEMINI_API_KEY')  # Without skill context
"""

import os
import sys
from pathlib import Path
from typing import Optional, Dict, List, Tuple

def _parse_env_file_fallback(path) -> Dict[str, str]:
    """Pure-Python fallback .env parser when python-dotenv is not installed."""
    env_vars = {}
    try:
        with open(path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    if (value.startswith('"') and value.endswith('"')) or \
                       (value.startswith("'") and value.endswith("'")):
                        value = value[1:-1]
                    env_vars[key] = value
    except Exception:
        pass
    return env_vars


try:
    from dotenv import dotenv_values
except ImportError:
    dotenv_values = _parse_env_file_fallback


def find_project_root() -> Optional[Path]:
    """Find project root by looking for .git or .claude directory."""
    current = Path.cwd()
    for directory in [current] + list(current.parents):
        if (directory / '.git').exists() or (directory / '.claude').exists():
            return directory
    return None


def get_env_file_paths(skill: Optional[str] = None) -> List[Tuple[str, Path]]:
    """Get all potential .env file paths in priority order."""
    paths = []
    project_root = find_project_root()
    home = Path.home()

    if project_root:
        if skill:
            paths.append((
                f"Project skill-specific ({skill})",
                project_root / '.claude' / 'skills' / skill / '.env'
            ))
        paths.append(("Project skills shared", project_root / '.claude' / 'skills' / '.env'))
        paths.append(("Project global", project_root / '.claude' / '.env'))

    if skill:
        paths.append((f"User skill-specific ({skill})", home / '.claude' / 'skills' / skill / '.env'))
    paths.append(("User skills shared", home / '.claude' / 'skills' / '.env'))
    paths.append(("User global", home / '.claude' / '.env'))

    return paths


def resolve_env(
    var_name: str,
    skill: Optional[str] = None,
    default: Optional[str] = None,
    verbose: bool = False
) -> Optional[str]:
    """Resolve environment variable following Claude Code hierarchy."""
    value = os.getenv(var_name)
    if value:
        if verbose:
            print(f"✓ {var_name} found in: Runtime environment (process.env)")
        return value

    if verbose:
        print(f"✗ {var_name} not in: Runtime environment")

    env_paths = get_env_file_paths(skill)

    for description, path in env_paths:
        if path.exists():
            try:
                env_vars = dotenv_values(path)
                value = env_vars.get(var_name)
                if value:
                    if verbose:
                        print(f"✓ {var_name} found in: {description}")
                        print(f"  Path: {path}")
                    return value
                else:
                    if verbose:
                        print(f"✗ {var_name} not in: {description} (file exists)")
            except Exception as e:
                if verbose:
                    print(f"⚠ Error reading {description}: {e}")
        else:
            if verbose:
                print(f"✗ {var_name} not in: {description} (file not found)")

    if verbose:
        print(f"\n❌ {var_name} not found in any location")
        if default:
            print(f"   Using default: {default}")

    return default


def find_all(var_name: str, skill: Optional[str] = None) -> List[Tuple[str, str, Path]]:
    """Find all locations where a variable is defined."""
    results = []
    value = os.getenv(var_name)
    if value:
        results.append(("Runtime environment", value, None))

    env_paths = get_env_file_paths(skill)
    for description, path in env_paths:
        if path.exists():
            try:
                env_vars = dotenv_values(path)
                value = env_vars.get(var_name)
                if value:
                    results.append((description, value, path))
            except Exception:
                pass

    return results


def show_hierarchy(skill: Optional[str] = None):
    """Print the environment variable resolution hierarchy."""
    print("Environment Variable Resolution Hierarchy")
    print("=" * 60)
    print("\nPriority order (highest to lowest):")
    print("1. process.env - Runtime environment")

    env_paths = get_env_file_paths(skill)
    for i, (description, path) in enumerate(env_paths, start=2):
        exists = "✓" if path.exists() else "✗"
        print(f"{i}. {description:30} {exists} {path}")

    print("\n" + "=" * 60)


def main():
    """CLI interface for environment variable resolution."""
    import argparse

    parser = argparse.ArgumentParser(description='Resolve environment variables following Claude Code hierarchy')
    parser.add_argument('var_name', nargs='?', help='Environment variable name to resolve')
    parser.add_argument('--skill', help='Skill name for skill-specific resolution')
    parser.add_argument('--default', help='Default value if not found')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show resolution details')
    parser.add_argument('--find-all', action='store_true', help='Find all locations where variable is defined')
    parser.add_argument('--show-hierarchy', action='store_true', help='Show resolution hierarchy')
    parser.add_argument('--export', action='store_true', help='Output in export format for shell sourcing')

    args = parser.parse_args()

    if args.show_hierarchy:
        show_hierarchy(args.skill)
        sys.exit(0)

    if not args.var_name:
        parser.error("var_name is required unless --show-hierarchy is used")

    if args.find_all:
        results = find_all(args.var_name, args.skill)
        if results:
            print(f"Variable '{args.var_name}' found in {len(results)} location(s):")
            for i, (description, value, path) in enumerate(results, start=1):
                print(f"\n{i}. {description}")
                if path:
                    print(f"   Path: {path}")
                print(f"   Value: {value[:50]}{'...' if len(value) > 50 else ''}")
        else:
            print(f"❌ Variable '{args.var_name}' not found in any location")
            sys.exit(1)
    else:
        value = resolve_env(args.var_name, args.skill, args.default, args.verbose)
        if value:
            if args.export:
                print(f"export {args.var_name}='{value}'")
            else:
                print(value)
            sys.exit(0)
        else:
            if not args.verbose:
                print(f"Error: {args.var_name} not found", file=sys.stderr)
            sys.exit(1)


if __name__ == '__main__':
    main()
