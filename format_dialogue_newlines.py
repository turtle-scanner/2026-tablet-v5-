import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 화자 패턴 목록
SPEAKERS = [
    "상담교사", "지혜", "민우", "승호", "김 교사", "경력 교사", "신임 교사", 
    "아버지", "준서", "유진", "수진", "민지", "현수", "민호", "재민", "성민", "성준",
    "집단원 A", "집단원 B", "내담자", "내담자 민우", "내담자 현수", "내담자 민호", 
    "내담 아동", "내담자 서연이", "수검자", "김 교사", "보호자"
]

def format_text_dialogue(text):
    if not isinstance(text, str) or not text:
        return text

    # 패턴: 큰따옴표, 마침표, 따옴표 뒤에 공백 후 [화자명]: 과 같은 대화 시작점이 올 때 줄바꿈 삽입
    # 예: '들었어." 지혜:' -> '들었어."\n지혜:'
    # 예: '거의? 민우:' -> '거의?\n민우:'
    
    # 1. 큰따옴표/마침표/물음표/느낌표 뒤에 화자이름: 이 올 때 바로 전 대화 뒤에 \n 대화자: 로 분리
    pattern = r'([\"\.\?\!\)]\s*)((' + '|'.join(re.escape(s) for s in SPEAKERS) + r')\s*:)'
    
    def replacer(match):
        prefix = match.group(1)
        speaker = match.group(2)
        return f"\n{speaker}"

    formatted = re.sub(pattern, r'\n\2', text)
    
    # 연속된 \n\n\n 정리
    formatted = re.sub(r'\n{3,}', '\n\n', formatted)
    
    # 각 줄 좌우 공백 정리
    lines = [line.rstrip() for line in formatted.split('\n')]
    return '\n'.join(lines).strip()

def process_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        exams = json.load(f)

    changed = 0
    for ex in exams:
        sections = ex.get('sections', {})
        for sec_key, sec in sections.items():
            if not isinstance(sec, dict):
                continue
            questions = sec.get('questions', [])
            for q in questions:
                passage = q.get('passage', '')
                if passage:
                    new_p = format_text_dialogue(passage)
                    if new_p != passage:
                        q['passage'] = new_p
                        changed += 1
                
                rubric = q.get('rubric', '')
                if rubric:
                    new_r = format_text_dialogue(rubric)
                    if new_r != rubric:
                        q['rubric'] = new_r
                        changed += 1

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)
    print(f"[{file_path}] Successfully formatted dialogue newlines in {changed} question passages/rubrics!")

process_file('data/exams.json')
process_file('data/default_exams.json')
