import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 1. clean commit 98278c7 checkout
os.system('git checkout 98278c7 -- data/exams.json data/default_exams.json')

def clean_file(path):
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()

    # 오염 찌꺼기 문자 제거
    if '상[' in text or '상K상I' in text:
        text = text.replace('상[실제상', '[실제')
        text = text.replace('상회상차상', '회차')
        text = text.replace('상K상I상C상E상', 'KICE')
        text = text.replace('상기상출상', '기출')
        text = text.replace('상1상순상위상', '1순위')
        text = text.replace('상1상0상0상%', '100%')
        text = text.replace('상적상중상', '적중')
        text = text.replace('상파상이상널상', '파이널')
        text = text.replace('상킬상러상', '킬러')
        text = text.replace('상통상합상', '통합')
        text = text.replace('상모상의상고상사상', '모의고사')
        text = text.replace('상(상교상육상학상+상전상공상', '(교육학+전공')
        text = text.replace('상A상/상B상', 'A/B')
        text = text.replace('상2상3상문상항상', '23문항')
        text = text.replace('상화상면상자상', '화면자')
        text = text.replace('상방상지상', '방지')
        text = text.replace('상최상적상화상', '최적화')
        text = text.replace('상판상', '판')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)

clean_file('data/exams.json')
clean_file('data/default_exams.json')
print("Pristine dataset restored successfully!")
