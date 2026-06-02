#!/usr/bin/env python3
"""
Generate i18n translation files (lang/en.json and lang/ru.json) from pack JSON files.

This script reads all document JSON files from the src/packs/ directory and extracts:
- name: for all items
- For npc type: system.details.biography.value
- For other types: system.description.value

The output structure follows:
{
  "warhammer-to-dnd": {
    "packs": {
      "pack-name": {
        "_id": {
          "name": "...",
          "system.details.biography.value": "..." (for npc)
          "system.description": "..." (for other types)
        }
      }
    }
  }
}
"""

import json
import os
from pathlib import Path
from collections import defaultdict

def get_project_root():
    """Get the root directory of the project (parent of scripts folder)."""
    script_dir = Path(__file__).parent
    return script_dir.parent

def load_json_file(filepath):
    """Load a JSON file and return the parsed data."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Failed to load {filepath}: {e}")
        return None

def extract_translatable_data(item_data):
    """
    Extract translatable data from a single item.
    
    Returns a dict with:
    - name: item name
    - system.details.biography.value (for npc type) or system.description (for others)
    """
    translatable = {}
    
    # Always extract name
    if "name" in item_data:
        translatable["name"] = item_data["name"]
    
    # Extract description based on type
    item_type = item_data.get("type", "")
    
    if item_type == "npc":
        # For NPC: get system.details.biography.value
        try:
            bio_value = item_data["system"]["details"]["biography"]["value"]
            if bio_value:
                translatable["system.details.biography.value"] = bio_value
        except (KeyError, TypeError):
            pass
    else:
        # For other types: get system.description.value
        try:
            desc_value = item_data["system"]["description"]["value"]
            if desc_value:
                translatable["system.description.value"] = desc_value
        except (KeyError, TypeError):
            pass
    
    return translatable

def process_packs(src_packs_dir):
    """
    Process all packs in the src/packs directory.
    
    Returns a nested dict with structure:
    {
      "pack-name": {
        "_id": {
          "name": "...",
          "system.details.biography.value": "..."
        }
      }
    }
    """
    packs_data = defaultdict(dict)
    
    # Iterate through all subdirectories in src/packs
    for pack_dir in sorted(src_packs_dir.iterdir()):
        if not pack_dir.is_dir():
            continue
        
        pack_name = pack_dir.name
        print(f"Processing pack: {pack_name}")
        
        item_count = 0
        skipped_count = 0
        
        # Iterate through all document JSON files in the pack directory.
        # Compendium metadata files like _folders.json are arrays, not documents.
        for json_file in sorted(pack_dir.rglob("*.json")):
            if json_file.name == "_folders.json":
                continue

            item_data = load_json_file(json_file)
            if item_data is None:
                continue

            if not isinstance(item_data, dict):
                skipped_count += 1
                print(f"  Warning: Skipped non-document JSON: {json_file.relative_to(pack_dir)}")
                continue
            
            # Extract the ID and translatable data
            item_id = item_data.get("_id")
            if not item_id:
                print(f"  Warning: No _id in {json_file.relative_to(pack_dir)}")
                continue
            
            translatable = extract_translatable_data(item_data)
            if translatable:
                packs_data[pack_name][item_id] = translatable
                item_count += 1
        
        print(f"  -> Processed {item_count} items")
        if skipped_count:
            print(f"  -> Skipped {skipped_count} non-document JSON files")
    
    return dict(packs_data)

def generate_i18n_files(project_root, module_id="warhammer-to-dnd"):
    """Generate i18n files for both English and Russian."""
    
    src_packs_dir = project_root / "src" / "packs"
    lang_dir = project_root / "lang"
    
    # Create lang directory if it doesn't exist
    lang_dir.mkdir(exist_ok=True)
    
    print(f"Processing packs from: {src_packs_dir}")
    print()
    
    # Process all packs
    packs_data = process_packs(src_packs_dir)
    
    # Create the final structure
    i18n_structure = {
        module_id: {
            "packs": packs_data
        }
    }
    
    # Write to en.json
    en_file = lang_dir / "en.json"
    with open(en_file, 'w', encoding='utf-8') as f:
        json.dump(i18n_structure, f, ensure_ascii=False, indent=2)
    print(f"\n✓ Generated {en_file}")
    
    # Write to ru.json (same structure, can be translated later)
    ru_file = lang_dir / "ru.json"
    with open(ru_file, 'w', encoding='utf-8') as f:
        json.dump(i18n_structure, f, ensure_ascii=False, indent=2)
    print(f"✓ Generated {ru_file}")
    
    # Print summary statistics
    total_packs = len(packs_data)
    total_items = sum(len(items) for items in packs_data.values())
    print(f"\nSummary:")
    print(f"  Total packs: {total_packs}")
    print(f"  Total items: {total_items}")

if __name__ == "__main__":
    project_root = get_project_root()
    generate_i18n_files(project_root)
