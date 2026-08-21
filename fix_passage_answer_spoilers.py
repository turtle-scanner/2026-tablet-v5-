import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

def sanitize_passage_spoilers(passage):
    if not isinstance(passage, str) or not passage:
        return passage

    # 정규식 패턴 보정: 단어 바로 뒤에 (㉠)가 붙어 스포일러가 되는 경우만 교정 (공백 \s 제외!)
    passage = passage.replace('보원의 가족 투사 과정(㉠)', '보원의 ( ㉠ )')
    passage = passage.replace('부모-자녀 연합(㉡)', '( ㉡ )')
    passage = passage.replace('가족 투사 과정(㉠)', '( ㉠ )')
    passage = passage.replace('부모-자녀 연합(㉡)', '( ㉡ )')
    
    passage = re.sub(r'([가-힣a-zA-Z0-9_\-]{2,20})\(㉠\)', r'( ㉠ )', passage)
    passage = re.sub(r'([가-힣a-zA-Z0-9_\-]{2,20})\(㉡\)', r'( ㉡ )', passage)
    passage = re.sub(r'([가-힣a-zA-Z0-9_\-]{2,20})\(㉢\)', r'( ㉢ )', passage)
    passage = re.sub(r'([가-힣a-zA-Z0-9_\-]{2,20})\(㉣\)', r'( ㉣ )', passage)

    return passage

def process_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        exams = json.load(f)

    for ex in exams:
        sections = ex.get('sections', {})
        for sec_key, sec in sections.items():
            if not isinstance(sec, dict):
                continue
            questions = sec.get('questions', [])
            for q in questions:
                passage = q.get('passage', '')
                if passage:
                    q['passage'] = sanitize_passage_spoilers(passage)

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)
    print(f"[{file_path}] Successfully sanitized passage answer spoilers without truncating text!")

process_file('data/exams.json')
process_file('data/default_exams.json')
