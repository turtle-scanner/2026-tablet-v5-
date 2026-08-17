import json
import os
import re

def clean_title(title):
    if not title:
        return title
    # Remove ' - [1순위] ...' or ' [1순위] ...' or ' - 🔥 ...'
    if ' - ' in title:
        title = title.split(' - ')[0].trim() if hasattr(title.split(' - ')[0], 'trim') else title.split(' - ')[0].strip()
    # Remove any leftover '[1순위...]' or '[🔥...]'
    title = re.sub(r'\[(1|2|3)순위[^\]]*\]', '', title)
    title = re.sub(r'\[🔥[^\]]*\]', '', title)
    return title.strip()

def clean_exam_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        exams = json.load(f)

    for ex in exams:
        sections = ex.get('sections', {})
        for sec_key, sec in sections.items():
            if not sec:
                continue
            questions = sec.get('questions', [])
            for q in questions:
                if 'title' in q:
                    q['title'] = clean_title(q['title'])

        # Also clean p_section, a_section, b_section
        for key in ['p_section', 'a_section', 'b_section']:
            sec = ex.get(key)
            if sec and 'questions' in sec:
                for q in sec['questions']:
                    if 'title' in q:
                        q['title'] = clean_title(q['title'])

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)
    print(f"Cleaned all question titles in {file_path}")

clean_exam_file('data/exams.json')
clean_exam_file('data/default_exams.json')
