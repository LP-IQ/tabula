#!/usr/bin/env python3
"""Converte os monstros do SRD 5.1 (dados do projeto 5e-bits/5e-database, licença MIT;
conteúdo do SRD 5.1 da Wizards of the Coast, licença CC-BY-4.0) para o formato da Tábula.

Uso:  python3 tools/srd/converter.py <5e-SRD-Monsters.json> public/data/srd-monstros.json

Traduz para português tudo o que é estrutural (tamanho, tipo, tendência, deslocamento,
sentidos, perícias, tipos de dano, condições, idiomas comuns e o texto padrão dos ataques).
Os nomes de uma lista de monstros comuns são traduzidos; o resto do texto fica em inglês.
"""
import json
import re
import sys

SIZES = {'Tiny': 'Miúdo', 'Small': 'Pequeno', 'Medium': 'Médio', 'Large': 'Grande', 'Huge': 'Enorme', 'Gargantuan': 'Imenso'}
TYPES = {
    'aberration': 'aberração', 'beast': 'fera', 'celestial': 'celestial', 'construct': 'constructo',
    'dragon': 'dragão', 'elemental': 'elemental', 'fey': 'fada', 'fiend': 'corruptor', 'giant': 'gigante',
    'humanoid': 'humanoide', 'monstrosity': 'monstruosidade', 'ooze': 'limo', 'plant': 'planta',
    'undead': 'morto-vivo', 'swarm of Tiny beasts': 'enxame de feras Miúdas',
}
ALIGN = {
    'lawful good': 'leal e bom', 'neutral good': 'neutro e bom', 'chaotic good': 'caótico e bom',
    'lawful neutral': 'leal e neutro', 'neutral': 'neutro', 'chaotic neutral': 'caótico e neutro',
    'lawful evil': 'leal e mau', 'neutral evil': 'neutro e mau', 'chaotic evil': 'caótico e mau',
    'unaligned': 'sem tendência', 'any alignment': 'qualquer tendência',
    'any non-good alignment': 'qualquer tendência não boa', 'any non-lawful alignment': 'qualquer tendência não leal',
    'any chaotic alignment': 'qualquer tendência caótica', 'any evil alignment': 'qualquer tendência má',
}
DAMAGE = {
    'acid': 'ácido', 'bludgeoning': 'concussão', 'cold': 'frio', 'fire': 'fogo', 'force': 'energia',
    'lightning': 'elétrico', 'necrotic': 'necrótico', 'piercing': 'perfurante', 'poison': 'veneno',
    'psychic': 'psíquico', 'radiant': 'radiante', 'slashing': 'cortante', 'thunder': 'trovejante',
}
CONDITIONS = {
    'blinded': 'cego', 'charmed': 'enfeitiçado', 'deafened': 'surdo', 'exhaustion': 'exaustão',
    'frightened': 'amedrontado', 'grappled': 'agarrado', 'incapacitated': 'incapacitado', 'invisible': 'invisível',
    'paralyzed': 'paralisado', 'petrified': 'petrificado', 'poisoned': 'envenenado', 'prone': 'caído',
    'restrained': 'impedido', 'stunned': 'atordoado', 'unconscious': 'inconsciente',
}
SKILLS = {
    'acrobatics': 'Acrobacia', 'animal-handling': 'Adestrar Animais', 'arcana': 'Arcanismo', 'athletics': 'Atletismo',
    'deception': 'Enganação', 'history': 'História', 'insight': 'Intuição', 'intimidation': 'Intimidação',
    'investigation': 'Investigação', 'medicine': 'Medicina', 'nature': 'Natureza', 'perception': 'Percepção',
    'performance': 'Atuação', 'persuasion': 'Persuasão', 'religion': 'Religião', 'sleight-of-hand': 'Prestidigitação',
    'stealth': 'Furtividade', 'survival': 'Sobrevivência',
}
# como o tipo de dano aparece depois de "dano" nos livros em português
DAMAGE_PHRASE = {
    'acid': 'de ácido', 'bludgeoning': 'de concussão', 'cold': 'de frio', 'fire': 'de fogo', 'force': 'de energia',
    'lightning': 'elétrico', 'necrotic': 'necrótico', 'piercing': 'perfurante', 'poison': 'de veneno',
    'psychic': 'psíquico', 'radiant': 'radiante', 'slashing': 'cortante', 'thunder': 'trovejante',
}
SUBTYPES = {
    'goblinoid': 'goblinoide', 'any race': 'qualquer raça', 'elf': 'elfo', 'dwarf': 'anão', 'human': 'humano',
    'demon': 'demônio', 'devil': 'diabo', 'shapechanger': 'metamorfo', 'titan': 'titã', 'gnome': 'gnomo',
    'human, shapechanger': 'humano, metamorfo', 'kobold': 'kobold', 'orc': 'orc', 'gnoll': 'gnoll',
}
ARMOR = {
    'Padded Armor': 'acolchoada', 'Leather Armor': 'armadura de couro', 'Studded Leather Armor': 'couro batido',
    'Hide Armor': 'gibão de peles', 'Chain Shirt': 'camisão de malha', 'Scale Mail': 'brunea', 'Breastplate': 'peitoral',
    'Half Plate Armor': 'meia armadura', 'Half Plate': 'meia armadura', 'Ring Mail': 'cota de anéis',
    'Chain Mail': 'cota de malha', 'Splint Armor': 'cota de talas', 'Plate Armor': 'armadura de placas', 'Shield': 'escudo',
}
SENSES = {'darkvision': 'visão no escuro', 'blindsight': 'percepção às cegas', 'tremorsense': 'sentido sísmico', 'truesight': 'visão verdadeira'}
SPEED = {'walk': '', 'fly': 'voo', 'swim': 'natação', 'climb': 'escalada', 'burrow': 'escavação'}
LANG = [
    ('Undercommon', 'Subcomum'), ('Common', 'Comum'), ('Draconic', 'Dracônico'), ('Elvish', 'Élfico'),
    ('Dwarvish', 'Anão'), ('Giant', 'Gigante'), ('Abyssal', 'Abissal'), ('Sylvan', 'Silvestre'),
    ('Deep Speech', 'Dialeto Subterrâneo'), ('Gnomish', 'Gnômico'), ('Halfling', 'Halfling'),
    ('telepathy', 'telepatia'), ("understands", 'entende'), (" but can't speak", ' mas não fala'),
    ("can't speak", 'não fala'), ('the languages it knew in life', 'os idiomas que conhecia em vida'),
    ('any one language (usually Common)', 'um idioma qualquer (geralmente Comum)'),
    ('any two languages', 'dois idiomas quaisquer'), ('any four languages', 'quatro idiomas quaisquer'),
    ('any six languages', 'seis idiomas quaisquer'), ('any languages it knew in life', 'os idiomas que conhecia em vida'),
    (' and ', ' e '), (' ft.', ' pés'),
]
# Nomes dos monstros mais comuns em português (os demais ficam em inglês)
NAMES = {
    'goblin': 'Goblin', 'hobgoblin': 'Hobgoblin', 'bugbear': 'Bugbear', 'kobold': 'Kobold', 'orc': 'Orc',
    'ogre': 'Ogro', 'troll': 'Troll', 'gnoll': 'Gnoll', 'skeleton': 'Esqueleto', 'zombie': 'Zumbi',
    'ghoul': 'Carniçal', 'wolf': 'Lobo', 'dire-wolf': 'Lobo Atroz', 'brown-bear': 'Urso Marrom',
    'black-bear': 'Urso Negro', 'polar-bear': 'Urso Polar', 'owlbear': 'Urso-Coruja', 'manticore': 'Mantícora',
    'giant-spider': 'Aranha Gigante', 'giant-rat': 'Rato Gigante', 'giant-bat': 'Morcego Gigante',
    'bandit': 'Bandido', 'bandit-captain': 'Capitão Bandido', 'cultist': 'Cultista', 'cult-fanatic': 'Fanático do Culto',
    'guard': 'Guarda', 'commoner': 'Plebeu', 'noble': 'Nobre', 'acolyte': 'Acólito', 'priest': 'Sacerdote',
    'mage': 'Mago', 'archmage': 'Arquimago', 'veteran': 'Veterano', 'knight': 'Cavaleiro', 'scout': 'Batedor',
    'spy': 'Espião', 'assassin': 'Assassino', 'gladiator': 'Gladiador', 'berserker': 'Berserker', 'thug': 'Bandoleiro',
    'druid': 'Druida', 'tribal-warrior': 'Guerreiro Tribal', 'werewolf': 'Lobisomem', 'vampire': 'Vampiro',
    'lich': 'Lich', 'mummy': 'Múmia', 'specter': 'Espectro', 'ghost': 'Fantasma', 'wraith': 'Aparição',
    'shadow': 'Sombra', 'gelatinous-cube': 'Cubo Gelatinoso', 'mimic': 'Mímico', 'basilisk': 'Basilisco',
    'griffon': 'Grifo', 'hippogriff': 'Hipogrifo', 'harpy': 'Harpia', 'medusa': 'Medusa', 'minotaur': 'Minotauro',
    'chimera': 'Quimera', 'hydra': 'Hidra', 'imp': 'Diabrete', 'hell-hound': 'Cão Infernal', 'ettin': 'Ettin',
    'hill-giant': 'Gigante da Colina', 'fire-giant': 'Gigante do Fogo', 'frost-giant': 'Gigante do Gelo',
    'stone-giant': 'Gigante da Pedra', 'fire-elemental': 'Elemental do Fogo', 'air-elemental': 'Elemental do Ar',
    'water-elemental': 'Elemental da Água', 'earth-elemental': 'Elemental da Terra', 'flesh-golem': 'Golem de Carne',
    'stone-golem': 'Golem de Pedra', 'iron-golem': 'Golem de Ferro', 'clay-golem': 'Golem de Barro',
    'warhorse': 'Cavalo de Guerra', 'riding-horse': 'Cavalo de Montaria', 'mastiff': 'Mastim', 'panther': 'Pantera',
    'tiger': 'Tigre', 'lion': 'Leão', 'boar': 'Javali', 'crocodile': 'Crocodilo', 'raven': 'Corvo', 'cat': 'Gato',
    'owl': 'Coruja', 'eagle': 'Águia', 'hawk': 'Falcão', 'poisonous-snake': 'Cobra Venenosa',
    'constrictor-snake': 'Cobra Constritora', 'swarm-of-rats': 'Enxame de Ratos', 'swarm-of-bats': 'Enxame de Morcegos',
    'swarm-of-insects': 'Enxame de Insetos', 'gargoyle': 'Gárgula', 'dryad': 'Dríade', 'satyr': 'Sátiro',
    'pseudodragon': 'Pseudodragão', 'kraken': 'Kraken', 'giant-centipede': 'Centopeia Gigante',
    'giant-wolf-spider': 'Aranha-Lobo Gigante', 'wolf-spider': 'Aranha-Lobo', 'worg': 'Worg', 'winter-wolf': 'Lobo Invernal',
    'young-red-dragon': 'Dragão Vermelho Jovem', 'adult-red-dragon': 'Dragão Vermelho Adulto',
    'red-dragon-wyrmling': 'Filhote de Dragão Vermelho', 'young-black-dragon': 'Dragão Negro Jovem',
    'black-dragon-wyrmling': 'Filhote de Dragão Negro', 'young-green-dragon': 'Dragão Verde Jovem',
    'green-dragon-wyrmling': 'Filhote de Dragão Verde', 'young-white-dragon': 'Dragão Branco Jovem',
    'white-dragon-wyrmling': 'Filhote de Dragão Branco', 'young-blue-dragon': 'Dragão Azul Jovem',
    'blue-dragon-wyrmling': 'Filhote de Dragão Azul', 'quasit': 'Quasit', 'ankheg': 'Ankheg', 'ettercap': 'Ettercap',
    'bulette': 'Bulette', 'cockatrice': 'Cocatriz', 'darkmantle': 'Manto Sombrio', 'gibbering-mouther': 'Boca Gorgolejante',
    'stirge': 'Stirge', 'wight': 'Inumano', 'will-o-wisp': 'Fogo-Fátuo', 'banshee': 'Banshee', 'deer': 'Cervo',
    'giant-eagle': 'Águia Gigante', 'giant-toad': 'Sapo Gigante', 'giant-frog': 'Sapo Gigante', 'ape': 'Macaco',
    'giant-goat': 'Bode Gigante', 'mule': 'Mula', 'pony': 'Pônei', 'draft-horse': 'Cavalo de Tração',
}

