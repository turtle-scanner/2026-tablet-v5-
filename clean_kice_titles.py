import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

def clean_question_title(title, sec_key, q_idx, points):
    if not isinstance(title, str) or not title:
        if sec_key == 'A':
            return f"[문항 A-{q_idx+1}]"
        elif sec_key == 'B':
            return f"[문항 B-{q_idx+1}]"
        return f"{q_idx+1}."

    # A형/B형 번호 추출
    match_a = re.search(r'A-?(\d+)', title, re.IGNORECASE)
    match_b = re.search(r'B-?(\d+)', title, re.IGNORECASE)
    
    if match_a:
        q_num = match_a.group(1)
        return f"[문항 A-{q_num}]"
    elif match_b:
        q_num = match_b.group(1)
        return f"[문항 B-{q_num}]"
    elif sec_key == 'A':
        return f"[문항 A-{q_idx+1}]"
    elif sec_key == 'B':
        return f"[문항 B-{q_idx+1}]"
    else:
        return title

def process_exams(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        exams = json.load(f)

    for ex in exams:
        sections = ex.get('sections', {})
        for sec_key, sec in sections.items():
            if not isinstance(sec, dict):
                continue
            questions = sec.get('questions', [])
            for idx, q in enumerate(questions):
                title = q.get('title', '')
                points = q.get('points') or q.get('score') or 2
                
                if sec_key in ['A', 'B']:
                    new_title = clean_question_title(title, sec_key, idx, points)
                    q['title'] = new_title

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)
    print(f"[{file_path}] Successfully cleaned all question titles to clean format like [문항 A-1], [문항 B-1]!")

process_exams('data/exams.json')
process_exams('data/default_exams.json')
