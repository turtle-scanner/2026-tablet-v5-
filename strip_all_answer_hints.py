import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

def sanitize_passage(passage):
    if not isinstance(passage, str) or not passage:
        return passage

    # 괄호(㉠~㉭, ①~⑩, ㄱ~ㅎ) 앞에 개념 단어가 밀착되어 정답 스포일러가 되는 경우 자동 은폐
    passage = re.sub(r'([가-힣a-zA-Z0-9_\-\s]{2,20})\(\s*([㉠-㉭①-⑩ㄱ-ㅎa-zA-D])\s*\)', r'( \2 )', passage)
    
    # 2. 알려진 구체적 정답 표기 정제
    passage = passage.replace('보원의 가족 투사 과정(㉠)', '보원의 ( ㉠ )')
    passage = passage.replace('부모-자녀 연합(㉡)', '( ㉡ )')
    passage = passage.replace('가족 투사 과정(㉠)', '( ㉠ )')
    passage = passage.replace('부모-자녀 연합(㉡)', '( ㉡ )')
    passage = passage.replace('예외질문(㉠)', '( ㉠ )')
    passage = passage.replace('지배형(㉠)', '( ㉠ )')

    return passage

def process_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        exams = json.load(f)

    for ex in exams:
        sections = ex.get('sections', {})
        for sec_key, sec in sections.items():
            if not isinstance(sec, dict):
                continue
            questions = sec.get('questions', [])
            for q in questions:
                passage = q.get('passage', '')
                if passage:
                    q['passage'] = sanitize_passage(passage)
                
                rubric = q.get('rubric', '')
                if '[정답' in rubric:
                    q['rubric'] = rubric.split('[정답')[0].strip()

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)
    print(f"[{file_path}] Successfully stripped all passage and rubric answer hints!")

process_file('data/exams.json')
process_file('data/default_exams.json')