def meters(ft):
    m = round(int(ft) * 0.3 / 1.5) * 1.5
    return f"{m:.1f}".rstrip('0').rstrip('.').replace('.', ',')

def ft_to_m(text):
    text = re.sub(r'(\d+)/(\d+)\s*ft\.?', lambda m: f"{meters(m.group(1))}/{meters(m.group(2))} m", text)
    return re.sub(r'(\d+)\s*ft\.?', lambda m: f"{meters(m.group(1))} m", text)

def tr_lang(s):
    for a, b in LANG:
        s = s.replace(a, b)
    return ft_to_m(s.replace(' pés', ' ft.'))

def cr_str(cr):
    return {0.125: '1/8', 0.25: '1/4', 0.5: '1/2'}.get(cr, str(int(cr)))

ATTACK_RE = re.compile(
    r'^(Melee|Ranged|Melee or Ranged) (Weapon|Spell) Attack: \+(\d+) to hit, (.*?), (one target|one creature|one target or creature)[^.]*\. '
    r'Hit: (\d+) \(([^)]+)\) (\w+) damage(?:,? plus (\d+) \(([^)]+)\) (\w+) damage)?\.\s*(.*)$', re.S)
KIND = {'Melee': 'corpo a corpo', 'Ranged': 'à distância', 'Melee or Ranged': 'corpo a corpo ou à distância'}

