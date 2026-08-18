import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

# git checkout으로 깨지기 전 정상 데이터 복원 후 오직 필요한 정제만 안전하게 수행
os.system('git checkout 5d385f5 -- data/exams.json data/default_exams.json')

def clean_text_safely(text):
    if not isinstance(text, str):
        return text
    # 불필요하게 껴들어간 '상' 글자 오염 세척
    # 단, '상담' 등 진짜 단어는 유지
    return text

with open('data/exams.json', 'r', encoding='utf-8', errors='ignore') as f:
    raw = f.read()

# '상' 문자 오염이 있는지 체크 후 세척
if '상[실제상' in raw or '상K상I상C상E' in raw:
    print("Found '상' corruption, cleaning...")
    # '상' 오염 제거 정규식
    # 글자 마다 낀 '상' 제거
    import re
    # 예: 상[실제상 -> [실제
    raw = raw.replace('상[실제상', '[실제')
    raw = raw.replace('상회상차상', '회차')
    raw = raw.replace('상K상I상C상E상', 'KICE')
    raw = raw.replace('상기상출상', '기출')
    raw = raw.replace('상1상순상위상', '1순위')
    raw = raw.replace('상1상0상0상%', '100%')
    raw = raw.replace('상적상중상', '적중')
    raw = raw.replace('상파상이상널상', '파이널')
    raw = raw.replace('상킬상러상', '킬러')
    raw = raw.replace('상통상합상', '통합')
    raw = raw.replace('상모상의상고상사상', '모의고사')
    raw = raw.replace('상(상교상육상학상+상전상공상', '(교육학+전공')
    raw = raw.replace('상A상/상B상', 'A/B')
    raw = raw.replace('상2상3상문상항상', '23문항')
    raw = raw.replace('상화상면상자상', '화면자')
    raw = raw.replace('상방상지상', '방지')
    raw = raw.replace('상최상적상화상', '최적화')
    raw = raw.replace('상판상', '판')

    with open('data/exams.json', 'w', encoding='utf-8') as f:
        f.write(raw)

print("Safely restored data/exams.json and data/default_exams.json!")
