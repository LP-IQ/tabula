#!/usr/bin/env python3
"""Gera public/data/srd-magias.json a partir das magias do SRD 5.1 (dados do projeto
5e-bits/5e-database, licença MIT; conteúdo do SRD 5.1 da Wizards of the Coast, licença CC-BY-4.0)
e das traduções em tools/srd/traducoes/magias-*.json.

Uso:  python3 tools/srd/converter_magias.py <5e-SRD-Spells.json> public/data/srd-magias.json

As traduções têm, por magia (chave = índice do SRD):
  n  nome em português (o do Livro do Jogador; magias com nome de mago perdem o nome próprio, como no SRD)
  m  componente material (opcional)
  d  parágrafos da descrição (markdown simples: ***Negrito.***, listas com "- ", tabelas com "|")
  h  parágrafos de "Em Níveis Superiores" (opcional)
O resto (nível, escola, tempo, alcance, componentes, duração, classes) sai dos dados do SRD.
"""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

SCHOOLS = {
    'abjuration': 'abjuração', 'conjuration': 'conjuração', 'divination': 'adivinhação', 'enchantment': 'encantamento',
    'evocation': 'evocação', 'illusion': 'ilusão', 'necromancy': 'necromancia', 'transmutation': 'transmutação',
}
CLASSES = {
    'bard': 'bardo', 'cleric': 'clerigo', 'druid': 'druida', 'paladin': 'paladino', 'ranger': 'patrulheiro',
    'sorcerer': 'feiticeiro', 'warlock': 'bruxo', 'wizard': 'mago',
}
# O artífice não está no SRD 5.1. Esta é a lista dele (Caldeirão de Tasha para Tudo), só com as magias do SRD.
ARTIFICER = set('''
acid-splash dancing-lights fire-bolt guidance light mage-hand mending message poison-spray prestidigitation
ray-of-frost resistance shocking-grasp spare-the-dying
alarm cure-wounds detect-magic disguise-self expeditious-retreat faerie-fire false-life feather-fall grease
identify jump longstrider purify-food-and-drink sanctuary
aid alter-self arcane-lock blur continual-flame darkvision enhance-ability enlarge-reduce heat-metal invisibility
lesser-restoration levitate magic-mouth magic-weapon protection-from-poison rope-trick see-invisibility
spider-climb web
blink create-food-and-water dispel-magic fly glyph-of-warding haste protection-from-energy revivify
water-breathing water-walk
arcane-eye fabricate freedom-of-movement secret-chest faithful-hound private-sanctum resilient-sphere
stone-shape stoneskin
animate-objects arcane-hand creation greater-restoration wall-of-stone
'''.split())

# Gatilhos das magias de reação (o SRD só diz "1 reaction"; o Livro do Jogador diz quando)
REACTION = {
    'counterspell': 'que você realiza quando vê uma criatura a até 18 metros conjurando uma magia',
    'feather-fall': 'que você realiza quando você ou uma criatura a até 18 metros cai',
    'hellish-rebuke': 'que você realiza em resposta a sofrer dano de uma criatura a até 18 metros que você possa ver',
    'shield': 'que você realiza quando é atingido por um ataque ou é alvo da magia mísseis mágicos',
}


def num(x):
    s = f'{x:,.1f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    return s[:-2] if s.endswith(',0') else s


def feet(n):
    """pés → metros (5 pés = 1,5 m), como no Livro do Jogador"""
    n = float(n)
    if n < 5:
        return f'{num(n * 30)} centímetros'
    m = n / 5 * 1.5
    return f'{num(m)} metro' + ('' if m < 2 else 's')


UNITS = {'minute': 'minuto', 'hour': 'hora', 'day': 'dia', 'round': 'rodada', 'action': 'ação', 'year': 'ano'}


def unit(n, u):
    pt = UNITS[u]
    if n == 1:
        return f'1 {pt}'
    plural = {'ação': 'ações'}.get(pt, pt + 's')
    return f'{n} {plural}'


def casting_time(s, key):
    if s == '1 action':
        return '1 ação'
    if s == '1 bonus action':
        return '1 ação bônus'
    if s == '1 reaction':
        return '1 reação, ' + REACTION[key] if key in REACTION else '1 reação'
    m = re.fullmatch(r'(\d+) (minute|hour|day)s?', s)
    if m:
        return unit(int(m.group(1)), m.group(2))
    raise ValueError(f'tempo desconhecido: {s}')


AREA = {'sphere': 'raio de {}', 'cone': 'cone de {}', 'line': 'linha de {}', 'cube': 'cubo de {}', 'cylinder': 'raio de {}'}


def spell_range(s, area):
    if s == 'Touch':
        return 'Toque'
    if s == 'Self':
        if area:
            return f"Pessoal ({AREA[area['type']].format(feet(area['size']))})"
        return 'Pessoal'
    if s == 'Sight':
        return 'Visão'
    if s == 'Special':
        return 'Especial'
    if s == 'Unlimited':
        return 'Ilimitado'
    m = re.fullmatch(r'([\d,]+) (feet|foot|miles?)', s)
    if m:
        n = int(m.group(1).replace(',', ''))
        if m.group(2).startswith('mile'):
            km = n * 1.5
            return f'{num(km)} quilômetro' + ('' if km < 2 else 's')
        return feet(n)
    raise ValueError(f'alcance desconhecido: {s}')


def duration(s, conc):
    if s == 'Instantaneous':
        return 'Instantânea'
    if s == 'Until dispelled':
        return 'Até ser dissipada'
    if s == 'Special':
        return 'Especial'
    m = re.fullmatch(r'(Up to )?(\d+) (minute|hour|day|round)s?', s)
    if m:
        base = unit(int(m.group(2)), m.group(3))
        if m.group(1):
            return f'Concentração, até {base}'
        return base
    raise ValueError(f'duração desconhecida: {s}')


def main(src, dst):
    spells = json.load(open(src, encoding='utf-8'))
    tr = {}
    for f in sorted(glob.glob(os.path.join(HERE, 'traducoes', 'magias-*.json'))):
        tr.update(json.load(open(f, encoding='utf-8')))
    out = []
    missing = []
    for s in spells:
        key = s['index']
        t = tr.get(key)
        if not t:
            missing.append(key)
            continue
        classes = sorted({CLASSES[c['index']] for c in s['classes'] if c['index'] in CLASSES})
        if key in ARTIFICER:
            classes.append('artifice')
        item = {
            'id': key,
            'n': t['n'],
            'en': s['name'],
            'l': s['level'],
            'e': SCHOOLS[s['school']['index']],
            't': casting_time(s['casting_time'], key),
            'a': spell_range(s['range'], s.get('area_of_effect')),
            'c': ', '.join(s['components']),
            'du': duration(s['duration'], s.get('concentration')),
            'cl': classes,
            'd': t['d'],
        }
        if s.get('ritual'):
            item['ri'] = 1
        if s.get('concentration'):
            item['co'] = 1
        if 'M' in s['components'] and t.get('m'):
            item['m'] = t['m']
        if t.get('h'):
            item['h'] = t['h']
        out.append(item)
    if missing:
        print('sem tradução:', ', '.join(missing), file=sys.stderr)
    out.sort(key=lambda x: (x['l'], x['n']))
    data = {
        'fonte': 'System Reference Document 5.1 (Wizards of the Coast), licença CC-BY-4.0. Dados: 5e-bits/5e-database (MIT). '
                 'Tradução para o português: Tábula.',
        'magias': out,
    }
    with open(dst, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(out)} magias → {dst}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