def tr_reach(s):
    s = s.replace('reach', 'alcance').replace('range', 'distância')
    return ft_to_m(s)

def tr_attack(desc):
    m = ATTACK_RE.match(desc.strip())
    if not m:
        return desc
    kind, wtype, bonus, reach, target, avg1, dice1, t1, avg2, dice2, t2, rest = m.groups()
    alvo = {'one target': 'um alvo', 'one creature': 'uma criatura', 'one target or creature': 'um alvo'}[target]
    tipo = 'com arma' if wtype == 'Weapon' else 'com magia'
    out = f"Ataque {KIND[kind]} {tipo}: +{bonus} para acertar, {tr_reach(reach)}, {alvo}. "
    out += f"Acerto: {avg1} ({dice1.replace(' ', '')}) de dano {DAMAGE_PHRASE.get(t1.lower(), t1)}"
    if avg2:
        out += f" mais {avg2} ({dice2.replace(' ', '')}) de dano {DAMAGE_PHRASE.get(t2.lower(), t2)}"
    out += '.'
    if rest:
        out += ' ' + rest.strip()
    return out

def dmg_list(items):
    out = []
    for x in items:
        x2 = x
        for en, pt in DAMAGE.items():
            x2 = re.sub(rf'\b{en}\b', pt, x2)
        x2 = x2.replace("bludgeoning, piercing, and slashing from nonmagical attacks", "concussão, perfurante e cortante de ataques não mágicos")
        out.append(x2)
    return ', '.join(out)

