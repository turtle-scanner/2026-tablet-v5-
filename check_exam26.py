import json

def check():
    with open('data/exams.json', 'r', encoding='utf-8') as f:
        exams = json.load(f)
    
    out = []
    for i, ex in enumerate(exams):
        if ex.get('id') == 'exam-26':
            out.append(f"Index {i}: id={ex.get('id')}, title={ex.get('title')}")
            secP = ex['sections']['P']['questions']
            secA = ex['sections']['A']['questions']
            secB = ex['sections']['B']['questions']
            out.append(f"  P count: {len(secP)}, A count: {len(secA)}, B count: {len(secB)}")
            out.append(f"  P-1 title: {secP[0]['title'] if secP else 'N/A'}")
            out.append(f"  A-1 title: {secA[0]['title'] if secA else 'N/A'}")

    with open('check_output.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))

check()
