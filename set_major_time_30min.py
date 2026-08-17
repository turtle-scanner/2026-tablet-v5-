import json
import os

def update_exam_times(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        exams = json.load(f)

    for ex in exams:
        sections = ex.get('sections', {})
        
        a_sec = sections.get('A') or ex.get('a_section')
        if a_sec:
            a_sec['timeLimit'] = 30
            ex['a_section'] = a_sec

        b_sec = sections.get('B') or ex.get('b_section')
        if b_sec:
            b_sec['timeLimit'] = 30
            ex['b_section'] = b_sec

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)
    print(f"Successfully updated A and B timeLimit to 30 minutes in {file_path}")

update_exam_times('data/exams.json')
update_exam_times('data/default_exams.json')
