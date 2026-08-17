import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

def clean_exam_titles(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        exams = json.load(f)

    for ex in exams:
        sections = ex.get('sections', {})
        
        # P Section (Education)
        p_sec = sections.get('P') or ex.get('p_section')
        if p_sec and 'questions' in p_sec:
            for q in p_sec['questions']:
                q['title'] = "[1교시 교육학 논술]"

        # A Section (Major A)
        a_sec = sections.get('A') or ex.get('a_section')
        if a_sec and 'questions' in a_sec:
            for idx, q in enumerate(a_sec['questions']):
                q_num = q.get('id') or (idx + 1)
                q['title'] = f"[문항 A-{q_num}]"

        # B Section (Major B)
        b_sec = sections.get('B') or ex.get('b_section')
        if b_sec and 'questions' in b_sec:
            for idx, q in enumerate(b_sec['questions']):
                q_num = q.get('id') or (idx + 1)
                q['title'] = f"[문항 B-{q_num}]"

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)
    print(f"Successfully formatted question titles to [문항 A-N] and [문항 B-N] in {file_path}")

clean_exam_titles('data/exams.json')
clean_exam_titles('data/default_exams.json')
