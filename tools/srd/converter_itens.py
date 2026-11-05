#!/usr/bin/env python3
"""Gera public/data/srd-itens.json a partir do equipamento e dos itens mágicos do SRD 5.1
(dados do projeto 5e-bits/5e-database, licença MIT; conteúdo do SRD 5.1 da Wizards of the Coast,
licença CC-BY-4.0) e dos nomes/descrições em tools/srd/traducoes/itens.json.

Uso:  python3 tools/srd/converter_itens.py <5e-SRD-Equipment.json> <5e-SRD-Magic-Items.json> public/data/srd-itens.json

Equipamento comum: nome, custo e peso convertidos (libra → 0,5 kg, pés → metros), tipo do item da Tábula
e os dados de arma/armadura já preenchidos. Itens mágicos: nome em português, raridade, sintonia e
o tipo; a descrição ainda está em inglês (texto do SRD).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

DAMAGE = {
    'acid': 'ácido', 'bludgeoning': 'concussão', 'cold': 'frio', 'fire': 'fogo', 'force': 'energia',
    'lightning': 'elétrico', 'necrotic': 'necrótico', 'piercing': 'perfurante', 'poison': 'veneno',
    'psychic': 'psíquico', 'radiant': 'radiante', 'slashing': 'cortante', 'thunder': 'trovejante',
}
UNIT = {'gp': 'po', 'sp': 'pp', 'cp': 'pc', 'ep': 'pe', 'pp': 'pl'}
WEAPON_KIND = {
    'club': 'maca', 'dagger': 'adaga', 'greatclub': 'maca', 'handaxe': 'machado', 'javelin': 'lanca', 'light-hammer': 'maca',
    'mace': 'maca', 'quarterstaff': 'cajado', 'sickle': 'adaga', 'spear': 'lanca', 'crossbow-light': 'besta', 'dart': 'adaga',
    'shortbow': 'arco', 'sling': 'arco', 'battleaxe': 'machado', 'flail': 'maca', 'glaive': 'lanca', 'greataxe': 'machado',
    'greatsword': 'espada', 'halberd': 'lanca', 'lance': 'lanca', 'longsword': 'espada', 'maul': 'maca', 'morningstar': 'maca',
    'pike': 'lanca', 'rapier': 'espada', 'scimitar': 'espada', 'shortsword': 'espada', 'trident': 'lanca', 'war-pick': 'machado',
    'warhammer': 'maca', 'whip': 'adaga', 'blowgun': 'arco', 'crossbow-hand': 'besta', 'crossbow-heavy': 'besta',
    'longbow': 'arco', 'net': 'outro',
}
GEAR_KIND = {
    'arrow': 'municao', 'blowgun-needle': 'municao', 'crossbow-bolt': 'municao', 'sling-bullet': 'municao',
    'amulet': 'amuleto', 'emblem': 'outro', 'reliquary': 'amuleto', 'crystal': 'outro', 'orb': 'outro', 'rod': 'varinha',
    'staff': 'cajado', 'wand': 'varinha', 'sprig-of-mistletoe': 'outro', 'totem': 'amuleto', 'wooden-staff': 'cajado',
    'yew-wand': 'varinha', 'book': 'livro', 'spellbook': 'livro', 'signet-ring': 'anel', 'robes': 'capa',
    'climbers-kit': 'ferramenta', 'disguise-kit': 'ferramenta', 'forgery-kit': 'ferramenta', 'herbalism-kit': 'ferramenta',
    'healers-kit': 'ferramenta', 'poisoners-kit': 'ferramenta', 'fishing-tackle': 'ferramenta', 'mess-kit': 'outro',
    'small-knife': 'adaga', 'abacus': 'ferramenta', 'magnifying-glass': 'ferramenta', 'scale-merchants': 'ferramenta',
    'spyglass': 'ferramenta', 'hourglass': 'ferramenta', 'parchment-one-sheet': 'pergaminho', 'case-map-or-scroll': 'outro',
}
ARMOR_TYPE = {'Light': 'leve', 'Medium': 'media', 'Heavy': 'pesada'}


def num(x):
    s = f'{x:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    s = s.rstrip('0').rstrip(',') if ',' in s else s
    return s


def meters(ft):
    return num(ft / 5 * 1.5)


def cost(c):
    if not c:
        return ''
    return f"{num(c['quantity'])} {UNIT.get(c['unit'], c['unit'])}"


def kg(lb):
    return round((lb or 0) / 2, 3)


def weapon_props(e):
    out = []
    rng = e.get('range') or {}
    thr = e.get('throw_range') or {}
    for p in e.get('properties', []):
        k = p['index']
        if k == 'monk':
            continue
        if k == 'ammunition':
            out.append(f"munição (distância {meters(rng['normal'])}/{meters(rng['long'])})")
        elif k == 'thrown':
            r = thr or rng
            out.append(f"arremesso (distância {meters(r['normal'])}/{meters(r['long'])})")
        elif k == 'versatile':
            out.append(f"versátil ({e['two_handed_damage']['damage_dice']})")
        else:
            out.append({'finesse': 'acuidade', 'heavy': 'pesada', 'light': 'leve', 'loading': 'recarga', 'reach': 'alcance',
                        'special': 'especial', 'two-handed': 'duas mãos'}.get(k, k))
    return ', '.join(out)


def category(e):
    c = e['equipment_category']['index']
    if c == 'weapon':
        return ('Armas simples' if e['weapon_category'] == 'Simple' else 'Armas marciais')
    if c == 'armor':
        return 'Armaduras'
    if c == 'tools':
        t = e.get('tool_category', '')
        return {"Artisan's Tools": 'Ferramentas de artesão', 'Musical Instrument': 'Instrumentos musicais',
                'Gaming Sets': 'Kits de jogo'}.get(t, 'Ferramentas')
    if c == 'mounts-and-vehicles':
        v = e.get('vehicle_category', '')
        return {'Mounts and Other Animals': 'Montarias', 'Waterborne Vehicles': 'Embarcações'}.get(v, 'Arreios e veículos')
    g = (e.get('gear_category') or {}).get('index')
    return {'ammunition': 'Munição', 'arcane-foci': 'Focos de conjuração', 'druidic-foci': 'Focos de conjuração',
            'holy-symbols': 'Focos de conjuração', 'equipment-packs': 'Pacotes', 'kits': 'Ferramentas'}.get(g, 'Equipamento de aventura')


GENERIC = {
    'Ferramentas de artesão': 'Ferramentas para um ofício. A proficiência permite somar seu bônus de proficiência a testes de habilidade feitos com elas no seu ofício; cada tipo exige uma proficiência separada.',
    'Instrumentos musicais': 'A proficiência permite somar seu bônus de proficiência a testes para tocar música com o instrumento. Um bardo pode usar um instrumento musical como foco de conjuração. Cada tipo exige uma proficiência separada.',
    'Kits de jogo': 'A proficiência permite somar seu bônus de proficiência a testes para jogar com o kit. Cada tipo exige uma proficiência separada.',
    'arcane': 'Foco arcano: um feiticeiro, bruxo ou mago pode usá-lo como foco de conjuração.',
    'druidic': 'Foco druídico: um druida pode usá-lo como foco de conjuração.',
    'holy': 'Símbolo sagrado: um clérigo ou paladino pode usá-lo como foco de conjuração, segurando-o, usando-o à vista ou exibindo-o num escudo.',
    'barding': 'Armadura feita para proteger a cabeça, o pescoço, o peito e o corpo de um animal. Custa quatro vezes o preço da armadura equivalente para humanoides e pesa o dobro.',
}


def convert_equipment(eq, names):
    out = []
    by_id = {e['index']: e for e in eq}
    for e in eq:
        key = e['index']
        n = names[key]
        cat = category(e)
        it = {'id': key, 'n': n[0], 'en': e['name'], 'cat': cat, 'cost': cost(e.get('cost')), 'kg': kg(e.get('weight'))}
        desc = n[1] if len(n) > 1 else ''
        g = (e.get('gear_category') or {}).get('index')
        if e['equipment_category']['index'] == 'weapon':
            it['k'] = WEAPON_KIND[key]
            if e.get('damage'):
                it['dmg'] = e['damage']['damage_dice']
                it['dt'] = DAMAGE[e['damage']['damage_type']['index']]
            props = {p['index'] for p in e.get('properties', [])}
            it['hands'] = 'two' if 'two-handed' in props else 'versatile' if 'versatile' in props else 'one'
            if 'versatile' in props:
                it['dmg2'] = e['two_handed_damage']['damage_dice']
            if 'finesse' in props:
                it['fin'] = 1
            if 'light' in props:
                it['light'] = 1
            if e['weapon_range'] == 'Ranged':
                it['rng'] = 1
            it['sub'] = ('corpo a corpo' if e['weapon_range'] == 'Melee' else 'à distância')
            it['props'] = weapon_props(e)
        elif e['equipment_category']['index'] == 'armor':
            if e['armor_category'] == 'Shield':
                it['k'] = 'escudo'
                it['ac'] = e['armor_class']['base']
                it['sub'] = 'escudo'
            else:
                it['k'] = 'armadura'
                it['at'] = ARMOR_TYPE[e['armor_category']]
                it['ac'] = e['armor_class']['base']
                it['sub'] = {'leve': 'leve', 'media': 'média', 'pesada': 'pesada'}[it['at']]
                if e.get('str_minimum'):
                    it['str'] = e['str_minimum']
                if e.get('stealth_disadvantage'):
                    it['stealth'] = 1
        elif cat in ('Montarias', 'Embarcações', 'Arreios e veículos'):
            it['k'] = 'outro'
            it['mount'] = 1  # não vai na mochila: não conta no peso carregado
            if e.get('speed'):
                sp = e['speed']
                it['speed'] = (f"{meters(sp['quantity'])} m" if sp['unit'].startswith('ft')
                               else f"{num(sp['quantity'] * 1.5)} km/h")
            if e.get('capacity'):
                lb = int(re.sub(r'\D', '', e['capacity']))
                it['cap'] = f'{num(lb / 2)} kg'
            if key.startswith('barding'):
                desc = desc or GENERIC['barding']
        else:
            it['k'] = GEAR_KIND.get(key, 'ferramenta' if e['equipment_category']['index'] == 'tools' else 'outro')
            if e.get('quantity') and e['quantity'] > 1:
                it['qty'] = e['quantity']
            if g == 'arcane-foci':
                desc = desc or GENERIC['arcane']
            elif g == 'druidic-foci':
                desc = desc or GENERIC['druidic']
            elif g == 'holy-symbols':
                desc = desc or GENERIC['holy']
            if e.get('contents'):
                it['pack'] = [[c['item']['index'], c['quantity']] for c in e['contents'] if c['item']['index'] in by_id]
                it['kg'] = round(sum(kg(by_id[i].get('weight')) * q for i, q in it['pack']), 3)
                desc = 'Inclui ' + ', '.join(
                    (f"{c['quantity']} × " if c['quantity'] > 1 else '') + names[c['item']['index']][0].lower()
                    for c in e['contents']) + '.'
        if not desc and cat in GENERIC:
            desc = GENERIC[cat]
        if desc:
            it['d'] = desc
        out.append(it)
    return out


RARITY = {'Common': 'comum', 'Uncommon': 'incomum', 'Rare': 'raro', 'Very Rare': 'muito-raro', 'Legendary': 'lendario',
          'Artifact': 'artefato', 'Varies': 'varia'}
RARITY_TXT = {'common': 'comum', 'uncommon': 'incomum', 'rare': 'raro', 'very rare': 'muito raro', 'legendary': 'lendário',
              'artifact': 'artefato', 'varies': 'varia', 'rarity varies': 'raridade variável', 'rarity by figurine': 'raridade conforme a estatueta'}
CLASS_PT = {'bard': 'bardo', 'cleric': 'clérigo', 'druid': 'druida', 'sorcerer': 'feiticeiro', 'warlock': 'bruxo',
            'wizard': 'mago', 'paladin': 'paladino', 'spellcaster': 'conjurador', 'dwarf': 'anão'}
TYPE_PT = {'armor': 'Armadura', 'potion': 'Poção', 'ring': 'Anel', 'rod': 'Bastão', 'scroll': 'Pergaminho', 'staff': 'Cajado',
           'wand': 'Varinha', 'weapon': 'Arma', 'wondrous item': 'Item maravilhoso', 'wondrous items': 'Item maravilhoso',
           'wondous item': 'Item maravilhoso'}
BASE_PT = {
    'chain shirt': 'camisão de malha', 'light, medium, or heavy': 'leve, média ou pesada', 'medium or heavy': 'média ou pesada',
    'medium or heavy, but not hide': 'média ou pesada, exceto gibão de peles', 'plate': 'placas', 'scale mail': 'brunea',
    'shield': 'escudo', 'studded leather': 'couro batido', 'any ammunition': 'qualquer munição', 'any axe or sword': 'qualquer machado ou espada',
    'any axe': 'qualquer machado', 'any sword that deals slashing damage': 'qualquer espada que cause dano cortante',
    'any sword': 'qualquer espada', 'any': 'qualquer', 'arrow': 'flecha', 'dagger': 'adaga', 'javelin': 'azagaia',
    'longbow': 'arco longo', 'longsword': 'espada longa', 'mace': 'maça', 'maul': 'malho', 'scimitar': 'cimitarra',
    'trident': 'tridente', 'warhammer': 'martelo de guerra',
}
# base fixa (índice do equipamento) ou filtro para o mestre escolher
BASE_FIXED = {'chain shirt': 'chain-shirt', 'plate': 'plate-armor', 'scale mail': 'scale-mail', 'shield': 'shield',
              'studded leather': 'studded-leather-armor', 'arrow': 'arrow', 'dagger': 'dagger', 'javelin': 'javelin',
              'longbow': 'longbow', 'longsword': 'longsword', 'mace': 'mace', 'maul': 'maul', 'scimitar': 'scimitar',
              'trident': 'trident', 'warhammer': 'warhammer'}
BASE_PICK = {'light, medium, or heavy': 'armor', 'medium or heavy': 'armor-mh', 'medium or heavy, but not hide': 'armor-mh-nohide',
             'any ammunition': 'ammo', 'any axe or sword': 'axe-sword', 'any axe': 'axe', 'any sword that deals slashing damage': 'sword-slash',
             'any sword': 'sword', 'any': 'weapon'}


def type_line(first):
    """'Weapon (any sword), rare (requires attunement)' → 'Arma (qualquer espada), raro (requer sintonização)'"""
    m = re.match(r'^([A-Za-z ]+?)(?: \(([^)]*)\))?, (.*)$', first)
    if not m:
        return first, None, ''
    typ, base, rest = m.group(1).strip().lower(), m.group(2), m.group(3)
    s = TYPE_PT.get(typ, typ)
    if base:
        s += f' ({BASE_PT.get(base, base)})'

    def att(mm):
        who = mm.group(1)
        if not who:
            return '(requer sintonização)'
        who = who.strip()
        if who == 'outdoors at night':
            return '(requer sintonização ao ar livre, à noite)'
        if who.startswith('by a creature of'):
            al = 'boa' if 'good' in who else 'má'
            return f'(requer sintonização por uma criatura de tendência {al})'
        names = re.split(r', or |, | or ', who.replace('by a ', '').replace('by an ', ''))
        names = [CLASS_PT.get(x.strip(), x.strip()) for x in names if x.strip()]
        txt = names[0] if len(names) == 1 else ', '.join(names[:-1]) + ' ou ' + names[-1]
        return f'(requer sintonização por um {txt})'
    rest = re.sub(r'\(requires attunement ?([^)]*)\)', att, rest)
    for en, pt in sorted(RARITY_TXT.items(), key=lambda x: -len(x[0])):
        rest = re.sub(rf'\b{en}\b', pt, rest)
    if s.split(' ')[0] in ('Poção', 'Arma', 'Armadura', 'Varinha'):
        rest = re.sub(r'\braro\b', 'rara', rest).replace('lendário', 'lendária')
    rest = rest.replace(' or ', ' ou ').replace('(silver or brass)', '(prata ou latão)').replace('(silver ou brass)', '(prata ou latão)') \
        .replace('(bronze)', '(bronze)').replace('(iron)', '(ferro)')
    return f'{s}, {rest}', base, typ


def magic_kind(m, typ, name):
    i = m['index']
    if typ == 'armor':
        return 'escudo' if 'shield' in i else 'armadura'
    if typ == 'potion':
        return 'pocao'
    if typ == 'ring':
        return 'anel'
    if typ in ('rod', 'wand'):
        return 'varinha'
    if typ == 'staff':
        return 'cajado'
    if typ == 'scroll':
        return 'pergaminho'
    if typ == 'weapon':
        for k, v in (('ammunition', 'municao'), ('arrow', 'municao'), ('dagger', 'adaga'), ('axe', 'machado'), ('mace', 'maca'),
                     ('hammer', 'maca'), ('bow', 'arco'), ('javelin', 'lanca'), ('trident', 'lanca')):
            if k in i:
                return v
        return 'espada'
    for k, v in (('boots', 'botas'), ('slippers', 'botas'), ('horseshoes', 'botas'), ('cloak', 'capa'), ('cape', 'capa'),
                 ('mantle', 'capa'), ('robe', 'capa'), ('wings', 'capa'), ('belt', 'cinto'), ('gauntlets', 'luvas'), ('gloves', 'luvas'),
                 ('bracers', 'luvas'), ('amulet', 'amuleto'), ('periapt', 'amuleto'), ('necklace', 'amuleto'), ('medallion', 'amuleto'),
                 ('brooch', 'amuleto'), ('scarab', 'amuleto'), ('talisman', 'amuleto'), ('helm', 'elmo'), ('hat-', 'elmo'),
                 ('headband', 'elmo'), ('circlet', 'elmo'), ('goggles', 'elmo'), ('eyes-of', 'elmo'), ('manual', 'livro'),
                 ('tome', 'livro'), ('gem', 'tesouro'), ('pearl', 'tesouro'), ('ioun', 'tesouro'), ('stone-of', 'tesouro'),
                 ('pipes', 'ferramenta'), ('horn-of', 'ferramenta'), ('dust', 'pocao'), ('oil', 'pocao'), ('philter', 'pocao'),
                 ('ointment', 'pocao'), ('solvent', 'pocao'), ('glue', 'pocao')):
        if k in i:
            return v
    return 'outro'


PLUS = re.compile(r'-(\d)$')
AC_BONUS = {'ring-of-protection': 1, 'cloak-of-protection': 1}


def convert_magic(mi, names):
    out = []
    parents = {m['index']: m for m in mi if m.get('variants')}
    parent_of = {}
    for p in parents.values():
        for v in p['variants']:
            parent_of[v['index']] = p
    for m in mi:
        if m.get('variants'):
            continue  # usa as variantes, que têm a raridade certa
        par = parent_of.get(m['index'])
        desc = list(m['desc'])
        first = desc[0]
        # variantes herdam a descrição do item "pai" (o texto do SRD é o mesmo)
        if par and len(desc) <= 1:
            desc = list(par['desc'])
            first = desc[0]
        line, base, typ = type_line(first)
        body = [d for d in desc[1:] if d.strip()]
        rarity = RARITY.get(m['rarity']['name'], 'comum')
        att = 'requires attunement' in first
        it = {'id': m['index'], 'n': names[m['index']], 'en': m['name'], 'tipo': line, 'r': rarity, 'k': magic_kind(m, typ, m['name'])}
        if att:
            it['sint'] = 1
        if base in BASE_FIXED:
            it['base'] = BASE_FIXED[base]
            if BASE_FIXED[base] in WEAPON_KIND:
                it['k'] = WEAPON_KIND[BASE_FIXED[base]]
        elif base in BASE_PICK:
            it['pick'] = BASE_PICK[base]
        pm = PLUS.search(m['index'])
        if pm and typ in ('weapon', 'armor') or (pm and m['index'].startswith(('ammunition', 'armor', 'weapon'))):
            it['magic'] = int(pm.group(1))
        if 'magic' not in it:
            txt = ' '.join(body)
            bm = re.search(r'\+(\d) bonus to attack and damage rolls made with this magic weapon', txt) if typ == 'weapon' else \
                re.search(r'(?:gain a )?\+(\d) bonus to AC(?: while (?:you wear|wearing))?', txt) if typ == 'armor' else None
            if bm:
                it['magic'] = int(bm.group(1))
        if m['index'] in AC_BONUS:
            it['acb'] = AC_BONUS[m['index']]
        it['d'] = body
        out.append(it)
    return out


def main(eq_src, mi_src, dst):
    names = json.load(open(os.path.join(HERE, 'traducoes', 'itens.json'), encoding='utf-8'))
    eq = json.load(open(eq_src, encoding='utf-8'))
    mi = json.load(open(mi_src, encoding='utf-8'))
    items = convert_equipment(eq, names['equipamento'])
    magic = convert_magic(mi, names['magicos'])
    data = {
        'fonte': 'System Reference Document 5.1 (Wizards of the Coast), licença CC-BY-4.0. Dados: 5e-bits/5e-database (MIT). '
                 'Nomes e descrições do equipamento traduzidos pela Tábula; a descrição dos itens mágicos está no original em inglês.',
        'itens': items,
        'magicos': magic,
    }
    with open(dst, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(items)} itens e {len(magic)} itens mágicos → {dst}')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
