import json

def fix_all_exams():
    with open('data/exams.json', 'r', encoding='utf-8') as f:
        exams = json.load(f)

    for ex in exams:
        # P / p_section
        p_sec = ex.get('p_section') or ex.get('sections', {}).get('P')
        a_sec = ex.get('a_section') or ex.get('sections', {}).get('A')
        b_sec = ex.get('b_section') or ex.get('sections', {}).get('B')

        if p_sec:
            p_sec['timeLimit'] = 37

        ex['sections'] = {
            'P': p_sec if p_sec else {"title": "1교시 교육학", "timeLimit": 37, "questions": []},
            'A': a_sec if a_sec else {"title": "2교시 전공 A", "timeLimit": 30, "questions": []},
            'B': b_sec if b_sec else {"title": "3교시 전공 B", "timeLimit": 30, "questions": []}
        }
        # timeLimit 35분 보장
        ex['sections']['A']['timeLimit'] = 35
        ex['sections']['B']['timeLimit'] = 35
        # 하위 호환성 유지
        ex['p_section'] = ex['sections']['P']
        ex['a_section'] = ex['sections']['A']
        ex['b_section'] = ex['sections']['B']

    with open('data/exams.json', 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)

    with open('data/default_exams.json', 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)

    print("Successfully normalized sections {P, A, B} for all exams including Exam 40~46!")

if __name__ == '__main__':
    fix_all_exams()
