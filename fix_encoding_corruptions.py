import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

replacements = {
    "전문담": "전문상담",
    "담교사": "상담교사",
    "담": "상담",
    "르지": "따르지",
    "러한": "이러한",
    "상": "상상",
    "태": "상태",
    "황": "상황",
    "담자": "내담자",
    "담 과정": "상담 과정",
    "담 기법": "상담 기법",
    "담 목표": "상담 목표",
    "담 관계": "상담 관계",
    "담자": "상담자",
    "담 사례": "상담 사례",
    "담": "상담",
    "": "상"
}

def fix_corrupted_text(text):
    if not isinstance(text, str):
        return text
    for corrupted, fixed in replacements.items():
        text = text.replace(corrupted, fixed)
    return text

def fix_obj(obj):
    if isinstance(obj, str):
        return fix_corrupted_text(obj)
    elif isinstance(obj, list):
        return [fix_obj(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: fix_obj(v) for k, v in obj.items()}
    return obj

def process_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        exams = json.load(f)

    fixed_exams = fix_obj(exams)

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(fixed_exams, f, ensure_ascii=False, indent=2)
    print(f"[{file_path}] Successfully fixed all corrupted '' characters!")

process_file('data/exams.json')
process_file('data/default_exams.json')
