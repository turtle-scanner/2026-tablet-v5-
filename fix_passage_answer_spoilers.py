import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

def sanitize_passage_spoilers(passage):
    if not isinstance(passage, str) or not passage:
        return passage

    # 지문 내 '개념명(㉠)' 또는 '개념명(㉡)' 패턴에서 정답 개념명 스포일러 제거
    # 예: 보원의 가족 투사 과정(㉠) -> 보원의 ㉠
    # 예: 부모-자녀 연합(㉡) -> ㉡
    
    # 1. 특정 알려진 정답 개념어 스포일러 치환
    spoilers = [
        (r'[가-힗\s\-]+(?=\(㉠\))', ' ㉠ '),
        (r'[가-힗\s\-]+(?=\(㉡\))', ' ㉡ '),
        (r'[가-힗\s\-]+(?=\(㉢\))', ' ㉢ '),
        (r'[가-힗\s\-]+(?=\(㉣\))', ' ㉣ '),
        (r'\(㉠\)', ' ㉠ '),
        (r'\(㉡\)', ' ㉡ '),
        (r'\(㉢\)', ' ㉢ '),
        (r'\(㉣\)', ' ㉣ ')
    ]

    # 구체적인 스포일러 구문 교정
    passage = passage.replace('보원의 가족 투사 과정(㉠)', '보원의 ( ㉠ )')
    passage = passage.replace('부모-자녀 연합(㉡)', '( ㉡ )')
    passage = passage.replace('가족 투사 과정(㉠)', '( ㉠ )')
    passage = passage.replace('부모-자녀 연합(㉡)', '( ㉡ )')
    
    # 정규식 패턴 보정: 단어 바로 뒤에 (㉠)가 붙어 스포일러가 되는 경우
    passage = re.sub(r'([가-힣a-zA-Z0-9_\-\s]{2,20})\(㉠\)', r'( ㉠ )', passage)
    passage = re.sub(r'([가-힣a-zA-Z0-9_\-\s]{2,20})\(㉡\)', r'( ㉡ )', passage)
    passage = re.sub(r'([가-힣a-zA-Z0-9_\-\s]{2,20})\(㉢\)', r'( ㉢ )', passage)
    passage = re.sub(r'([가-힣a-zA-Z0-9_\-\s]{2,20})\(㉣\)', r'( ㉣ )', passage)

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
    print(f"[{file_path}] Successfully sanitized passage answer spoilers!")

process_file('data/exams.json')
process_file('data/default_exams.json')
