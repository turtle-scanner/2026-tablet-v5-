import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 문맥별  깨진 단어 정밀 복원 사전
dict_rep = [
    (r'생\s*+\s*에', '생각에'),
    (r'생\s*+', '생각'),
    (r'것\s*+\s*아도', '것 같아도'),
    (r'학교\s*+\s*마음', '학교 갈 마음'),
    (r'학교\s*+', '학교 갈'),
    (r'했거든\s*+\s*요', '했거든요'),
    (r'했거든\s*+', '했거든요'),
    (r'짓눌려\s*있는\s*+', '짓눌려 있는 감옥'),
    (r'상담교사\s*+', '상담교사 소견'),
    (r'내담자\s*+', '내담자 민우'),
    (r'+\s*처럼', '감옥처럼'),
    (r'+\s*아도', '같아도'),
    (r'+\s*요', '요'),
    (r'+', '') # 남은 모든 U+FFFD 기호 깔끔 삭제
]

def fix_text(text):
    if not isinstance(text, str) or not text:
        return text
    for pattern, repl in dict_rep:
        text = re.sub(pattern, repl, text)
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
