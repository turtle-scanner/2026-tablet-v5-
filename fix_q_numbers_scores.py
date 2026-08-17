import json

def fix_questions():
    with open('data/exams.json', 'r', encoding='utf-8') as f:
        exams = json.load(f)

    for ex in exams:
        sections = ex.get('sections', {})
        for sec_key, sec in sections.items():
            if not sec or 'questions' not in sec or not isinstance(sec['questions'], list):
                continue
            for idx, q in enumerate(sec['questions']):
                q_id = q.get('id') or (idx + 1)
                q['id'] = q_id
                q['number'] = q_id
                
                # 배점 부여
                if sec_key == 'P':
                    score_val = q.get('points') or q.get('score') or 20
                else:
                    score_val = q.get('points') or q.get('score') or (2 if idx < 4 else 4)
                
                q['points'] = score_val
                q['score'] = score_val

    with open('data/exams.json', 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)

    with open('data/default_exams.json', 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)

    print("Successfully populated number, score, and points for all question items in all exams!")

if __name__ == '__main__':
    fix_questions()