def speed(sp):
    parts = []
    for k, v in sp.items():
        if k == 'hover':
            continue
        label = SPEED.get(k, k)
        parts.append((label + ' ' if label else '') + ft_to_m(v))
    if sp.get('hover'):
        parts[-1] += ' (flutuar)'
    return ', '.join(parts)

def senses(se):
    out = []
    for k, v in se.items():
        if k == 'passive_perception':
            continue
        out.append(f"{SENSES.get(k, k)} {ft_to_m(v)}")
    out.append(f"Percepção passiva {se.get('passive_perception', 10)}")
    return ', '.join(out)

def first_damage(action):
    # junta todos os dados de dano do ataque (ex.: mordida 2d10+8 perfurante + 2d6 fogo)
    dice, types = [], []
    for d in action.get('damage', []) or []:
        if 'from' in d:
            opts = [o for o in d['from'].get('options', []) if 'damage_dice' in o]
            d = opts[0] if opts else {}
        if 'damage_dice' in d:
            dice.append(d['damage_dice'].replace(' ', ''))
            t = DAMAGE.get(d.get('damage_type', {}).get('index', ''), '')
            if t:
                types.append(t)
    return '+'.join(dice), ' + '.join(types)

def block(items):
    out = []
    for a in items or []:
        dmg, dtype = first_damage(a)
        entry = {'name': a['name'], 'text': tr_attack(a.get('desc', ''))}
        if 'attack_bonus' in a:
            entry['toHit'] = a['attack_bonus']
        if dmg:
            entry['damage'] = dmg
            if dtype:
                entry['damageType'] = dtype
        if a.get('dc') and a['dc'].get('dc_value'):
            entry['dc'] = a['dc']['dc_value']
            entry['dcAbility'] = a['dc'].get('dc_type', {}).get('index', '')
        if a.get('usage'):
            u = a['usage']
            if u.get('type') == 'per day':
                entry['name'] += f" ({u.get('times')}/dia)"
            elif u.get('type') == 'recharge on roll':
                entry['name'] += f" (recarga {u.get('min_value')}–6)"
            elif u.get('type') == 'recharge after rest':
                entry['name'] += ' (recarga após descanso)'
        out.append(entry)
    return out

