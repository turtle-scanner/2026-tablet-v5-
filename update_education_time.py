import json

def update_education_time():
    with open('data/exams.json', 'r', encoding='utf-8') as f:
        exams = json.load(f)

    for ex in exams:
        if 'p_section' in ex and ex['p_section']:
            ex['p_section']['timeLimit'] = 37
            # 제목에 60분이 들어간 경우 37분으로 수정
            if 'title' in ex['p_section']:
                ex['p_section']['title'] = ex['p_section']['title'].replace('60분', '37분').replace('40분', '37분')

    with open('data/exams.json', 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)

    with open('data/default_exams.json', 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)

    print("Updated all education exam section timeLimits to 37 minutes!")

if __name__ == '__main__':
    update_education_time()
