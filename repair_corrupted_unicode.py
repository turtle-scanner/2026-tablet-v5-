import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 문맥별  깨진 단어 정밀 복원 사전 (단순 문자열 replace)
replacements = [
    ("생에", "생각에"),
    ("생", "생각"),
    ("것 아도", "것 같아도"),
    ("학교  마음", "학교 갈 마음"),
    ("학교 ", "학교 갈"),
    ("했거든 요", "했거든요"),
    ("했거든 요", "했거든요"),
    ("했거든 ", "했거든요"),
    ("짓눌려 있는 처럼", "짓눌려 있는 감옥처럼"),
    ("상담교사 ", "상담교사 소견"),
    ("내담자 ", "내담자 민우"),
    ("보원의 ", "보원의"),
    ("처럼", "감옥처럼"),
    ("아도", "같아도"),
    ("", "") # 남은 모든 U+FFFD 기호 깔끔 삭제
]

def fix_text(text):
    if not isinstance(text, str) or not text:
        return text
    for corrupted, fixed in replacements:
        text = text.replace(corrupted, fixed)
    return text

def fix_obj(obj):
    if isinstance(obj, str):
        return fix_text(obj)
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
    print(f"[{file_path}] Successfully repaired all unicode replacement characters () into clean Korean text!")

process_file('data/exams.json')
process_file('data/default_exams.json')
