import json

with open('data/exams.json', 'r', encoding='utf-8') as f:
    exams = json.load(f)

# exam-11 ~ exam-17 맵 생성
fallback_map = {}
for ex in exams:
    fallback_map[ex['id']] = ex

js_content = f"window.FALLBACK_EXAMS_MAP = {json.dumps(fallback_map, ensure_ascii=False)};\n"

with open('public/fallback_exams.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print('Successfully generated public/fallback_exams.js! Total count:', len(fallback_map))
