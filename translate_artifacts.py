# -*- coding: utf-8 -*-
import json
import re

# Mappings for translation
cultures = {
    "aztec": "แอซเท็ก",
    "byzantine": "ไบแซนไทน์",
    "celtic": "เซลติก",
    "chinese": "จีน",
    "egyptian": "อียิปต์",
    "etruscan": "อีทรัสกัน",
    "greek": "กรีก",
    "incan": "อินคา",
    "indian": "อินเดีย",
    "japanese": "ญี่ปุ่น",
    "mayan": "มายัน",
    "mesopotamian": "เมโสโปเตเมีย",
    "norse": "นอร์ส",
    "persian": "เปอร์เซีย",
    "phoenician": "ฟีนิเชียน",
    "roman": "โรมัน",
    "sumerian": "สุเมเรียน",
    "tibetan": "ทิเบต"
}

items = {
    "ceramic urn": "โถเซรามิก",
    "clay tablet": "แผ่นดินเหนียวจารึก",
    "golden mask": "หน้ากากทองคำ",
    "ritual bowl": "ชามพิธีกรรม",
    "silver chalice": "จอกเงิน",
    "stone stela": "แผ่นหินสลัก",
    "terracotta figure": "รูปปั้นดินเผา",
    "amulet": "เครื่องราง",
    "bronze dagger": "กริชสำริด",
    "engraved coin": "เหรียญสลักลาย",
    "glass vessel": "ภาชนะแก้ว",
    "iron shield": "โล่เหล็ก",
    "sarcophagus fragment": "ชิ้นส่วนโลงศพหิน",
    "silk scroll": "ม้วนผ้าไหม",
    "ivory carving": "งาสลัก",
    "marble bust": "รูปปั้นครึ่งตัวหินอ่อน",
    "obsidian knife": "มีดออบซิเดียน",
    "jade statue": "รูปปั้นหยก",
    "jeweled crown": "มงกุฎประดับอัญมณี",
    "papyrus fragment": "ชิ้นส่วนกระดาษปาปิรัส"
}

properties = {
    "slightly pitted": "มีรอยพรุนเล็กน้อยตามกาลเวลา",
    "unnaturally cold": "มีความเย็นเยียบที่ผิดธรรมชาติราวกับน้ำแข็ง",
    "coarse and weathered": "มีลักษณะที่หยาบกร้านและสึกกร่อนตามสภาพอากาศ",
    "cool and heavy": "ให้สัมผัสที่เย็นและมีน้ำหนักที่มั่นคง",
    "remarkably smooth": "มีความเรียบเนียนอย่างน่าอัศจรรย์ใจ",
    "surprisingly heavy": "มีน้ำหนักที่มากเกินกว่าที่สายตาเห็นจนน่าประหลาดใจ",
    "delicate and brittle": "มีความบอบบางและเปราะบางอย่างยิ่ง ราวกับจะสลายเมื่อถูกสัมผัส",
    "waxy to the touch": "ให้สัมผัสที่ลื่นไหลราวกับเคลือบด้วยไขผึ้ง"
}

