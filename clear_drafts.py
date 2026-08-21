import json
import os

draft_file = 'data/drafts.json'
with open(draft_file, 'w', encoding='utf-8') as f:
    json.dump([], f, ensure_ascii=False, indent=2)

print("Successfully cleared all old saved draft answers from data/drafts.json!")
