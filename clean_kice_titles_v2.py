import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

def clean_title_v2(title, sec_key, q_idx, points):
    # points 예: 2 또는 4
    pts_str = f"({points}점)" if points else ""

    # A형/B형 번호 추출
    match_a = re.search(r'A-?(\d+)', str(title), re.IGNORECASE)
    match_b = re.search(r'B-?(\d+)', str(title), re.IGNORECASE)
    
    if match_a:
        q_num = match_a.group(1)
        return f"[문항 A-{q_num}] {pts_str}".strip()
    elif match_b:
        q_num = match_b.group(1)
        return f"[문항 B-{q_num}] {pts_str}".strip()
    elif sec_key == 'A':
        return f"[문항 A-{q_idx+1}] {pts_str}".strip()
    elif sec_key == 'B':
        return f"[문항 B-{q_idx+1}] {pts_str}".strip()
    else:
        return f"{q_idx+1}. {pts_str}".strip()

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
                points = q.get('points') or q.get('score') or (2 if idx < 4 else 4)
                
                if sec_key in ['A', 'B']:
                    new_title = clean_title_v2(title, sec_key, idx, points)
                    q['title'] = new_title

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)
    print(f"[{file_path}] Successfully cleaned all question titles to strictly [문항 A-N] (N점) format!")

process_exams('data/exams.json')
process_exams('data/default_exams.json')