fixed_sentences = {
    "Historical records suggest it was believed to have belonged to a high priest.": "บันทึกทางประวัติศาสตร์บ่งชี้ว่ามันอาจเคยเป็นสมบัติของสมณะชั้นสูงในตำนาน",
    "Historical records suggest it was discovered in the ruins of a coastal city.": "หลักฐานทางประวัติศาสตร์ระบุว่ามันถูกขุดพบในซากปรักหักพังของเมืองชายฝั่งที่สาบสูญ",
    "Historical records suggest it was excavated from a site associated with ancient rituals.": "บันทึกโบราณกล่าวว่ามันถูกขุดขึ้นมาจากสถานที่ที่ใช้ประกอบพิธีกรรมศักดิ์สิทธิ์ในอดีตกาล",
    "Historical records suggest it was found in a sealed chamber of a forgotten tomb.": "ตามบันทึกเก่าแก่ มันถูกพบในห้องลับที่ถูกปิดตายของสุสานที่โลกลืม",
    "Historical records suggest it was passed down through a minor noble family.": "เรื่องเล่าสืบต่อกันมาว่ามันถูกส่งทอดผ่านตระกูลขุนนางระดับรองมาหลายชั่วอายุคน",
    "Historical records suggest it was recovered from a deep-sea shipwreck.": "บันทึกการเดินเรือระบุว่ามันถูกกู้ขึ้นมาจากซากเรืออับปางใต้ก้นบึ้งของมหาสมุทร",
    "Historical records suggest it was rumored to be a gift from a foreign king.": "มีตำนานเล่าขานว่ามันเคยเป็นของขวัญล้ำค่าจากกษัตริย์ต่างแดนที่ห่างไกล",
    "Historical records suggest it was stolen from a museum during a time of war.": "หลักฐานชี้ให้เห็นว่ามันเคยถูกโจรกรรมไปจากพิพิธภัณฑ์ในช่วงกลียุคของสงคราม",
    "It absorbs light completely.": "มันดูดซับแสงสว่างรอบข้างไปจนสิ้น ประหนึ่งหลุมดำที่ไร้ก้นบึ้ง",
    "It catches the light in a way that feels intentional.": "เมื่อกระทบแสง มันจะทอประกายในลักษณะที่ดูราวกับจงใจสื่อความหมายบางอย่าง",
    "It reflects light with a dull glow.": "มันสะท้อนแสงออกมาเป็นประกายจางๆ ที่ดูหม่นหมองและลึกลับ",
    "It scatters light in uneven patterns.": "มันทำให้แสงที่ตกกระทบแตกกระจายเป็นลวดลายที่แปลกตาและไม่สม่ำเสมอ",
    "It seems to glow from within under direct light.": "ภายใต้แสงจ้า มันดูราวกับมีความร้อนแรงหรือแสงสว่างเรืองรองออกมาจากภายใน",
    "It shimmers with an iridescent sheen.": "ผิวของมันเลื่อมพรายด้วยรุ้งประกายที่เปลี่ยนสีไปตามมุมมอง",
    "The patina suggests extreme age, though the lack of certain expected wear patterns raises subtle questions for the discerning eye.": "คราบกรุที่เกาะกินบ่งบอกถึงอายุอานามที่ยาวนานมหาศาล ทว่าความสมบูรณ์แบบที่ไร้ร่องรอยการใช้งานบางประการ กลับสร้างความกังขาเล็กน้อยให้กับสายตาของผู้เชี่ยวชาญ",
    "Upon close inspection, the craftsmanship is intricate, yet there's an unsettling quality to its weight that defies easy categorization.": "เมื่อพิจารณาอย่างใกล้ชิด จะพบว่างานฝีมือมีความประณีตซับซ้อนอย่างยิ่ง ทว่าน้ำหนักของมันกลับมีความแปลกประหลาดที่ยากจะอธิบายได้ด้วยหลักการทั่วไป"
}

# Also handle the misspelled Thai version from previous run
fixed_sentences["ทว่าความสมณ์แบบที่ไร้ร่องรอยการใช้งานบางประการ"] = "ทว่าความสมบูรณ์แบบที่ไร้ร่องรอยการใช้งานบางประการ"

def translate_sentence(sentence):
    sentence = sentence.strip()
    if not sentence:
        return ""
    
    # Fix the misspelled Thai from previous run
    if "ความสมณ์แบบ" in sentence:
        sentence = sentence.replace("ความสมณ์แบบ", "ความสมบูรณ์แบบ")
        
    # Try fixed sentences
    full_sentence = sentence
    if not full_sentence.endswith('.'):
        full_sentence += '.'
        
    if full_sentence in fixed_sentences:
        return fixed_sentences[full_sentence]
    
    # Check for "The surface of this [culture] [item] is [property]."
    # Make the period optional in the regex to be safe
    match = re.match(r"The surface of this (.+?) is (.+?)(?:\.|$)", sentence, re.IGNORECASE)
    if match:
        full_item = match.group(1).lower().strip()
        prop_text = match.group(2).lower().strip()
        
        # Determine culture and item type
        culture_found = ""
        item_found = ""
        for c_en, c_th in cultures.items():
            if full_item.startswith(c_en):
                culture_found = c_th
                item_type_en = full_item[len(c_en):].strip()
                if item_type_en in items:
                    item_found = items[item_type_en]
                break
        
        # If not found by culture prefix, try looking for item type directly
        if not item_found:
            for i_en, i_th in items.items():
                if i_en in full_item:
                    item_found = i_th
                    break
        
        prop_found = properties.get(prop_text, prop_text)
        
        if culture_found and item_found:
            return f"พื้นผิวของ{item_found}{culture_found}ชิ้นนี้ {prop_found}"
        elif item_found:
            return f"พื้นผิวของ{item_found}ชิ้นนี้ {prop_found}"
        else:
            return f"พื้นผิวของสิ่งนี้ {prop_found}"
            
    return sentence

def translate_description(desc):
    # Split into sentences by period followed by space OR end of string
    parts = re.split(r'\. |(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?)\s', desc)
    translated_parts = []
    for part in parts:
        if part.strip():
            translated_parts.append(translate_sentence(part))
    
    return " ".join(translated_parts)

with open('data/ancientArtifacts.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for entry in data:
    if 'description' in entry:
        entry['description'] = translate_description(entry['description'])

with open('data/ancientArtifacts.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
