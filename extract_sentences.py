import json
import re

with open('data/ancientArtifacts.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

sentences = set()
for entry in data:
    desc = entry.get('description', '')
    # Split by period followed by space
    parts = re.split(r'\. ', desc)
    for part in parts:
        part = part.strip()
        if part:
            if not part.endswith('.'):
                part += '.'
            sentences.add(part)

with open('unique_sentences.txt', 'w', encoding='utf-8') as f:
    for s in sorted(list(sentences)):
        f.write(s + '\n')
