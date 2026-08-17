import json

with open('data/exams.json', 'r', encoding='utf-8') as f:
    exams = json.load(f)

for ex in exams:
    if 'p_section' in ex:
        ex['p_section']['timeLimit'] = 40
        if 'title' in ex['p_section']:
            ex['p_section']['title'] = ex['p_section']['title'].replace('60분', '40분')

with open('data/exams.json', 'w', encoding='utf-8') as f:
    json.dump(exams, f, ensure_ascii=False, indent=2)

with open('data/default_exams.json', 'w', encoding='utf-8') as f:
    json.dump(exams, f, ensure_ascii=False, indent=2)

print('Successfully updated education section (p_section) timeLimit to 40 minutes across all exams!')