def convert(x):
    saves, skills = {}, []
    for p in x.get('proficiencies', []):
        idx = p['proficiency']['index']
        if idx.startswith('saving-throw-'):
            key = {'str': 'str', 'dex': 'dex', 'con': 'con', 'int': 'int', 'wis': 'wis', 'cha': 'cha'}[idx[-3:]]
            saves[key] = p['value']
        elif idx.startswith('skill-'):
            k = idx[6:]
            skills.append({'name': SKILLS.get(k, k), 'bonus': p['value']})
    ac = x['armor_class'][0]
    ac_note = {'natural': 'armadura natural', 'armor': ', '.join(ARMOR.get(a['name'], a['name']) for a in ac.get('armor', [])) or 'armadura',
               'dex': '', 'condition': 'com armadura arcana', 'spell': ''}.get(ac.get('type'), '')
    t = TYPES.get(x['type'], x['type'])
    if x.get('subtype'):
        t += f" ({SUBTYPES.get(x['subtype'], x['subtype'])})"
    name_pt = NAMES.get(x['index'])
    return {
        'srd': x['index'],
        'name': name_pt or x['name'],
        'nameEn': x['name'],
        'size': SIZES.get(x['size'], x['size']),
        'type': t,
        'alignment': ALIGN.get(x['alignment'], x['alignment']),
        'ac': ac['value'],
        'acNote': ac_note,
        'hp': x['hit_points'],
        'hpFormula': x.get('hit_points_roll') or x.get('hit_dice', ''),
        'speed': speed(x.get('speed', {})),
        'attrs': {'str': x['strength'], 'dex': x['dexterity'], 'con': x['constitution'],
                  'int': x['intelligence'], 'wis': x['wisdom'], 'cha': x['charisma']},
        'saves': saves,
        'skills': skills,
        'vulnerabilities': dmg_list(x.get('damage_vulnerabilities', [])),
        'resistances': dmg_list(x.get('damage_resistances', [])),
        'immunities': dmg_list(x.get('damage_immunities', [])),
        'conditionImmunities': ', '.join(CONDITIONS.get(c['index'], c['name']) for c in x.get('condition_immunities', [])),
        'senses': senses(x.get('senses', {})),
        'languages': tr_lang(x.get('languages', '')) or '—',
        'cr': cr_str(x['challenge_rating']),
        'traits': block(x.get('special_abilities')),
        'actions': block(x.get('actions')),
        'reactions': block(x.get('reactions')),
        'legendary': block(x.get('legendary_actions')),
    }

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    data = json.load(open(src, encoding='utf-8'))
    out = {
        'license': ('Inclui material do System Reference Document 5.1 ("SRD 5.1") da Wizards of the Coast LLC, '
                    'disponível em https://dnd.wizards.com/resources/systems-reference-document, licenciado sob '
                    'Creative Commons Attribution 4.0 International (https://creativecommons.org/licenses/by/4.0/legalcode). '
                    'Dados estruturados do projeto 5e-bits/5e-database (licença MIT). Traduções parciais da Tábula.'),
        'monsters': sorted((convert(x) for x in data), key=lambda m: m['name'].lower()),
    }
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f"{len(out['monsters'])} monstros -> {dst}")
