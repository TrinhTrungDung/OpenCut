#!/usr/bin/env python3
"""
Scan .claude/skills directory and extract skill metadata.
"""

import re
from pathlib import Path
from typing import Dict, List
import yaml

def extract_frontmatter(content: str) -> Dict:
    """Extract YAML frontmatter from markdown content."""
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if match:
        try:
            return yaml.safe_load(match.group(1))
        except:
            return {}
    return {}

def extract_first_paragraph(content: str) -> str:
    """Extract first meaningful paragraph after frontmatter."""
    content = re.sub(r'^---\s*\n.*?\n---\s*\n', '', content, flags=re.DOTALL)
    lines = content.split('\n')
    paragraph = []

    for line in lines:
        line = line.strip()
        if line.startswith('#') or not line:
            if paragraph:
                break
            continue
        paragraph.append(line)
        if line.endswith('.') and len(' '.join(paragraph)) > 50:
            break

    return ' '.join(paragraph)[:200]

def scan_skills(base_path: Path) -> List[Dict]:
    """Scan all skill files and extract metadata."""
    skills = []

    for skill_file in sorted(base_path.rglob('SKILL.md')):
        skill_dir = skill_file.parent
        skill_name = skill_dir.name

        if skill_name == 'template-skill':
            continue

        if skill_dir.parent.name != 'skills':
            parent_name = skill_dir.parent.name
            skill_name = f"{parent_name}/{skill_name}"

        try:
            content = skill_file.read_text()
            frontmatter = extract_frontmatter(content)

            description = frontmatter.get('description', '')
            if not description:
                description = extract_first_paragraph(content)

            category = categorize_skill(skill_name, description, content)

            skills.append({
                'name': skill_name,
                'path': str(skill_file.relative_to(Path('.claude/skills'))),
                'description': description,
                'category': category,
                'has_scripts': (skill_dir / 'scripts').exists(),
                'has_references': (skill_dir / 'references').exists()
            })
        except Exception as e:
            print(f"Error processing {skill_file}: {e}")

    return skills

def categorize_skill(name: str, description: str, content: str) -> str:
    """Categorize skill based on name and content."""
    lower_name = name.lower()

    if any(x in lower_name for x in ['ai-', 'gemini', 'multimodal', 'adk']):
        return 'ai-ml'
    if any(x in lower_name for x in ['frontend', 'ui', 'design', 'aesthetic', 'threejs', 'canvas']):
        return 'frontend'
    if any(x in lower_name for x in ['backend', 'auth', 'payment', 'nextjs']):
        return 'backend'
    if any(x in lower_name for x in ['devops', 'docker', 'cloudflare', 'gcloud']):
        return 'infrastructure'
    if any(x in lower_name for x in ['database', 'mongodb', 'postgresql', 'sql']):
        return 'database'
    if any(x in lower_name for x in ['mcp', 'skill-creator', 'claude-code', 'repomix', 'docs-seeker']):
        return 'dev-tools'
    if any(x in lower_name for x in ['media', 'ffmpeg', 'imagemagick', 'chrome-devtools', 'document-skills']):
        return 'multimedia'
    if any(x in lower_name for x in ['web-frameworks', 'mobile', 'shopify', 'turborepo', 'tailwind', 'shadcn']):
        return 'frameworks'
    if any(x in lower_name for x in ['debug', 'problem', 'code-review', 'planning', 'research', 'sequential']):
        return 'utilities'

    return 'other'

def group_by_category(skills: List[Dict]) -> Dict[str, List[Dict]]:
    """Group skills by category."""
    categories = {}
    for skill in skills:
        category = skill['category']
        if category not in categories:
            categories[category] = []
        categories[category].append(skill)
    return categories

def main():
    """Main execution."""
    base_path = Path('.claude/skills')

    if not base_path.exists():
        print(f"Error: {base_path} not found")
        return

    print("Scanning skills...")
    skills = scan_skills(base_path)

    print(f"\nFound {len(skills)} skills\n")

    categories = group_by_category(skills)

    category_names = {
        'ai-ml': 'AI & Machine Learning',
        'frontend': 'Frontend & Design',
        'backend': 'Backend Development',
        'infrastructure': 'Infrastructure & DevOps',
        'database': 'Database & Storage',
        'dev-tools': 'Development Tools',
        'multimedia': 'Multimedia & Processing',
        'frameworks': 'Frameworks & Platforms',
        'utilities': 'Utilities & Helpers',
        'other': 'Other'
    }

    for category, skills_list in sorted(categories.items()):
        print(f"\n{category_names.get(category, category.upper())}:")
        for skill in skills_list:
            scripts = '📦' if skill['has_scripts'] else '  '
            refs = '📚' if skill['has_references'] else '  '
            print(f"  {scripts}{refs} {skill['name']:30} {skill['description'][:80]}")

    import json
    output_path = Path('.claude/scripts/skills_data.json')
    output_path.write_text(json.dumps(skills, indent=2))
    print(f"\n✓ Saved metadata to {output_path}")

if __name__ == '__main__':
    main()
